import test from 'node:test';
import assert from 'node:assert/strict';

const { Persistence } = await import('../src/server/persist.ts');
const sync = await import('../src/server/dealerSync.ts');
const { askAssistant, detectLanguage } = await import('../src/server/ai/assistant.ts');

const NOW = new Date('2026-10-07T10:00:00+05:00');
const TZ = 'Asia/Karachi';
const P = (id, name, buy, sell, stock, min) => ({ id, dealerId: 'dA', name, sku: id.toUpperCase(), unit: 'Box', buyPrice: buy, salePrice: sell, stock, minStockAlert: min, status: 'ACTIVE' });
const item = (p, qty, price) => ({ productId: p.id, productName: p.name, sku: p.sku, unit: 'Box', quantity: qty, salePrice: price, discountPercent: 0, discountAmount: 0, lineTotal: qty * price });
const p1 = P('p1', 'Cola', 70, 100, 10, 2), p2 = P('p2', 'Juice', 40, 60, 1, 5), p3 = P('p3', 'Water', 10, 20, 0, 3);
const O = (id, num, at, status, cust, taker, items) => {
  const total = items.reduce((s, i) => s + i.lineTotal, 0);
  return { id, dealerId: 'dA', orderNumber: num, customerId: cust.id, customerName: cust.shopName, customerPhone: '0', orderTakerId: taker, orderTakerName: taker === 'ot1' ? 'Ali' : 'Bilal', items, subtotal: total, totalDiscount: 0, grandTotal: total, status, invoiceId: 'i' + id, createdAt: at };
};
const c1 = { id: 'c1', dealerId: 'dA', shopName: 'Ali General Store', phone: '0300-1', city: 'Karachi', currentBalance: 500, status: 'ACTIVE' };
const c2 = { id: 'c2', dealerId: 'dA', shopName: 'Bismillah Mart', phone: '0300-2', city: 'Lahore', currentBalance: 1500, status: 'ACTIVE' };
const c3 = { id: 'c3', dealerId: 'dA', shopName: 'Clear Shop', phone: '0300-3', city: 'Multan', currentBalance: 0, status: 'ACTIVE' };

const blobA = () => ({
  app: 'My Saleflo', version: 1, dealerId: 'dA',
  orderTakers: [{ id: 'ot1', dealerId: 'dA', name: 'Ali', active: true }, { id: 'ot2', dealerId: 'dA', name: 'Bilal', active: true }],
  customers: [c1, c2, c3], products: [p1, p2, p3],
  orders: [
    O('o1', 'ORD-1', '2026-10-07T09:00:00+05:00', 'CONFIRMED', c1, 'ot1', [item(p1, 2, 100), item(p2, 1, 60)]),
    O('o2', 'ORD-2', '2026-10-07T01:00:00+05:00', 'DELIVERED', c2, 'ot2', [item(p1, 1, 100)]), // 20:00 UTC the day before
    O('o3', 'ORD-3', '2026-10-02T12:00:00+05:00', 'DELIVERED', c1, 'ot1', [item(p2, 5, 60)]),
    O('o4', 'ORD-4', '2026-09-15T12:00:00+05:00', 'DELIVERED', c2, 'ot1', [item(p1, 3, 100)]),
    O('o5', 'ORD-5', '2026-10-07T08:00:00+05:00', 'CANCELLED', c1, 'ot1', [item(p1, 10, 100)]),
  ],
  invoices: [
    { id: 'io1', dealerId: 'dA', invoiceNumber: 'INV-1', orderId: 'o1', customerId: 'c1', customerName: c1.shopName, orderTakerId: 'ot1', grandTotal: 260, paidAmount: 100, dueAmount: 160, paymentStatus: 'PARTIAL', date: '2026-10-07T09:00:00+05:00' },
    { id: 'io2', dealerId: 'dA', invoiceNumber: 'INV-2', orderId: 'o2', customerId: 'c2', customerName: c2.shopName, orderTakerId: 'ot2', grandTotal: 100, paidAmount: 100, dueAmount: 0, paymentStatus: 'PAID', date: '2026-10-07T01:00:00+05:00' },
    { id: 'io5', dealerId: 'dA', invoiceNumber: 'INV-5', orderId: 'o5', customerId: 'c1', customerName: c1.shopName, orderTakerId: 'ot1', grandTotal: 1000, paidAmount: 400, dueAmount: 0, paymentStatus: 'PAID', cancelled: true, date: '2026-10-07T08:30:00+05:00' },
    { id: 'io3', dealerId: 'dA', invoiceNumber: 'INV-3', orderId: 'o3', customerId: 'c1', customerName: c1.shopName, orderTakerId: 'ot1', grandTotal: 300, paidAmount: 0, dueAmount: 300, paymentStatus: 'UNPAID', date: '2026-10-02T12:00:00+05:00' },
  ],
  stockTransactions: [], ledgerEntries: [{ id: 'l1', dealerId: 'dA', customerId: 'c1', customerName: c1.shopName, date: '2026-10-05T10:00:00+05:00', referenceType: 'PAYMENT_RECEIVED', description: 'Payment RCT-1', debit: 0, credit: 100, balance: 500 }],
  returns: [{ id: 'r1', dealerId: 'dA', returnNumber: 'RET-1', customerId: 'c2', customerName: c2.shopName, productId: 'p1', productName: 'Cola', returnedQuantity: 1, unitRefundPrice: 100, totalRefundAmount: 100, reason: 'x', date: '2026-10-07T11:00:00+05:00' }],
  printerSettings: [], payments: [],
  expenses: [{ id: 'e1', dealerId: 'dA', category: 'RENT', description: 'Rent', amount: 1000, date: '2026-10-03T12:00:00+05:00' }], reminders: [],
});
const blobB = () => ({
  ...blobA(), dealerId: 'dB',
  orderTakers: [{ id: 'otB', dealerId: 'dB', name: 'Zaid', active: true }],
  customers: [{ id: 'cb', dealerId: 'dB', shopName: 'Zeta Traders', phone: '1', city: 'Quetta', currentBalance: 777, status: 'ACTIVE' }],
  products: [{ ...p1, id: 'pb', dealerId: 'dB', name: 'Biscuit', stock: 0, minStockAlert: 4 }],
  orders: [], invoices: [], ledgerEntries: [], returns: [], expenses: [],
});
const retag = (blob, id) => {
  const out = { ...blob, dealerId: id };
  for (const k of Object.keys(out)) if (Array.isArray(out[k])) out[k] = out[k].map((r) => ({ ...r, dealerId: id }));
  return out;
};
const mk = () => {
  const store = new Persistence(':memory:');
  assert.equal(sync.putDealerData(store, 'dA', 0, retag(blobA(), 'dA')).status, 200);
  assert.equal(sync.putDealerData(store, 'dB', 0, retag(blobB(), 'dB')).status, 200);
  return store;
};
const dealers = [
  { id: 'dA', name: 'Apex', phone: '1', address: 'a', active: true, subscription: { plan: '1_YEAR', status: 'ACTIVE', startDate: '2026-01-01', expiryDate: '2026-10-20' } },
  { id: 'dB', name: 'Beta', phone: '2', address: 'b', active: true, subscription: { plan: '1_MONTH', status: 'EXPIRED', startDate: '2026-01-01', expiryDate: '2026-02-01' } },
];
const dealerCtx = (store, extra = {}) => ({ role: 'DEALER', dealerId: 'dA', store, dealers, now: NOW, tz: TZ, mode: 'builtin', ...extra });
const otCtx = (store, extra = {}) => ({ role: 'ORDER_TAKER', dealerId: 'dA', orderTakerId: 'ot1', store, dealers, now: NOW, tz: TZ, mode: 'builtin', ...extra });
const ask = (ctx, q) => askAssistant(ctx, q);
const metric = (r, label) => r.cards.flatMap((c) => c.metrics).find((m) => m.label.startsWith(label))?.value;

// ---------- accuracy ----------
test('today\'s sales: correct numbers, excludes cancelled, timezone-aware, profit net of returns', async () => {
  const r = await ask(dealerCtx(mk()), "Today's Sales");
  assert.equal(r.ok, true);
  assert.equal(metric(r, 'Orders'), '2');
  assert.equal(metric(r, 'Sales'), 'Rs 360');           // o1 260 + o2 100 (o2 is 'today' in Karachi); cancelled o5 excluded
  assert.equal(metric(r, 'Returns'), 'Rs 100');
  assert.equal(metric(r, 'Net sales'), 'Rs 260');
  assert.match(metric(r, 'Profit'), /^Rs 80$/);          // 260 - (250 - 70)
  assert.equal(metric(r, 'Collected'), 'Rs 200');
  assert.equal(metric(r, 'Still due'), 'Rs 160');
});

test('this month\'s sales', async () => {
  const r = await ask(dealerCtx(mk()), "This Month's Sales");
  assert.equal(metric(r, 'Orders'), '3');
  assert.equal(metric(r, 'Sales'), 'Rs 660');
  assert.equal(metric(r, 'Profit'), 'Rs 180');
  assert.equal(metric(r, 'Collected'), 'Rs 200');
  assert.equal(metric(r, 'Still due'), 'Rs 460');
});

test('last month and yesterday periods', async () => {
  const s = mk();
  const lm = await ask(dealerCtx(s), 'sales last month');
  assert.equal(metric(lm, 'Sales'), 'Rs 300');
  const y = await ask(dealerCtx(s), 'sales yesterday');
  assert.equal(metric(y, 'Orders'), '0');
});

test('best-selling products ranks by quantity', async () => {
  const r = await ask(dealerCtx(mk()), 'Best-Selling Products');
  const rows = r.cards[0].table.rows;
  assert.deepEqual(rows[0].slice(0, 2), ['Juice', 6]);
  assert.deepEqual(rows[1].slice(0, 2), ['Cola', 3]);
});

test('low stock, pending orders, outstanding payments, recent invoices', async () => {
  const s = mk();
  const low = await ask(dealerCtx(s), 'Low Stock Products');
  assert.equal(metric(low, 'Low stock'), '2');
  assert.equal(metric(low, 'Out of stock'), '1');
  assert.deepEqual(low.cards[0].table.rows.map((x) => x[0]), ['Water', 'Juice']);

  const pend = await ask(dealerCtx(s), 'Pending Orders');
  assert.equal(metric(pend, 'Pending orders'), '1');
  assert.equal(metric(pend, 'Total value'), 'Rs 260');

  const out = await ask(dealerCtx(s), 'Outstanding Payments');
  assert.equal(metric(out, 'Total outstanding'), 'Rs 2,000');
  assert.equal(out.cards[0].table.rows[0][0], 'Bismillah Mart');
  assert.equal(out.cards[0].table.rows[1][3], '5'); // Ali's oldest unpaid bill is 5 days old

  const inv = await ask(dealerCtx(s), 'Recent Invoices');
  assert.equal(inv.cards[0].table.rows[0][0], 'INV-1');
  assert.equal(inv.cards[0].table.rows.length, 4);
  assert.equal(inv.cards[0].table.rows[1][5], 'CANCELLED'); // shown, but clearly marked
});

test('sales summary snapshot', async () => {
  const r = await ask(dealerCtx(mk()), 'Sales Summary');
  assert.equal(metric(r, "Today's sales"), 'Rs 360 (2)');
  assert.equal(metric(r, "This month's sales"), 'Rs 660 (3)');
  assert.equal(metric(r, 'Expenses this month'), 'Rs 1,000');
  assert.equal(metric(r, 'Net profit this month'), 'Rs -820');
  assert.equal(metric(r, 'Pending orders'), '1');
});

test('customer, product, order taker, returns, expenses and ledger questions', async () => {
  const s = mk();
  const cu = await ask(dealerCtx(s), 'Ali General Store balance');
  assert.equal(cu.cards[0].title, 'Ali General Store');
  assert.equal(metric(cu, 'Balance due'), 'Rs 500');
  assert.equal(metric(cu, 'Orders (total)'), '2');
  assert.equal(metric(cu, 'Last payment'), 'Rs 100 (2026-10-05)');
  const pr = await ask(dealerCtx(s), 'cola stock and price');
  assert.equal(metric(pr, 'In stock'), '10 Box');
  assert.equal(metric(pr, 'Profit per unit'), 'Rs 30');
  const ot = await ask(dealerCtx(s), 'order taker performance this month');
  assert.deepEqual(ot.cards[0].table.rows[0].slice(0, 2), ['Ali', 2]);
  const rt = await ask(dealerCtx(s), 'returns this month');
  assert.equal(metric(rt, 'Refund value'), 'Rs 100');
  const ex = await ask(dealerCtx(s), 'expenses this month');
  assert.equal(metric(ex, 'Total expenses'), 'Rs 1,000');
  const lg = await ask(dealerCtx(s), 'ledger of Ali General Store');
  assert.equal(lg.cards[0].tool, 'ledger_for_customer');
});

test('Roman Urdu questions are understood and answered in Roman Urdu', async () => {
  const s = mk();
  assert.equal(detectLanguage('aaj ki bikri kitni hai'), 'ur');
  assert.equal(detectLanguage("today's sales"), 'en');
  const a = await ask(dealerCtx(s), 'aaj ki bikri kitni hai');
  assert.equal(a.language, 'ur');
  assert.equal(metric(a, 'Bikri'), 'Rs 360');
  assert.match(a.answer, /Aaj/);
  const b = await ask(dealerCtx(s), 'kam stock wale products dikhao');
  assert.equal(b.cards[0].tool, 'low_stock_products');
  const c = await ask(dealerCtx(s), 'baqaya raqam batao');
  assert.equal(c.cards[0].tool, 'outstanding_payments');
  const d = await ask(dealerCtx(s), 'is mahine ka munafa');
  assert.equal(d.cards[0].tool, 'sales_summary');
  assert.equal(metric(d, 'Munafa'), 'Rs 180');
  const e = await ask(dealerCtx(s), 'is mahine ka kharcha');
  assert.equal(e.cards[0].tool, 'expenses_summary');
});

test('unknown questions get help, not invented numbers', async () => {
  const r = await ask(dealerCtx(mk()), 'what is the meaning of life');
  assert.equal(r.unknown, true);
  assert.equal(r.cards.length, 0);
  const e = await ask(dealerCtx(mk()), '   ');
  assert.equal(e.ok, false);
  const long = await ask(dealerCtx(mk()), 'x'.repeat(501));
  assert.equal(long.ok, false);
});

// ---------- permissions ----------
test('order taker sees only own sales and never cost, profit, expenses or other takers', async () => {
  const s = mk();
  const sales = await ask(otCtx(s), "Today's Sales");
  assert.equal(metric(sales, 'Sales'), 'Rs 260'); // only ot1's order (o1), not Bilal's o2
  assert.equal(metric(sales, 'Profit'), undefined);
  assert.equal(metric(sales, 'Returns'), undefined);

  for (const q of ['what is my profit', 'munafa kitna hai', 'expenses this month', 'order taker performance', 'returns this month', 'ledger of Ali General Store']) {
    const r = await ask(otCtx(s), q);
    assert.equal(r.denied, true, q);
    assert.equal(r.cards.length, 0, q);
  }
  const product = await ask(otCtx(s), 'cola stock and price');
  const text = JSON.stringify(product);
  assert.equal(metric(product, 'Sale price'), 'Rs 100');
  assert.ok(!/Buy price|Profit per unit|"Rs 70"/.test(text), 'no cost information for order takers');

  const best = await ask(otCtx(s), 'best selling products');
  assert.equal(best.cards[0].table.columns.length, 3); // no profit column
  const out = await ask(otCtx(s), 'outstanding payments');
  assert.equal(out.cards[0].table.columns.length, 3);   // no ledger age column
});

test('inactive order taker is refused', async () => {
  const s = mk();
  const r = await ask(otCtx(s, { orderTakerId: 'ghost' }), "today's sales");
  assert.equal(r.ok, false);
  assert.equal(r.status, 403);
});

// ---------- dealer isolation ----------
test('dealer B only ever sees dealer B data, even when asking about dealer A', async () => {
  const s = mk();
  const ctxB = { role: 'DEALER', dealerId: 'dB', store: s, dealers, now: NOW, tz: TZ, mode: 'builtin' };
  for (const q of ['Outstanding Payments', 'show dealer Apex sales', 'Ali General Store balance', 'best selling products', 'recent invoices', 'sales summary', 'low stock']) {
    const r = await ask(ctxB, q);
    const text = JSON.stringify(r);
    assert.ok(!/Ali General Store|Bismillah|Cola|Juice|INV-1|Apex/.test(text), `leak in: ${q}`);
  }
  const out = await ask(ctxB, 'Outstanding Payments');
  assert.equal(metric(out, 'Total outstanding'), 'Rs 777');
  assert.equal(out.cards[0].table.rows[0][0], 'Zeta Traders');
  // dealer A is unaffected
  const a = await ask(dealerCtx(s), 'Outstanding Payments');
  assert.equal(metric(a, 'Total outstanding'), 'Rs 2,000');
});

test('missing or foreign tenant is refused', async () => {
  const s = mk();
  assert.equal((await ask({ role: 'DEALER', store: s, dealers, mode: 'builtin' }, 'sales')).status, 403);
  assert.equal((await ask({ role: 'DEALER', dealerId: 'nope', store: s, dealers, mode: 'builtin' }, 'sales')).status, 403);
  assert.equal((await ask({ role: 'DEALER', dealerId: 'dC', store: s, dealers: [...dealers, { id: 'dC', name: 'C' }], mode: 'builtin' }, 'sales')).status, 409);
  assert.equal((await ask({ role: 'HACKER', dealerId: 'dA', store: s, dealers }, 'sales')).ok, false);
});

test('super admin gets platform information only, never dealer business data', async () => {
  const s = mk();
  const sa = { role: 'SUPER_ADMIN', store: s, dealers, now: NOW, tz: TZ, mode: 'builtin' };
  for (const q of ['today sales of dealer Apex', 'outstanding payments', 'low stock', 'show invoices', 'profit', 'aaj ki bikri']) {
    const r = await ask(sa, q);
    assert.equal(r.denied, true, q);
    assert.equal(r.cards.length, 0, q);
  }
  const p = await ask(sa, 'how many dealers are active and which subscriptions expire soon');
  assert.equal(p.cards[0].tool, 'platform_summary');
  assert.equal(metric(p, 'Dealers'), '2');
  assert.equal(metric(p, 'Expiring in 30 days'), '1');
  assert.ok(!/Ali General|Cola|INV-/.test(JSON.stringify(p)));
});

// ---------- read-only ----------
test('the assistant never changes saved data', async () => {
  const s = mk();
  const before = sync.getDealerData(s, 'dA');
  for (const q of ["today's sales", 'delete all orders', 'set cola stock to 500', 'add expense 5000', 'record payment from Ali General Store', 'low stock', 'sales summary']) {
    await ask(dealerCtx(s), q);
    await ask(otCtx(s), q);
  }
  const after = sync.getDealerData(s, 'dA');
  assert.equal(after.version, before.version);
  assert.deepEqual(after.data, before.data);
});

// ---------- optional language model path ----------
const mockFetch = (script) => {
  const calls = [];
  const f = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, headers: init.headers, body });
    const next = script.shift();
    if (next instanceof Error) throw next;
    return { ok: true, status: 200, json: async () => next };
  };
  f.calls = calls;
  return f;
};

test('language model path: only permitted read-only tools, answer text plus verified figures', async () => {
  const s = mk();
  const f = mockFetch([
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'sales_summary', input: { period: 'today', dealerId: 'dB' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Aaj ki bikri Rs 360 hai.' }] },
  ]);
  const r = await ask(dealerCtx(s, { mode: 'auto', llmKey: 'sk-test', fetchImpl: f }), 'aaj kaisa raha kaam?');
  assert.equal(r.source, 'llm');
  assert.equal(r.answer, 'Aaj ki bikri Rs 360 hai.');
  assert.equal(metric(r, 'Bikri'), 'Rs 360'); // figures come from the tool, not the model
  assert.equal(f.calls[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(f.calls[0].headers['x-api-key'], 'sk-test');
  const names = f.calls[0].body.tools.map((t) => t.name);
  assert.ok(names.includes('sales_summary'));
  assert.ok(!names.some((n) => /delete|update|create|write|record/.test(n)), 'only read-only tools are offered');
  // the model never receives raw database contents or another dealer's id
  const sent = JSON.stringify(f.calls[1].body.messages.at(-1)); // what we returned to the model
  assert.ok(!/dB|Zeta/.test(sent));
});

test('language model path: order taker is not offered dealer-only tools and cannot call them', async () => {
  const s = mk();
  const f = mockFetch([
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'expenses_summary', input: { period: 'month' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'I do not have that information.' }] },
  ]);
  const r = await ask(otCtx(s, { mode: 'auto', llmKey: 'sk-test', fetchImpl: f }), 'what are the expenses?');
  const offered = f.calls[0].body.tools.map((t) => t.name);
  for (const forbidden of ['expenses_summary', 'returns_summary', 'order_taker_performance', 'ledger_for_customer']) assert.ok(!offered.includes(forbidden), forbidden);
  assert.equal(r.cards.length, 0);
  assert.ok(!/Rs 1,000/.test(JSON.stringify(r)));
});

test('language model failure falls back to the built-in assistant', async () => {
  const s = mk();
  const f = mockFetch([new Error('network down')]);
  const r = await ask(dealerCtx(s, { mode: 'auto', llmKey: 'sk-test', fetchImpl: f }), "Today's Sales");
  assert.equal(r.source, 'builtin');
  assert.equal(metric(r, 'Sales'), 'Rs 360');
  const none = await ask(dealerCtx(s, { mode: 'auto' }), "Today's Sales"); // no key at all
  assert.equal(none.source, 'builtin');
});

test('phrasing variations map to the right period', async () => {
  const s = mk();
  const sales = async (q) => metric(await ask(dealerCtx(s), q), 'Sales');
  assert.equal(await sales("Today's Sales"), 'Rs 360');
  assert.equal(await sales('sales today'), 'Rs 360');
  assert.equal(await sales("this month's sales"), 'Rs 660');
  assert.equal(await sales('How much did we sell this month?'), 'Rs 660');
  assert.equal(await sales('sales for the last 7 days'), 'Rs 660');
  assert.equal(await sales('sales from 2026-09-01 to 2026-09-30'), 'Rs 300');
  assert.equal(metric(await ask(dealerCtx(s), 'is mahine ki bikri'), 'Bikri'), 'Rs 660');
  assert.equal(metric(await ask(dealerCtx(s), 'pichle mahine ki bikri'), 'Bikri'), 'Rs 300');
});
