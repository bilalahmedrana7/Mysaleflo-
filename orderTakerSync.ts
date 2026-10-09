import { store } from './store';
import { api } from './api';
import { enqueue, flushQueue, listQueued, reservedQuantities, QueuedOrder, QueuedLine } from './offlineQueue';

// Order Taker side: loads the safe view of the dealer's data from the server and sends orders to the
// server for confirmation (the server cuts stock, numbers the invoice and updates the customer ledger).

export type OtStatus = 'idle' | 'loading' | 'ready' | 'offline' | 'error';
export interface OtState {
  status: OtStatus;
  message: string;
}

const POLL_MS = 30000;
let state: OtState = { status: 'idle', message: '' };
let timer: ReturnType<typeof setInterval> | null = null;
let busy = false;
const stateListeners = new Set<(s: OtState) => void>();
const dataListeners = new Set<() => void>();
let recent: { key: string; id: string; at: number } | null = null;

function setState(next: OtState) {
  state = next;
  stateListeners.forEach((fn) => fn(state));
}

function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

// Sends any orders that were taken without signal. Returns true if something was sent.
async function sendWaiting(): Promise<boolean> {
  const me = api.getCachedUser()?.orderTakerId;
  if (!me || listQueued(me).every((q) => q.status !== 'QUEUED')) return false;
  const r = await flushQueue(me, (p) => api.createOrderTakerOrder(p));
  return r.sent > 0;
}

async function load(): Promise<void> {
  if (busy) return;
  try {
    await sendWaiting();
  } catch {
    /* never block loading */
  }
  busy = true;
  try {
    const r = await api.getOrderTakerData();
    store.upsertDealers([r.dealer]);
    store.restoreDealerBackup(r.data.dealerId, r.data);
    const me = api.getCachedUser()?.orderTakerId;
    if (me) store.reserveLocalStock(r.data.dealerId, reservedQuantities(me)); // orders still waiting to be sent
    setState({ status: 'ready', message: '' });
    dataListeners.forEach((fn) => fn());
  } catch (e: any) {
    if (e?.status === undefined) {
      setState({ status: 'offline', message: 'No signal. Showing the last data saved on this phone; you can still take orders.' });
    } else {
      setState({ status: 'error', message: e.message || 'Could not load your data.' });
    }
  } finally {
    busy = false;
  }
}

export const orderTakerSync = {
  getState: () => state,
  subscribe(fn: (s: OtState) => void) {
    stateListeners.add(fn);
    return () => stateListeners.delete(fn);
  },
  onData(fn: () => void) {
    dataListeners.add(fn);
    return () => dataListeners.delete(fn);
  },

  async start() {
    this.stop();
    setState({ status: 'loading', message: 'Loading your data…' });
    window.addEventListener('online', onOnline);
    timer = setInterval(() => void load(), POLL_MS);
    await load();
  },

  stop() {
    if (timer) clearInterval(timer);
    timer = null;
    window.removeEventListener('online', onOnline);
    setState({ status: 'idle', message: '' });
  },

  refresh: load,

  // Sends the order to the server. With no signal the order is saved on the phone and sent automatically later.
  // Re-sending the same order never creates a second order because it carries the same request id.
  async submitOrder(
    payload: {
      customerId: string;
      items: { productId: string; quantity: number; discountPercent?: number }[];
      paidAmount?: number;
      notes?: string;
    },
    meta: { orderTakerId: string; customerName: string; lines: QueuedLine[] }
  ): Promise<
    | { queued: false; order: any; invoice: any }
    | { queued: true; entry: QueuedOrder }
  > {
    const key = JSON.stringify([payload.customerId, payload.items, payload.paidAmount || 0]);
    const now = Date.now();
    if (!recent || recent.key !== key || now - recent.at > 10 * 60 * 1000) {
      recent = { key, id: newRequestId(), at: now };
    }
    const requestId = recent.id;
    const orderedAt = new Date(now).toISOString();

    const saveForLater = () => {
      const entry = enqueue(meta.orderTakerId, {
        id: requestId,
        createdAt: orderedAt,
        customerId: payload.customerId,
        customerName: meta.customerName,
        lines: meta.lines,
        notes: payload.notes,
      });
      recent = null;
      const dealerId = api.getCachedUser()?.dealerId;
      if (dealerId) {
        const reserve: Record<string, number> = {};
        for (const l of meta.lines) reserve[l.productId] = l.quantity;
        store.reserveLocalStock(dealerId, reserve);
      }
      dataListeners.forEach((fn) => fn());
      return { queued: true as const, entry };
    };

    if (typeof navigator !== 'undefined' && navigator.onLine === false) return saveForLater();

    let res;
    try {
      res = await api.createOrderTakerOrder({ ...payload, clientRequestId: requestId, orderedAt });
    } catch (e: any) {
      if (e?.status === undefined) return saveForLater(); // no signal after all
      throw e;
    }
    recent = null;
    await load(); // show the updated stock and the new order
    return { queued: false, order: res.order, invoice: res.invoice };
  },

  // Called by the "Send now" button
  async sendNow() {
    await load();
  },
};

function onOnline() {
  void load();
}
