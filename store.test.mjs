import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal localStorage shim so the browser store can run under Node
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};
// Import after the shim is installed (the store reads localStorage on load)
const { store } = await import('../src/services/store.ts');
const sub = await import('../src/utils/subscription.ts');

const A = 'dealer-apex-101';
const B = 'dealer-metro-202';
const reset = () => store.resetToSeedData();

test('payment lowers balance, credits ledger, issues sequential receipts', () => {
  reset();
  const c = store.getDealerCustomers(A).find((x) => x.currentBalance > 100);
  assert.ok(c, 'seed has a customer with balance');
  const before = c.currentBalance;
  const p1 = store.recordPayment(A, { customerId: c.id, amount: 100, method: 'CASH' });
  const p2 = store.recordPayment(A, { customerId: c.id, amount: 50, method: 'BANK_TRANSFER' });
  assert.equal(p1.receiptNumber, 'RCT-00001');
  assert.equal(p2.receiptNumber, 'RCT-00002');
  const after = store.getDealerCustomers(A).find((x) => x.id === c.id);
  assert.equal(after.currentBalance, before - 150);
  const led = store.getDealerLedger(A, c.id)[0];
  assert.equal(led.referenceType, 'PAYMENT_RECEIVED');
  assert.equal(led.credit, 50);
  assert.equal(led.balance, before - 150);
});

test('payment is applied to the oldest unpaid invoice first', () => {
  reset();
  const unpaid = store
    .getDealerInvoices(A)
    .filter((i) => i.dueAmount > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (unpaid.length === 0) return; // seed has none: nothing to assert
  const inv = unpaid[0];
  const pay = Math.min(10, inv.dueAmount);
  const p = store.recordPayment(A, { customerId: inv.customerId, amount: pay, method: 'CASH' });
  const updated = store.getDealerInvoices(A).find((i) => i.id === inv.id);
  assert.equal(updated.dueAmount, inv.dueAmount - pay);
  assert.ok(p.invoiceNumbers.includes(inv.invoiceNumber));
});

test('payment rejects zero, negative, NaN and unknown customers', () => {
  reset();
  const c = store.getDealerCustomers(A)[0];
  for (const bad of [0, -5, NaN]) {
    assert.throws(() => store.recordPayment(A, { customerId: c.id, amount: bad, method: 'CASH' }));
  }
  assert.throws(() => store.recordPayment(A, { customerId: 'nope', amount: 10, method: 'CASH' }));
});

test('tenant isolation: dealer B cannot take a payment for dealer A customer', () => {
  reset();
  const c = store.getDealerCustomers(A)[0];
  assert.throws(() => store.recordPayment(B, { customerId: c.id, amount: 10, method: 'CASH' }));
  assert.equal(store.getDealerPayments(B).length, 0);
});

test('expenses are scoped per dealer and can be deleted', () => {
  reset();
  const e = store.addExpense(A, { category: 'RENT', description: 'Shop rent', amount: 25000, date: '2026-10-01' });
  assert.equal(store.getDealerExpenses(A).length, 1);
  assert.equal(store.getDealerExpenses(B).length, 0);
  store.deleteExpense(B, e.id); // wrong dealer: must not delete
  assert.equal(store.getDealerExpenses(A).length, 1);
  store.deleteExpense(A, e.id);
  assert.equal(store.getDealerExpenses(A).length, 0);
  assert.throws(() => store.addExpense(A, { category: 'OTHER', description: 'x', amount: 0 }));
});

test('reminders are logged only for own customers', () => {
  reset();
  const c = store.getDealerCustomers(A)[0];
  store.logReminder(A, { customerId: c.id, channel: 'WHATSAPP' });
  assert.equal(store.getDealerReminders(A).length, 1);
  assert.throws(() => store.logReminder(B, { customerId: c.id, channel: 'CALL' }));
});

test('order deducts stock, creates invoice + ledger debit; over-stock is rejected', () => {
  reset();
  const customer = store.getDealerCustomers(A)[0];
  const taker = store.getDealerOrderTakers(A)[0];
  const product = store.getDealerProducts(A).find((p) => p.stock > 5);
  const stockBefore = product.stock;
  const balBefore = customer.currentBalance;
  const { order, invoice } = store.confirmOrderAndGenerateInvoice(A, {
    customerId: customer.id,
    orderTakerId: taker.id,
    items: [{ productId: product.id, quantity: 2, salePrice: product.salePrice }],
    paidAmount: 0,
  });
  assert.equal(order.grandTotal, product.salePrice * 2);
  assert.equal(invoice.dueAmount, order.grandTotal);
  assert.equal(store.getDealerProducts(A).find((p) => p.id === product.id).stock, stockBefore - 2);
  assert.equal(store.getDealerCustomers(A).find((c) => c.id === customer.id).currentBalance, balBefore + order.grandTotal);
  assert.throws(() =>
    store.confirmOrderAndGenerateInvoice(A, {
      customerId: customer.id,
      orderTakerId: taker.id,
      items: [{ productId: product.id, quantity: stockBefore + 1000, salePrice: product.salePrice }],
      paidAmount: 0,
    })
  );
});

test('order cannot use another dealer\'s customer or product', () => {
  reset();
  const taker = store.getDealerOrderTakers(A)[0];
  const foreignCustomer = store.getDealerCustomers(B)[0];
  const product = store.getDealerProducts(A)[0];
  assert.throws(() =>
    store.confirmOrderAndGenerateInvoice(A, {
      customerId: foreignCustomer.id,
      orderTakerId: taker.id,
      items: [{ productId: product.id, quantity: 1, salePrice: product.salePrice }],
      paidAmount: 0,
    })
  );
});

test('sales return adds stock back and reduces customer balance', () => {
  reset();
  const customer = store.getDealerCustomers(A).find((c) => c.currentBalance > 500) || store.getDealerCustomers(A)[0];
  const product = store.getDealerProducts(A)[0];
  const stockBefore = product.stock;
  const balBefore = customer.currentBalance;
  store.processSalesReturn(A, {
    customerId: customer.id,
    productId: product.id,
    returnedQuantity: 1,
    unitRefundPrice: product.salePrice,
    reason: 'Damaged',
  });
  assert.equal(store.getDealerProducts(A).find((p) => p.id === product.id).stock, stockBefore + 1);
  assert.equal(store.getDealerCustomers(A).find((c) => c.id === customer.id).currentBalance, balBefore - product.salePrice);
  assert.throws(() =>
    store.processSalesReturn(A, { customerId: customer.id, productId: product.id, returnedQuantity: 0, unitRefundPrice: 1, reason: 'x' })
  );
});

test('subscription expiry dates and status', () => {
  assert.equal(sub.calculateExpiryDate('2026-01-15', '1_MONTH'), '2026-02-14');
  assert.equal(sub.calculateExpiryDate('2026-01-15', '1_YEAR'), '2027-01-15');
  assert.equal(sub.computeSubscriptionStatus('2020-01-01', '2020-02-01', false), 'EXPIRED');
  assert.equal(sub.computeSubscriptionStatus('2020-01-01', '2099-02-01', true), 'SUSPENDED');
});

test('backup exports only own dealer data, no passwords; restore round-trips', () => {
  reset();
  const c = store.getDealerCustomers(A)[0];
  store.recordPayment(A, { customerId: c.id, amount: 10, method: 'CASH' });
  const backup = store.exportDealerBackup(A);
  assert.ok(backup.customers.every((x) => x.dealerId === A));
  assert.ok(backup.orderTakers.every((o) => o.password === undefined));
  assert.equal(backup.payments.length, 1);
  // wipe by resetting, then restore
  store.resetToSeedData();
  assert.equal(store.getDealerPayments(A).length, 0);
  const metroBefore = store.getDealerCustomers(B).length;
  store.restoreDealerBackup(A, JSON.parse(JSON.stringify(backup)));
  assert.equal(store.getDealerPayments(A).length, 1);
  assert.equal(store.getDealerCustomers(B).length, metroBefore); // other dealer untouched
});

test('restore rejects another dealer\'s backup and foreign records', () => {
  reset();
  const backupB = JSON.parse(JSON.stringify(store.exportDealerBackup(B)));
  assert.throws(() => store.restoreDealerBackup(A, backupB));
  const backupA = JSON.parse(JSON.stringify(store.exportDealerBackup(A)));
  backupA.customers[0].dealerId = B; // tampered record
  assert.throws(() => store.restoreDealerBackup(A, backupA));
  assert.throws(() => store.restoreDealerBackup(A, { app: 'other' }));
});

test('upsertDealers adds/updates server dealers and reports changes', () => {
  reset();
  const d = { ...store.getDealerById(A), id: 'srv-1', name: 'From Server' };
  assert.equal(store.upsertDealers([d]), true);
  assert.equal(store.getDealerById('srv-1').name, 'From Server');
  assert.equal(store.upsertDealers([d]), false); // nothing changed
  assert.equal(store.upsertDealers([{ ...d, name: 'Renamed' }]), true);
  assert.equal(store.getPlatformDealers().filter((x) => x.id === 'srv-1').length, 1);
  assert.equal(store.upsertDealers([d], true), true); // replace everything with the server list
  assert.equal(store.getPlatformDealers().length, 1);
});

test('addOrderTaker can use the server-issued id', () => {
  reset();
  const ot = store.addOrderTaker(A, { id: 'ot-server-1', name: 'New', username: 'new1', email: 'n@x.pk', phone: '1', employeeCode: 'OT-009' });
  assert.equal(ot.id, 'ot-server-1');
  assert.equal(ot.employeeCode, 'OT-009');
});

// ---------- order delivery and cancellation ----------
const placeOrder = (dealer, paid = 0, qty = 2) => {
  const customer = store.getDealerCustomers(dealer)[0];
  const taker = store.getDealerOrderTakers(dealer)[0];
  const product = store.getDealerProducts(dealer).find((p) => p.stock > 10);
  const stock = product.stock;
  const balance = customer.currentBalance;
  const { order, invoice } = store.confirmOrderAndGenerateInvoice(dealer, {
    customerId: customer.id, orderTakerId: taker.id,
    items: [{ productId: product.id, quantity: qty, salePrice: product.salePrice }], paidAmount: paid,
  });
  return { customer, product, order, invoice, stock, balance };
};

test('mark delivered: only pending orders, once', () => {
  reset();
  const { order } = placeOrder(A);
  assert.equal(order.status, 'CONFIRMED');
  const done = store.markOrderDelivered(A, order.id);
  assert.equal(done.status, 'DELIVERED');
  assert.ok(done.deliveredAt);
  assert.throws(() => store.markOrderDelivered(A, order.id), /already/);
  assert.throws(() => store.cancelOrder(A, order.id, 'x'), /delivered order cannot be cancelled/);
});

test('cancel: stock restored, invoice voided, customer balance and ledger reversed', () => {
  reset();
  const { order, invoice, product, customer, stock, balance } = placeOrder(A, 0, 3);
  assert.equal(store.getDealerProducts(A).find((p) => p.id === product.id).stock, stock - 3);
  const c = store.cancelOrder(A, order.id, 'Customer changed mind');
  assert.equal(c.status, 'CANCELLED');
  assert.equal(c.cancelReason, 'Customer changed mind');
  assert.equal(store.getDealerProducts(A).find((p) => p.id === product.id).stock, stock);
  assert.equal(store.getDealerCustomers(A).find((x) => x.id === customer.id).currentBalance, balance);
  const inv = store.getDealerInvoices(A).find((i) => i.id === invoice.id);
  assert.equal(inv.cancelled, true);
  assert.equal(inv.dueAmount, 0);
  const led = store.getDealerLedger(A, customer.id)[0];
  assert.equal(led.referenceType, 'ORDER_CANCELLED');
  assert.equal(led.credit, invoice.grandTotal);
  assert.equal(led.balance, balance);
  assert.ok(store.getDealerStockTransactions(A).some((t) => t.type === 'CANCEL_RESTORE' && t.referenceId === order.id));
  assert.throws(() => store.cancelOrder(A, order.id, ''), /already cancelled/);
  assert.throws(() => store.markOrderDelivered(A, order.id), /cancelled/);
});

test('cancel keeps money already paid as customer advance', () => {
  reset();
  const { order, customer, balance } = placeOrder(A, 50, 2);
  store.cancelOrder(A, order.id, '');
  assert.equal(store.getDealerCustomers(A).find((x) => x.id === customer.id).currentBalance, balance - 50);
});

test('cancel is blocked when a sales return exists for the invoice', () => {
  reset();
  const { order, invoice, customer, product } = placeOrder(A, 0, 2);
  store.processSalesReturn(A, { customerId: customer.id, productId: product.id, returnedQuantity: 1, unitRefundPrice: product.salePrice, reason: 'Damaged', invoiceNumber: invoice.invoiceNumber });
  assert.throws(() => store.cancelOrder(A, order.id, ''), /sales return/);
});

test('another dealer cannot deliver or cancel this dealer\'s order', () => {
  reset();
  const { order } = placeOrder(A);
  assert.throws(() => store.markOrderDelivered(B, order.id), /not found/);
  assert.throws(() => store.cancelOrder(B, order.id, ''), /not found/);
  assert.equal(store.getDealerOrders(A).find((o) => o.id === order.id).status, 'CONFIRMED');
});

test('payments are never applied to a cancelled invoice', () => {
  reset();
  const { order, invoice, customer } = placeOrder(A, 0, 2);
  store.cancelOrder(A, order.id, '');
  const p = store.recordPayment(A, { customerId: customer.id, amount: 10, method: 'CASH' });
  assert.ok(!p.invoiceNumbers.includes(invoice.invoiceNumber));
});
