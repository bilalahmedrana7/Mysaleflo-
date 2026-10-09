// Orders taken with no signal are saved on the phone and sent automatically when the phone is online again.
// Each order has a fixed request id, so sending it twice can never create two orders on the server.

export interface QueuedLine {
  productId: string;
  name: string;
  quantity: number;
  discountPercent: number;
  unitPrice: number; // shown on the provisional slip only; the server uses the dealer's real price
}

export interface QueuedOrder {
  id: string; // also the server's request id
  createdAt: string;
  customerId: string;
  customerName: string;
  lines: QueuedLine[];
  notes?: string;
  estimatedTotal: number;
  status: 'QUEUED' | 'REJECTED';
  error?: string;
  attempts: number;
}

const keyFor = (orderTakerId: string) => `mysaleflo_offline_orders_${orderTakerId}`;
const sentKey = (orderTakerId: string) => `mysaleflo_offline_sent_${orderTakerId}`;

// Orders that reached the server after being taken offline: kept until the order taker dismisses them,
// so he can see the invoice number even if the app was closed when the signal came back.
export interface SentOrder {
  id: string;
  customerName: string;
  takenAt: string;
  sentAt: string;
  invoiceNumber: string;
  orderNumber?: string;
  total: number;
}

export function listSent(orderTakerId: string): SentOrder[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(sentKey(orderTakerId)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function addSent(orderTakerId: string, item: SentOrder) {
  try {
    const next = [item, ...listSent(orderTakerId).filter((x) => x.id !== item.id)].slice(0, 20);
    localStorage.setItem(sentKey(orderTakerId), JSON.stringify(next));
  } catch {
    /* the order itself is already safe on the server */
  }
  notify();
}

export function dismissSent(orderTakerId: string, id?: string) {
  try {
    const next = id ? listSent(orderTakerId).filter((x) => x.id !== id) : [];
    localStorage.setItem(sentKey(orderTakerId), JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notify();
}
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((fn) => fn());
export function onQueueChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function listQueued(orderTakerId: string): QueuedOrder[] {
  try {
    const raw = localStorage.getItem(keyFor(orderTakerId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(orderTakerId: string, items: QueuedOrder[]) {
  try {
    localStorage.setItem(keyFor(orderTakerId), JSON.stringify(items));
  } catch (e) {
    console.warn('Could not save offline orders:', e);
    throw new Error('This phone has no free storage left, so the order could not be saved.');
  }
  notify();
}

export function estimateTotal(lines: QueuedLine[]): number {
  return lines.reduce((s, l) => s + l.quantity * l.unitPrice * (1 - (l.discountPercent || 0) / 100), 0);
}

export function enqueue(orderTakerId: string, entry: Omit<QueuedOrder, 'status' | 'attempts' | 'estimatedTotal'>): QueuedOrder {
  const full: QueuedOrder = { ...entry, estimatedTotal: estimateTotal(entry.lines), status: 'QUEUED', attempts: 0 };
  save(orderTakerId, [...listQueued(orderTakerId), full]);
  return full;
}

export function discard(orderTakerId: string, id: string) {
  save(orderTakerId, listQueued(orderTakerId).filter((q) => q.id !== id));
}

// A rejected order can be tried again (for example after the dealer adds stock)
export function requeue(orderTakerId: string, id: string) {
  save(orderTakerId, listQueued(orderTakerId).map((q) => (q.id === id ? { ...q, status: 'QUEUED' as const, error: undefined } : q)));
}

// How many units of each product the waiting orders still need (so the phone does not oversell)
export function reservedQuantities(orderTakerId: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const q of listQueued(orderTakerId)) {
    if (q.status !== 'QUEUED') continue;
    for (const l of q.lines) out[l.productId] = (out[l.productId] || 0) + l.quantity;
  }
  return out;
}

export type Sender = (payload: {
  clientRequestId: string;
  orderedAt: string;
  customerId: string;
  items: { productId: string; quantity: number; discountPercent: number }[];
  notes?: string;
  paidAmount: number;
}) => Promise<unknown>;

export interface FlushResult {
  sent: number;
  rejected: number;
  stopped?: 'network' | 'signed-out' | 'busy';
}

// Sends waiting orders one by one, oldest first. Stops at the first problem that is not the order's fault.
export async function flushQueue(orderTakerId: string, send: Sender): Promise<FlushResult> {
  const result: FlushResult = { sent: 0, rejected: 0 };
  for (const q of listQueued(orderTakerId).filter((x) => x.status === 'QUEUED')) {
    try {
      const out: any = await send({
        clientRequestId: q.id,
        orderedAt: q.createdAt,
        customerId: q.customerId,
        items: q.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, discountPercent: l.discountPercent })),
        notes: q.notes,
        paidAmount: 0,
      });
      save(orderTakerId, listQueued(orderTakerId).filter((x) => x.id !== q.id));
      result.sent += 1;
      if (out?.invoice?.invoiceNumber) {
        addSent(orderTakerId, {
          id: q.id,
          customerName: q.customerName,
          takenAt: q.createdAt,
          sentAt: new Date().toISOString(),
          invoiceNumber: out.invoice.invoiceNumber,
          orderNumber: out.order?.orderNumber,
          total: Number(out.invoice.grandTotal ?? out.order?.grandTotal ?? q.estimatedTotal),
        });
      }
    } catch (e: any) {
      const status: number | undefined = e?.status;
      if (status === undefined) {
        result.stopped = 'network';
        return result;
      }
      if (status === 401) {
        result.stopped = 'signed-out';
        return result;
      }
      if (status === 429 || status >= 500) {
        result.stopped = 'busy';
        return result;
      }
      // The server understood the order and refused it (not enough stock, customer or product gone, account inactive...)
      save(
        orderTakerId,
        listQueued(orderTakerId).map((x) => (x.id === q.id ? { ...x, status: 'REJECTED' as const, error: e?.message || 'The order was refused.', attempts: x.attempts + 1 } : x))
      );
      result.rejected += 1;
    }
  }
  return result;
}
