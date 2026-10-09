import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
let failWrites = false;
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { if (failWrites) throw new Error('quota'); mem.set(k, String(v)); },
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};
const q = await import('../src/services/offlineQueue.ts');
const { Persistence } = await import('../src/server/persist.ts');
const sync = await import('../src/server/dealerSync.ts');
const server = await import('../src/server/orderTakerApi.ts');

const OT = 'ot1';
const line = (id, qty = 1) => ({ productId: id, name: id.toUpperCase(), quantity: qty, discountPercent: 0, unitPrice: 100 });
const add = (id, lines = [line('p1')]) => q.enqueue(OT, { id, createdAt: new Date().toISOString(), customerId: 'c1', customerName: 'ABC', lines });
const reset = () => { mem.clear(); failWrites = false; };
const netErr = () => Object.assign(new Error('offline'), {}); // no status = no signal
const httpErr = (status, message = 'refused') => Object.assign(new Error(message), { status });

test('orders are saved on the phone and survive closing the app', () => {
  reset();
  const e = add('r1', [line('p1', 2), { ...line('p2'), discountPercent: 10 }]);
  assert.equal(e.estimatedTotal, 2 * 100 + 90);
  assert.equal(q.listQueued(OT).length, 1);
  assert.equal(q.listQueued('someone-else').length, 0); // each order taker has their own queue
  assert.equal(q.listQueued(OT)[0].status, 'QUEUED');
});

test('flush sends oldest first with the request id and the real order time', async () => {
  reset();
  add('r1'); add('r2');
  const seen = [];
  const res = await q.flushQueue(OT, async (p) => { seen.push(p); });
  assert.deepEqual(seen.map((p) => p.clientRequestId), ['r1', 'r2']);
  assert.ok(seen[0].orderedAt && seen[0].items[0].productId === 'p1');
  assert.deepEqual([res.sent, res.rejected], [2, 0]);
  assert.equal(q.listQueued(OT).length, 0);
});

test('no signal: nothing is lost, sending resumes later', async () => {
  reset();
  add('r1'); add('r2'); add('r3');
  let calls = 0;
  const r1 = await q.flushQueue(OT, async () => { calls++; if (calls === 2) throw netErr(); });
  assert.equal(r1.sent, 1);
  assert.equal(r1.stopped, 'network');
  assert.deepEqual(q.listQueued(OT).map((x) => x.id), ['r2', 'r3']);
  const r2 = await q.flushQueue(OT, async () => {});
  assert.equal(r2.sent, 2);
  assert.equal(q.listQueued(OT).length, 0);
});

test('an order the server refuses is kept with the reason; others still go through', async () => {
  reset();
  add('r1'); add('r2');
  const r = await q.flushQueue(OT, async (p) => { if (p.clientRequestId === 'r1') throw httpErr(400, 'Insufficient stock'); });
  assert.deepEqual([r.sent, r.rejected], [1, 1]);
  const left = q.listQueued(OT);
  assert.equal(left.length, 1);
  assert.equal(left[0].status, 'REJECTED');
  assert.equal(left[0].error, 'Insufficient stock');
  assert.deepEqual(q.reservedQuantities(OT), {}); // a refused order no longer holds stock
  q.requeue(OT, 'r1');
  assert.equal(q.listQueued(OT)[0].status, 'QUEUED');
  assert.deepEqual(q.reservedQuantities(OT), { p1: 1 });
  q.discard(OT, 'r1');
  assert.equal(q.listQueued(OT).length, 0);
});

test('signed-out and busy server stop sending but keep the orders', async () => {
  reset();
  add('r1');
  assert.equal((await q.flushQueue(OT, async () => { throw httpErr(401); })).stopped, 'signed-out');
  assert.equal((await q.flushQueue(OT, async () => { throw httpErr(503); })).stopped, 'busy');
  assert.equal((await q.flushQueue(OT, async () => { throw httpErr(429); })).stopped, 'busy');
  assert.equal(q.listQueued(OT)[0].status, 'QUEUED');
});

test('a full phone says so instead of silently losing the order', () => {
  reset();
  failWrites = true;
  assert.throws(() => add('r1'), /no free storage/);
  failWrites = false;
});

test('lost reply: the server got the order but the phone never heard back -> still only ONE order', async () => {
  reset();
  const store = new Persistence(':memory:');
  const blob = { app: 'My Saleflo', version: 1, dealerId: 'dA',
    orderTakers: [{ id: 'ot1', dealerId: 'dA', name: 'Ali', active: true }],
    customers: [{ id: 'c1', dealerId: 'dA', shopName: 'ABC', phone: '1', address: 'x', currentBalance: 0, status: 'ACTIVE' }],
    products: [{ id: 'p1', dealerId: 'dA', name: 'Cola', sku: 'C1', unit: 'Box', buyPrice: 70, salePrice: 100, stock: 10, minStockAlert: 2, status: 'ACTIVE' }],
    orders: [], invoices: [], stockTransactions: [], ledgerEntries: [], returns: [], printerSettings: [], payments: [], expenses: [], reminders: [] };
  sync.putDealerData(store, 'dA', 0, blob);
  const dealer = { id: 'dA', name: 'Apex', phone: '1', address: 'a' };
  const takenAt = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
  q.enqueue(OT, { id: 'offline-1', createdAt: takenAt, customerId: 'c1', customerName: 'ABC', lines: [line('p1', 3)] });

  let first = true;
  const send = async (p) => {
    const r = server.createOrderForTaker(store, dealer, OT, p); // the server processes it...
    assert.equal(r.ok, true);
    if (first) { first = false; throw netErr(); }             // ...but the reply is lost
    return r;
  };
  assert.equal((await q.flushQueue(OT, send)).stopped, 'network');
  assert.equal(q.listQueued(OT).length, 1);                    // still waiting on the phone
  assert.equal((await q.flushQueue(OT, send)).sent, 1);        // sent again
  assert.equal(q.listQueued(OT).length, 0);

  const saved = sync.getDealerData(store, 'dA').data;
  assert.equal(saved.orders.length, 1);                        // one order, not two
  assert.equal(saved.products[0].stock, 7);                    // stock reduced once
  assert.equal(saved.orders[0].createdAt, takenAt);            // dated when it was really taken
});

test('an order that no longer fits the stock is refused by the server and flagged on the phone', async () => {
  reset();
  const store = new Persistence(':memory:');
  const blob = { app: 'My Saleflo', version: 1, dealerId: 'dA',
    orderTakers: [{ id: 'ot1', dealerId: 'dA', name: 'Ali', active: true }],
    customers: [{ id: 'c1', dealerId: 'dA', shopName: 'ABC', phone: '1', address: 'x', currentBalance: 0, status: 'ACTIVE' }],
    products: [{ id: 'p1', dealerId: 'dA', name: 'Cola', sku: 'C1', unit: 'Box', buyPrice: 70, salePrice: 100, stock: 2, minStockAlert: 1, status: 'ACTIVE' }],
    orders: [], invoices: [], stockTransactions: [], ledgerEntries: [], returns: [], printerSettings: [], payments: [], expenses: [], reminders: [] };
  sync.putDealerData(store, 'dA', 0, blob);
  q.enqueue(OT, { id: 'big-1', createdAt: new Date().toISOString(), customerId: 'c1', customerName: 'ABC', lines: [line('p1', 5)] });
  const r = await q.flushQueue(OT, async (p) => {
    const out = server.createOrderForTaker(store, { id: 'dA', name: 'A', phone: '1', address: 'a' }, OT, p);
    if (!out.ok) throw httpErr(out.status, out.error);
  });
  assert.equal(r.rejected, 1);
  assert.match(q.listQueued(OT)[0].error, /stock/i);
  assert.equal(sync.getDealerData(store, 'dA').data.orders.length, 0);
});

test('after sending, the order taker is shown the real invoice number until he dismisses it', async () => {
  reset();
  add('s1'); add('s2');
  await q.flushQueue(OT, async (p) => ({ order: { orderNumber: 'ORD-' + p.clientRequestId, grandTotal: 250 }, invoice: { invoiceNumber: 'INV-' + p.clientRequestId, grandTotal: 250 } }));
  const sent = q.listSent(OT);
  assert.deepEqual(sent.map((x) => x.invoiceNumber).sort(), ['INV-s1', 'INV-s2']);
  assert.equal(sent[0].total, 250);
  assert.equal(q.listQueued(OT).length, 0);
  q.dismissSent(OT, 's1');
  assert.deepEqual(q.listSent(OT).map((x) => x.invoiceNumber), ['INV-s2']);
  q.dismissSent(OT);
  assert.equal(q.listSent(OT).length, 0);
  // an order that failed to send has no invoice number and is not listed as sent
  add('s3');
  await q.flushQueue(OT, async () => { throw netErr(); });
  assert.equal(q.listSent(OT).length, 0);
  assert.equal(q.listQueued(OT).length, 1);
});
