import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { Persistence, snapshotServerDb, restoreServerDb } = await import('../src/server/persist.ts');
const sync = await import('../src/server/dealerSync.ts');

test('data survives a restart (file-backed database)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saleflo-'));
  const file = path.join(dir, 'nested', 'saleflo.db');
  try {
    const a = new Persistence(file);
    a.set('server-snapshot', snapshotServerDb({ users: [{ id: 'u1', username: 'boss' }], dealers: [{ id: 'd1' }] }));
    const blob = { app: 'My Saleflo', version: 1, dealerId: 'd1' };
    for (const k of ['orderTakers','customers','products','orders','invoices','stockTransactions','ledgerEntries','returns','printerSettings','payments','expenses','reminders']) blob[k] = [];
    blob.customers = [{ id: 'c1', dealerId: 'd1', shopName: 'ABC' }];
    assert.equal(sync.putDealerData(a, 'd1', 0, blob).status, 200);
    a.close(); // "server stops"

    const b = new Persistence(file); // "server starts again"
    const db = { users: [], dealers: [] };
    restoreServerDb(db, b.get('server-snapshot').value);
    assert.equal(db.users[0].username, 'boss');
    const got = sync.getDealerData(b, 'd1');
    assert.equal(got.version, 1);
    assert.equal(got.data.customers[0].shopName, 'ABC');
    b.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
