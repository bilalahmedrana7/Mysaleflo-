import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};
const { store } = await import('../src/services/store.ts');
const { Persistence } = await import('../src/server/persist.ts');
const sync = await import('../src/server/dealerSync.ts');
const api = await import('../src/server/orderTakerApi.ts');

const A = 'dealer-apex-101';

test('end to end: dealer saves -> order taker orders on server -> dealer sees it', () => {
  store.resetToSeedData();
  const server = new Persistence(':memory:');
  const dealer = store.getDealerById(A);

  // Dealer creates an order taker (id issued by the server) and the dealer's data is saved
  store.addOrderTaker(A, { id: 'ot-srv-1', name: 'Field Ali', username: 'ali', email: 'ali@x.pk', phone: '0300', employeeCode: 'OT-777' });
  assert.equal(sync.putDealerData(server, A, 0, store.exportDealerBackup(A)).status, 200);

  // Order taker's phone gets the safe view
  const view = api.getOrderTakerView(server, dealer, 'ot-srv-1');
  assert.equal(view.ok, true);
  assert.ok(view.data.products.every((p) => p.buyPrice === 0));
  assert.equal(view.data.orderTakers[0].id, 'ot-srv-1');

  const customer = view.data.customers[0];
  const product = view.data.products.find((p) => p.stock >= 3);
  const before = store.getDealerProducts(A).find((p) => p.id === product.id).stock;

  // Order taker orders (server confirms it)
  const res = api.createOrderForTaker(server, dealer, 'ot-srv-1', {
    customerId: customer.id,
    items: [{ productId: product.id, quantity: 2 }],
    clientRequestId: 'phone-1',
  });
  assert.equal(res.ok, true);
  assert.match(res.invoice.invoiceNumber, /^INV-/);

  // Dealer's next refresh loads the server copy and sees everything
  const latest = sync.getDealerData(server, A);
  assert.equal(latest.version, 2);
  store.restoreDealerBackup(A, latest.data);
  assert.equal(store.getDealerProducts(A).find((p) => p.id === product.id).stock, before - 2);
  const seen = store.getDealerOrders(A).find((o) => o.id === res.order.id);
  assert.equal(seen.orderTakerId, 'ot-srv-1');
  assert.ok(store.getDealerLedger(A, customer.id).some((l) => l.invoiceNo === res.invoice.invoiceNumber));

  // If the dealer had unsaved edits based on the old version, saving is refused (not overwritten)
  const stale = sync.putDealerData(server, A, 1, store.exportDealerBackup(A));
  assert.equal(stale.status, 409);

  // The order taker's phone view only holds that person's own orders
  const view2 = api.getOrderTakerView(server, dealer, 'ot-srv-1');
  assert.ok(view2.data.orders.every((o) => o.orderTakerId === 'ot-srv-1'));
  // and it loads cleanly into a phone's store
  store.restoreDealerBackup(A, view2.data);
});
