import test from 'node:test';
import assert from 'node:assert/strict';

const { Persistence } = await import('../src/server/persist.ts');
const sync = await import('../src/server/dealerSync.ts');
const api = await import('../src/server/orderTakerApi.ts');

const D = { id: 'dA', name: 'Apex', phone: '0300', address: 'Karachi' };
const base = () => ({
  app: 'My Saleflo', version: 1, dealerId: 'dA',
  orderTakers: [
    { id: 'ot1', dealerId: 'dA', name: 'Ali', active: true },
    { id: 'ot2', dealerId: 'dA', name: 'Off', active: false },
  ],
  customers: [{ id: 'c1', dealerId: 'dA', shopName: 'ABC', phone: '1', address: 'x', currentBalance: 0, status: 'ACTIVE' }],
  products: [{ id: 'p1', dealerId: 'dA', name: 'Cola', sku: 'C1', unit: 'Box', buyPrice: 70, salePrice: 100, stock: 10, minStockAlert: 2, status: 'ACTIVE' }],
  orders: [{ id: 'oX', dealerId: 'dA', orderTakerId: 'ot9', grandTotal: 5 }],
  invoices: [], stockTransactions: [], ledgerEntries: [], returns: [], printerSettings: [],
  payments: [], expenses: [{ id: 'e1', dealerId: 'dA', amount: 1 }], reminders: [],
});
const fresh = () => { const s = new Persistence(':memory:'); sync.putDealerData(s, 'dA', 0, base()); return s; };

test('order taker view hides buy price, expenses, others\' orders', () => {
  const r = api.getOrderTakerView(fresh(), D, 'ot1');
  assert.equal(r.ok, true);
  assert.equal(r.data.products[0].buyPrice, 0);
  assert.equal(r.data.products[0].profitPerUnit, undefined);
  assert.equal(r.data.expenses.length, 0);
  assert.equal(r.data.orders.length, 0); // other taker's order not visible
  assert.equal(r.data.orderTakers.length, 1);
});

test('inactive or unknown order taker is refused', () => {
  const s = fresh();
  assert.equal(api.getOrderTakerView(s, D, 'ot2').status, 403);
  assert.equal(api.getOrderTakerView(s, D, 'nobody').status, 403);
  assert.equal(api.createOrderForTaker(s, D, 'ot2', { customerId: 'c1', items: [{ productId: 'p1', quantity: 1 }] }).status, 403);
});

test('no dealer data yet gives a clear message', () => {
  const r = api.getOrderTakerView(new Persistence(':memory:'), D, 'ot1');
  assert.equal(r.status, 409);
  assert.equal(r.code, 'DEALER_DATA_NOT_READY');
});

test('order uses catalogue price (not the phone\'s), cuts stock, updates ledger and balance', () => {
  const s = fresh();
  const r = api.createOrderForTaker(s, D, 'ot1', {
    customerId: 'c1', paidAmount: 50, clientRequestId: 'req-1',
    items: [{ productId: 'p1', quantity: 3, salePrice: 1, discountPercent: 0 }], // cheating price ignored
  });
  assert.equal(r.ok, true);
  assert.equal(r.order.grandTotal, 300);
  assert.equal(r.invoice.paidAmount, 50);
  assert.equal(r.invoice.dueAmount, 250);
  const saved = sync.getDealerData(s, 'dA');
  assert.equal(saved.data.products[0].stock, 7);
  assert.equal(saved.data.customers[0].currentBalance, 250);
  assert.equal(saved.data.orders.length, 2);
  assert.equal(saved.data.orders[0].orderTakerId, 'ot1');
  assert.ok(saved.data.ledgerEntries.length >= 2);
  assert.equal(saved.version, 2);
});

test('same request twice creates only one order', () => {
  const s = fresh();
  const input = { customerId: 'c1', clientRequestId: 'dup', items: [{ productId: 'p1', quantity: 2 }] };
  const a = api.createOrderForTaker(s, D, 'ot1', input);
  const b = api.createOrderForTaker(s, D, 'ot1', input);
  assert.equal(b.duplicate, true);
  assert.equal(b.order.id, a.order.id);
  assert.equal(sync.getDealerData(s, 'dA').data.products[0].stock, 8);
});

test('bad input is rejected without changing data', () => {
  const s = fresh();
  const bad = [
    { customerId: 'c1', items: [] },
    { customerId: 'nope', items: [{ productId: 'p1', quantity: 1 }] },
    { customerId: 'c1', items: [{ productId: 'ghost', quantity: 1 }] },
    { customerId: 'c1', items: [{ productId: 'p1', quantity: 0 }] },
    { customerId: 'c1', items: [{ productId: 'p1', quantity: -5 }] },
    { customerId: 'c1', items: [{ productId: 'p1', quantity: 999 }] }, // more than stock
  ];
  for (const b of bad) assert.equal(api.createOrderForTaker(s, D, 'ot1', b).ok, false);
  assert.equal(sync.getDealerData(s, 'dA').version, 1);
});

test('discount is limited to 0-100%', () => {
  const s = fresh();
  const r = api.createOrderForTaker(s, D, 'ot1', { customerId: 'c1', items: [{ productId: 'p1', quantity: 1, discountPercent: 500 }] });
  assert.equal(r.order.grandTotal, 0);
  const r2 = api.createOrderForTaker(s, D, 'ot1', { customerId: 'c1', items: [{ productId: 'p1', quantity: 1, discountPercent: -50 }] });
  assert.equal(r2.order.grandTotal, 100);
});

test('an order taken offline keeps its real time; implausible times are ignored', () => {
  assert.equal(api.validOrderedAt('2026-10-07T04:00:00.000Z', Date.parse('2026-10-07T10:00:00Z')), '2026-10-07T04:00:00.000Z');
  const now = Date.parse('2026-10-07T10:00:00Z');
  assert.equal(api.validOrderedAt('2026-10-07T10:30:00Z', now), undefined);  // future
  assert.equal(api.validOrderedAt('2026-09-01T10:00:00Z', now), undefined);  // too old
  assert.equal(api.validOrderedAt('not a date', now), undefined);
  assert.equal(api.validOrderedAt(12345, now), undefined);
  const s = fresh();
  const at = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
  const r = api.createOrderForTaker(s, D, 'ot1', { customerId: 'c1', orderedAt: at, clientRequestId: 'off-1', items: [{ productId: 'p1', quantity: 1 }] });
  assert.equal(r.order.createdAt, at);
  assert.equal(r.invoice.date, at);
  const r2 = api.createOrderForTaker(s, D, 'ot1', { customerId: 'c1', orderedAt: '2020-01-01T00:00:00Z', clientRequestId: 'off-2', items: [{ productId: 'p1', quantity: 1 }] });
  assert.notEqual(r2.order.createdAt, '2020-01-01T00:00:00.000Z');
});
