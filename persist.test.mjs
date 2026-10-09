import test from 'node:test';
import assert from 'node:assert/strict';

const { Persistence, snapshotServerDb, restoreServerDb, createSaver } = await import('../src/server/persist.ts');
const sync = await import('../src/server/dealerSync.ts');

const blob = (dealerId, extra = {}) => ({
  app: 'My Saleflo',
  version: 1,
  dealerId,
  orderTakers: [{ id: 'ot1', dealerId, name: 'Ali', password: 'secret123' }],
  customers: [{ id: 'c1', dealerId }],
  products: [], orders: [], invoices: [], stockTransactions: [], ledgerEntries: [],
  returns: [], printerSettings: [], payments: [], expenses: [], reminders: [],
  ...extra,
});

test('kv set/get and versions increase', () => {
  const p = new Persistence(':memory:');
  assert.equal(p.get('a'), null);
  assert.equal(p.set('a', '1'), 1);
  assert.equal(p.set('a', '2'), 2);
  assert.deepEqual(p.get('a'), { value: '2', version: 2 });
  assert.ok(p.ping());
});

test('compareAndSet detects stale writers', () => {
  const p = new Persistence(':memory:');
  assert.deepEqual(p.compareAndSet('k', 0, 'v1'), { ok: true, version: 1 });
  assert.deepEqual(p.compareAndSet('k', 0, 'again'), { ok: false, version: 1 }); // expected absent
  assert.deepEqual(p.compareAndSet('k', 1, 'v2'), { ok: true, version: 2 });
  assert.deepEqual(p.compareAndSet('k', 1, 'stale'), { ok: false, version: 2 });
  assert.equal(p.get('k').value, 'v2');
});

test('server snapshot round-trips collections', () => {
  const src = { users: [{ id: 'u1' }], dealers: [{ id: 'd1' }], orders: [{ id: 'o1' }] };
  const json = snapshotServerDb(src);
  const dst = { users: [], dealers: [], orders: [], customers: [{ id: 'keep' }] };
  restoreServerDb(dst, json);
  assert.deepEqual(dst.users, [{ id: 'u1' }]);
  assert.deepEqual(dst.orders, [{ id: 'o1' }]);
});

test('saver coalesces writes and flush saves immediately', async () => {
  let n = 0;
  const s = createSaver(() => n++, 20);
  s.schedule(); s.schedule(); s.schedule();
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(n, 1);
  s.schedule();
  s.flush();
  assert.equal(n, 2);
});

test('dealer sync: first write, update, conflict, and read back without passwords', () => {
  const p = new Persistence(':memory:');
  assert.deepEqual(sync.getDealerData(p, 'dA'), { version: 0, data: null });
  const r1 = sync.putDealerData(p, 'dA', 0, blob('dA'));
  assert.equal(r1.status, 200); assert.equal(r1.body.version, 1);
  const r2 = sync.putDealerData(p, 'dA', 1, blob('dA'));
  assert.equal(r2.status, 200); assert.equal(r2.body.version, 2);
  const stale = sync.putDealerData(p, 'dA', 1, blob('dA'));
  assert.equal(stale.status, 409); assert.equal(stale.body.code, 'SYNC_CONFLICT'); assert.equal(stale.body.version, 2);
  const got = sync.getDealerData(p, 'dA');
  assert.equal(got.version, 2);
  assert.equal(got.data.orderTakers[0].password, undefined);
});

test('dealer sync: tenant isolation and validation', () => {
  const p = new Persistence(':memory:');
  // dealer B cannot write a document claiming to be dealer A's
  assert.equal(sync.putDealerData(p, 'dB', 0, blob('dA')).status, 400);
  // a foreign record inside the document is rejected
  assert.equal(sync.putDealerData(p, 'dA', 0, blob('dA', { customers: [{ id: 'x', dealerId: 'dB' }] })).status, 400);
  // missing collection / wrong app / bad version
  const bad = blob('dA'); delete bad.payments;
  assert.equal(sync.putDealerData(p, 'dA', 0, bad).status, 400);
  assert.equal(sync.putDealerData(p, 'dA', 0, { ...blob('dA'), app: 'x' }).status, 400);
  assert.equal(sync.putDealerData(p, 'dA', -1, blob('dA')).status, 400);
  assert.equal(sync.putDealerData(p, 'dA', 'abc', blob('dA')).status, 400);
  // each dealer's data lives under its own key
  assert.equal(sync.putDealerData(p, 'dA', 0, blob('dA')).status, 200);
  assert.deepEqual(sync.getDealerData(p, 'dB'), { version: 0, data: null });
});
