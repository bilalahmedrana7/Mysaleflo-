import { Persistence } from './persist';
import { dealerKey } from './dealerSync';
import { confirmOrder, OrderBook } from '../shared/orders';

// Order Takers work from a SAFE VIEW of the dealer's data (no buy prices, profit, expenses or other
// people's orders) and place orders that the SERVER confirms, so stock, invoice numbers and the
// customer ledger are always correct no matter how many phones are selling at once.

export type DealerInfo = { id: string; name: string; code?: string; phone: string; address: string; [k: string]: unknown };

const BLOB_KEYS = [
  'orderTakers', 'customers', 'products', 'orders', 'invoices', 'stockTransactions',
  'ledgerEntries', 'returns', 'printerSettings', 'payments', 'expenses', 'reminders',
] as const;

type Failure = { ok: false; status: number; error: string; code: string };

const fail = (status: number, code: string, error: string): Failure => ({ ok: false, status, code, error });

function loadBlob(store: Persistence, dealerId: string) {
  const row = store.get(dealerKey(dealerId));
  if (!row) return null;
  return { blob: JSON.parse(row.value) as Record<string, any[]> & Record<string, any>, version: row.version };
}

function findActiveTaker(blob: Record<string, any>, orderTakerId: string) {
  const ot = (blob.orderTakers || []).find((o: any) => o.id === orderTakerId && !o.isSoftDeleted);
  return ot && ot.active !== false ? ot : null;
}

export function getOrderTakerView(store: Persistence, dealer: DealerInfo, orderTakerId: string) {
  const loaded = loadBlob(store, dealer.id);
  if (!loaded) {
    return fail(409, 'DEALER_DATA_NOT_READY', 'Your dealer has not set up the data yet. Ask the dealer to open My Saleflo once, then try again.');
  }
  const { blob, version } = loaded;
  const me = findActiveTaker(blob, orderTakerId);
  if (!me) return fail(403, 'ORDER_TAKER_INACTIVE', 'Your account is not active. Please contact your dealer.');

  const products = (blob.products || [])
    .filter((p: any) => p.status === 'ACTIVE' && !p.isSoftDeleted)
    .map((p: any) => {
      // Never send cost or profit to an order taker
      const { buyPrice: _b, profitPerUnit: _p, ...safe } = p;
      return { ...safe, buyPrice: 0 };
    });

  const customers = (blob.customers || []).filter((c: any) => !c.isSoftDeleted && c.status !== 'INACTIVE');

  const data = {
    app: 'My Saleflo',
    version: 1,
    dealerId: dealer.id,
    exportedAt: new Date().toISOString(),
    orderTakers: [{ ...me, password: undefined }],
    customers,
    products,
    orders: (blob.orders || []).filter((o: any) => o.orderTakerId === orderTakerId),
    invoices: (blob.invoices || []).filter((i: any) => i.orderTakerId === orderTakerId),
    stockTransactions: [],
    ledgerEntries: [],
    returns: [],
    printerSettings: blob.printerSettings || [],
    payments: [],
    expenses: [],
    reminders: [],
  };
  return { ok: true as const, version, data };
}

// An order taken offline carries the time it was taken. Accept it only if it is plausible.
export function validOrderedAt(v: unknown, now = Date.now()): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return undefined;
  if (t > now + 5 * 60 * 1000) return undefined; // not in the future
  if (t < now - 14 * 24 * 3600 * 1000) return undefined; // not older than 14 days
  return new Date(t).toISOString();
}

export interface TakerOrderInput {
  orderedAt?: unknown;
  customerId?: unknown;
  items?: unknown;
  paidAmount?: unknown;
  notes?: unknown;
  clientRequestId?: unknown;
}

export function createOrderForTaker(store: Persistence, dealer: DealerInfo, orderTakerId: string, input: TakerOrderInput) {
  if (typeof input.customerId !== 'string' || !Array.isArray(input.items) || input.items.length === 0) {
    return fail(400, 'INVALID_ORDER', 'Choose a customer and add at least one product.');
  }
  if (input.items.length > 100) return fail(400, 'INVALID_ORDER', 'Too many items in one order.');
  const requestId = typeof input.clientRequestId === 'string' ? input.clientRequestId.slice(0, 80) : undefined;
  const notes = typeof input.notes === 'string' ? input.notes.slice(0, 500) : undefined;

  for (let attempt = 0; attempt < 5; attempt++) {
    const loaded = loadBlob(store, dealer.id);
    if (!loaded) {
      return fail(409, 'DEALER_DATA_NOT_READY', 'Your dealer has not set up the data yet. Ask the dealer to open My Saleflo once, then try again.');
    }
    const { blob, version } = loaded;
    const me = findActiveTaker(blob, orderTakerId);
    if (!me) return fail(403, 'ORDER_TAKER_INACTIVE', 'Your account is not active. Please contact your dealer.');

    // Same request sent twice (bad network, double tap) must not create two orders
    if (requestId) {
      const existing = (blob.orders || []).find((o: any) => o.clientRequestId === requestId && o.orderTakerId === orderTakerId);
      if (existing) {
        const inv = (blob.invoices || []).find((i: any) => i.id === existing.invoiceId);
        return { ok: true as const, duplicate: true, order: existing, invoice: inv };
      }
    }

    // Prices come from the dealer's catalogue — the phone cannot choose its own price
    const items: { productId: string; quantity: number; salePrice: number; discountPercent: number }[] = [];
    for (const raw of input.items as any[]) {
      const qty = Number(raw?.quantity);
      if (!raw || typeof raw.productId !== 'string' || !isFinite(qty) || qty <= 0 || qty > 1_000_000) {
        return fail(400, 'INVALID_ORDER', 'Each product needs a valid quantity.');
      }
      const product = (blob.products || []).find((p: any) => p.id === raw.productId && p.status === 'ACTIVE' && !p.isSoftDeleted);
      if (!product) return fail(400, 'PRODUCT_UNAVAILABLE', 'A product in your order is no longer available.');
      const disc = Math.min(100, Math.max(0, Number(raw.discountPercent) || 0));
      items.push({ productId: product.id, quantity: qty, salePrice: product.salePrice, discountPercent: disc });
    }

    const customer = (blob.customers || []).find((c: any) => c.id === input.customerId && !c.isSoftDeleted && c.status !== 'INACTIVE');
    if (!customer) return fail(400, 'CUSTOMER_UNAVAILABLE', 'This customer is not available.');

    const paid = Math.max(0, Number(input.paidAmount) || 0);

    let result;
    try {
      result = confirmOrder(blob as unknown as OrderBook, dealer, dealer.id, {
        customerId: customer.id,
        orderTakerId,
        items,
        paidAmount: paid,
        notes,
        clientRequestId: requestId,
        createdAt: validOrderedAt(input.orderedAt),
      });
    } catch (e) {
      return fail(400, 'ORDER_REJECTED', e instanceof Error ? e.message : 'Order could not be confirmed.');
    }

    const next: Record<string, unknown> = { ...blob, exportedAt: new Date().toISOString() };
    for (const k of BLOB_KEYS) next[k] = (result.book as any)[k] ?? blob[k];
    const saved = store.compareAndSet(dealerKey(dealer.id), version, JSON.stringify(next));
    if (saved.ok) return { ok: true as const, duplicate: false, order: result.order, invoice: result.invoice };
    // Someone else saved at the same moment: try again on the fresh data
  }
  return fail(503, 'BUSY', 'The server is busy. Please try again.');
}
