// READ-ONLY business analytics for the AI Assistant.
// Every number the assistant shows is computed here from the saved data — nothing is estimated.

export type Role = 'DEALER' | 'ORDER_TAKER' | 'SUPER_ADMIN';
export type Lang = 'en' | 'ur'; // 'ur' = Roman Urdu

export interface Permissions {
  profit: boolean; // buy prices, profit, margins
  expenses: boolean;
  ledger: boolean;
  returns: boolean;
  takerPerformance: boolean;
}

export interface Dataset {
  role: 'DEALER' | 'ORDER_TAKER';
  perms: Permissions;
  products: any[];
  customers: any[];
  orders: any[];
  invoices: any[];
  returns: any[];
  ledgerEntries: any[];
  expenses: any[];
  orderTakers: any[];
  asOf?: string;
}

export interface Ctx {
  now: Date;
  tz: string;
  lang: Lang;
}

export interface Metric {
  label: string;
  value: string;
}
export interface ToolResult {
  tool: string;
  title: string;
  summary: string;
  metrics: Metric[];
  table?: { columns: string[]; rows: (string | number)[][] };
  notes?: string[];
}

export const DEALER_PERMS: Permissions = { profit: true, expenses: true, ledger: true, returns: true, takerPerformance: true };
export const TAKER_PERMS: Permissions = { profit: false, expenses: false, ledger: false, returns: false, takerPerformance: false };

// ---------- helpers ----------
const t = (c: Ctx, en: string, ur: string) => (c.lang === 'ur' ? ur : en);
const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const rs = (v: number) => `Rs ${Math.round(v).toLocaleString('en-US')}`;
const round1 = (v: number) => Math.round(v * 10) / 10;

export function dayKey(iso: string | Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

export type Period = 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'year' | 'all' | 'custom';
export const PERIODS: Period[] = ['today', 'yesterday', 'week', 'month', 'last_month', 'year', 'all', 'custom'];

export interface Range {
  from: string;
  to: string;
  label: string;
}

export function periodRange(period: Period, c: Ctx, from?: string, to?: string): Range {
  const today = dayKey(c.now, c.tz);
  const [y, m] = today.split('-').map(Number);
  const pad = (x: number) => String(x).padStart(2, '0');
  switch (period) {
    case 'today':
      return { from: today, to: today, label: t(c, 'Today', 'Aaj') };
    case 'yesterday': {
      const k = dayKey(new Date(c.now.getTime() - 24 * 3600 * 1000), c.tz);
      return { from: k, to: k, label: t(c, 'Yesterday', 'Kal (guzra hua)') };
    }
    case 'week':
      return { from: dayKey(new Date(c.now.getTime() - 6 * 24 * 3600 * 1000), c.tz), to: today, label: t(c, 'Last 7 days', 'Pichle 7 din') };
    case 'month':
      return { from: `${y}-${pad(m)}-01`, to: today, label: t(c, 'This month', 'Is mahine') };
    case 'last_month': {
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
      return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(last)}`, label: t(c, 'Last month', 'Pichla mahina') };
    }
    case 'year':
      return { from: `${y}-01-01`, to: today, label: t(c, 'This year', 'Is saal') };
    case 'custom': {
      const ok = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
      if (ok(from) && ok(to) && from! <= to!) return { from: from!, to: to!, label: `${from} → ${to}` };
      return periodRange('month', c);
    }
    default:
      return { from: '0000-01-01', to: '9999-12-31', label: t(c, 'All time', 'Shuru se ab tak') };
  }
}

const inRange = (iso: string, r: Range, tz: string) => {
  if (!iso) return false;
  const k = dayKey(iso, tz);
  return k >= r.from && k <= r.to;
};
const liveProducts = (ds: Dataset) => ds.products.filter((p) => !p.isSoftDeleted);
const liveCustomers = (ds: Dataset) => ds.customers.filter((x) => !x.isSoftDeleted);
const salesOrders = (ds: Dataset, r: Range, tz: string) =>
  ds.orders.filter((o) => o.status !== 'CANCELLED' && inRange(o.createdAt, r, tz));

function productCost(ds: Dataset, productId: string): number | null {
  const p = ds.products.find((x) => x.id === productId);
  return p && Number.isFinite(Number(p.buyPrice)) ? Number(p.buyPrice) : null;
}

function norm(s: unknown): string {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Finds records whose name matches what the user typed (all words of the query appear in the name)
function findByName<T extends Record<string, any>>(items: T[], query: string, fields: string[]): T[] {
  const q = norm(query);
  if (!q) return [];
  const words = q.split(' ').filter((w) => w.length >= 2);
  const exact = items.filter((it) => fields.some((f) => norm(it[f]) === q));
  if (exact.length) return exact;
  const sub = items.filter((it) => fields.some((f) => norm(it[f]).includes(q)));
  if (sub.length) return sub;
  if (!words.length) return [];
  return items.filter((it) => words.every((w) => fields.some((f) => norm(it[f]).includes(w))));
}

// ---------- core sales numbers (same rules as the Reports screen) ----------
export function computeSales(ds: Dataset, c: Ctx, r: Range) {
  const orders = salesOrders(ds, r, c.tz);
  let gross = 0, discounts = 0, cogs = 0, unknownCost = 0;
  for (const o of orders) {
    gross += n(o.grandTotal);
    discounts += n(o.totalDiscount);
    for (const it of o.items || []) {
      const cost = productCost(ds, it.productId);
      if (cost === null) unknownCost += 1;
      else cogs += cost * n(it.quantity);
    }
  }
  let returnsValue = 0, returnsCost = 0;
  if (ds.perms.returns) {
    for (const rt of ds.returns.filter((x) => inRange(x.date, r, c.tz))) {
      returnsValue += n(rt.totalRefundAmount);
      const cost = productCost(ds, rt.productId);
      if (cost !== null) returnsCost += cost * n(rt.returnedQuantity);
    }
  }
  const invoices = ds.invoices.filter((i) => !i.cancelled && inRange(i.date, r, c.tz));
  const paid = invoices.reduce((s, i) => s + n(i.paidAmount), 0);
  const due = invoices.reduce((s, i) => s + n(i.dueAmount), 0);
  const net = gross - returnsValue;
  const profit = net - (cogs - returnsCost);
  return {
    orders: orders.length, gross, discounts, returnsValue, net, profit,
    margin: net > 0 ? (profit / net) * 100 : 0,
    avg: orders.length ? gross / orders.length : 0,
    paid, due, unknownCost,
  };
}

// ---------- tools ----------
export function salesSummary(ds: Dataset, c: Ctx, a: { period?: Period; from?: string; to?: string }): ToolResult {
  const r = periodRange(a.period || 'today', c, a.from, a.to);
  const s = computeSales(ds, c, r);
  const metrics: Metric[] = [
    { label: t(c, 'Orders', 'Orders'), value: String(s.orders) },
    { label: t(c, 'Sales', 'Bikri'), value: rs(s.gross) },
  ];
  if (ds.perms.returns) {
    metrics.push({ label: t(c, 'Returns', 'Wapsi (returns)'), value: rs(s.returnsValue) });
    metrics.push({ label: t(c, 'Net sales', 'Net bikri'), value: rs(s.net) });
  }
  if (ds.perms.profit) {
    metrics.push({ label: t(c, `Profit (${round1(s.margin)}%)`, `Munafa (${round1(s.margin)}%)`), value: rs(s.profit) });
  }
  metrics.push({ label: t(c, 'Average order', 'Ausat order'), value: rs(s.avg) });
  metrics.push({ label: t(c, 'Discounts given', 'Discount diya'), value: rs(s.discounts) });
  metrics.push({ label: t(c, 'Collected on invoices', 'Invoices par wasool'), value: rs(s.paid) });
  metrics.push({ label: t(c, 'Still due on invoices', 'Invoices par baqaya'), value: rs(s.due) });
  const notes: string[] = [];
  if (ds.perms.profit && s.unknownCost > 0) {
    notes.push(t(c, `${s.unknownCost} sold item(s) have no cost price on file, so profit excludes their cost.`, `${s.unknownCost} item(s) ki cost price maujood nahi, is liye munafa mein un ki cost shamil nahi.`));
  }
  const summary =
    s.orders === 0
      ? t(c, `No sales recorded for ${r.label.toLowerCase()}.`, `${r.label} koi bikri darj nahi hui.`)
      : t(c, `${r.label}: ${s.orders} order(s) worth ${rs(s.gross)}.`, `${r.label}: ${s.orders} order(s), kul ${rs(s.gross)} ki bikri.`);
  return { tool: 'sales_summary', title: t(c, `Sales — ${r.label}`, `Bikri — ${r.label}`), summary, metrics, notes };
}

export function bestSellingProducts(ds: Dataset, c: Ctx, a: { period?: Period; limit?: number; from?: string; to?: string }): ToolResult {
  const r = periodRange(a.period || 'month', c, a.from, a.to);
  const limit = Math.min(20, Math.max(1, Math.floor(n(a.limit)) || 5));
  const m = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();
  for (const o of salesOrders(ds, r, c.tz)) {
    for (const it of o.items || []) {
      const row = m.get(it.productId) || { name: it.productName, qty: 0, revenue: 0, profit: 0 };
      row.qty += n(it.quantity);
      row.revenue += n(it.lineTotal);
      const cost = productCost(ds, it.productId);
      if (cost !== null) row.profit += n(it.lineTotal) - cost * n(it.quantity);
      m.set(it.productId, row);
    }
  }
  const rows = [...m.values()].sort((x, y) => y.qty - x.qty || y.revenue - x.revenue).slice(0, limit);
  const columns = [t(c, 'Product', 'Product'), t(c, 'Qty sold', 'Bika (qty)'), t(c, 'Revenue', 'Raqam')];
  if (ds.perms.profit) columns.push(t(c, 'Profit', 'Munafa'));
  return {
    tool: 'best_selling_products',
    title: t(c, `Best-selling products — ${r.label}`, `Sab se zyada bikne wale products — ${r.label}`),
    summary: rows.length
      ? t(c, `Top seller: ${rows[0].name} (${rows[0].qty} sold).`, `Sab se zyada bika: ${rows[0].name} (${rows[0].qty}).`)
      : t(c, 'No sales in this period.', 'Is muddat mein koi bikri nahi.'),
    metrics: [],
    table: { columns, rows: rows.map((x) => (ds.perms.profit ? [x.name, x.qty, rs(x.revenue), rs(x.profit)] : [x.name, x.qty, rs(x.revenue)])) },
  };
}

export function lowStockProducts(ds: Dataset, c: Ctx): ToolResult {
  const low = liveProducts(ds)
    .filter((p) => p.status === 'ACTIVE' && n(p.stock) <= n(p.minStockAlert))
    .sort((a, b) => n(a.stock) - n(b.stock));
  const out = low.filter((p) => n(p.stock) <= 0).length;
  return {
    tool: 'low_stock_products',
    title: t(c, 'Low stock products', 'Kam stock wale products'),
    summary: low.length
      ? t(c, `${low.length} product(s) are at or below their minimum stock (${out} out of stock).`, `${low.length} product(s) ka stock kam hai (${out} bilkul khatam).`)
      : t(c, 'All products are above their minimum stock level.', 'Tamam products ka stock theek hai.'),
    metrics: [
      { label: t(c, 'Low stock items', 'Kam stock items'), value: String(low.length) },
      { label: t(c, 'Out of stock', 'Khatam'), value: String(out) },
    ],
    table: low.length ? { columns: [t(c, 'Product', 'Product'), t(c, 'In stock', 'Stock'), t(c, 'Minimum', 'Kam az kam')], rows: low.slice(0, 25).map((p) => [p.name, `${n(p.stock)} ${p.unit || ''}`.trim(), n(p.minStockAlert)]) } : undefined,
  };
}

export function pendingOrders(ds: Dataset, c: Ctx, a: { limit?: number }): ToolResult {
  const limit = Math.min(30, Math.max(1, Math.floor(n(a.limit)) || 10));
  const pending = ds.orders.filter((o) => o.status === 'CONFIRMED').sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
  const value = pending.reduce((s, o) => s + n(o.grandTotal), 0);
  const columns = [t(c, 'Order', 'Order'), t(c, 'Customer', 'Customer'), t(c, 'Amount', 'Raqam'), t(c, 'Date', 'Tareekh')];
  if (ds.perms.takerPerformance) columns.push(t(c, 'Order taker', 'Order taker'));
  return {
    tool: 'pending_orders',
    title: t(c, 'Pending orders', 'Pending orders'),
    summary: pending.length
      ? t(c, `${pending.length} order(s) worth ${rs(value)} are confirmed but not yet delivered.`, `${pending.length} order(s), ${rs(value)} ke, confirm hain magar abhi deliver nahi hue.`)
      : t(c, 'There are no pending orders.', 'Koi pending order nahi.'),
    metrics: [
      { label: t(c, 'Pending orders', 'Pending orders'), value: String(pending.length) },
      { label: t(c, 'Total value', 'Kul raqam'), value: rs(value) },
    ],
    table: pending.length
      ? { columns, rows: pending.slice(0, limit).map((o) => { const row: (string | number)[] = [o.orderNumber, o.customerName, rs(n(o.grandTotal)), String(o.createdAt).slice(0, 10)]; if (ds.perms.takerPerformance) row.push(o.orderTakerName); return row; }) }
      : undefined,
    notes: [t(c, 'Pending means confirmed but not yet marked delivered.', 'Pending ka matlab: confirm ho chuka magar deliver nahi hua.')],
  };
}

export function outstandingPayments(ds: Dataset, c: Ctx, a: { limit?: number }): ToolResult {
  const limit = Math.min(30, Math.max(1, Math.floor(n(a.limit)) || 10));
  const owing = liveCustomers(ds).filter((x) => n(x.currentBalance) > 0).sort((x, y) => n(y.currentBalance) - n(x.currentBalance));
  const total = owing.reduce((s, x) => s + n(x.currentBalance), 0);
  const today = dayKey(c.now, c.tz);
  const age = (customerId: string): string => {
    if (!ds.perms.ledger) return '';
    const dates = ds.invoices.filter((i) => !i.cancelled && i.customerId === customerId && n(i.dueAmount) > 0).map((i) => dayKey(i.date, c.tz)).sort();
    if (!dates.length) return '-';
    const days = Math.max(0, Math.round((Date.parse(today) - Date.parse(dates[0])) / 86400000));
    return String(days);
  };
  const columns = [t(c, 'Shop', 'Dukan'), t(c, 'Phone', 'Phone'), t(c, 'Balance due', 'Baqaya')];
  if (ds.perms.ledger) columns.push(t(c, 'Oldest bill (days)', 'Purana bill (din)'));
  return {
    tool: 'outstanding_payments',
    title: t(c, 'Outstanding payments', 'Baqaya raqam'),
    summary: owing.length
      ? t(c, `${owing.length} shop(s) owe ${rs(total)} in total.`, `${owing.length} dukanon par kul ${rs(total)} baqaya hai.`)
      : t(c, 'No customer has an outstanding balance.', 'Kisi customer ka baqaya nahi.'),
    metrics: [
      { label: t(c, 'Total outstanding', 'Kul baqaya'), value: rs(total) },
      { label: t(c, 'Shops owing', 'Baqaya wali dukanein'), value: String(owing.length) },
    ],
    table: owing.length ? { columns, rows: owing.slice(0, limit).map((x) => { const row: (string | number)[] = [x.shopName, x.phone || '', rs(n(x.currentBalance))]; if (ds.perms.ledger) row.push(age(x.id)); return row; }) } : undefined,
  };
}

export function recentInvoices(ds: Dataset, c: Ctx, a: { limit?: number }): ToolResult {
  const limit = Math.min(20, Math.max(1, Math.floor(n(a.limit)) || 8));
  const list = [...ds.invoices].sort((x, y) => String(y.date).localeCompare(String(x.date))).slice(0, limit);
  return {
    tool: 'recent_invoices',
    title: t(c, 'Recent invoices', 'Haali invoices'),
    summary: list.length ? t(c, `Showing the latest ${list.length} invoice(s).`, `Aakhri ${list.length} invoice(s).`) : t(c, 'No invoices yet.', 'Abhi koi invoice nahi.'),
    metrics: [],
    table: list.length
      ? { columns: [t(c, 'Invoice', 'Invoice'), t(c, 'Customer', 'Customer'), t(c, 'Total', 'Kul'), t(c, 'Paid', 'Wasool'), t(c, 'Due', 'Baqaya'), t(c, 'Status', 'Halat'), t(c, 'Date', 'Tareekh')],
          rows: list.map((i) => [i.invoiceNumber, i.customerName, rs(n(i.grandTotal)), rs(n(i.paidAmount)), rs(n(i.dueAmount)), i.cancelled ? 'CANCELLED' : i.paymentStatus, String(i.date).slice(0, 10)]) }
      : undefined,
  };
}

export function businessSnapshot(ds: Dataset, c: Ctx): ToolResult {
  const today = computeSales(ds, c, periodRange('today', c));
  const month = computeSales(ds, c, periodRange('month', c));
  const owing = liveCustomers(ds).filter((x) => n(x.currentBalance) > 0);
  const owed = owing.reduce((s, x) => s + n(x.currentBalance), 0);
  const pending = ds.orders.filter((o) => o.status === 'CONFIRMED').length;
  const low = liveProducts(ds).filter((p) => p.status === 'ACTIVE' && n(p.stock) <= n(p.minStockAlert)).length;
  const top = bestSellingProducts(ds, c, { period: 'month', limit: 1 }).table?.rows[0];
  const metrics: Metric[] = [
    { label: t(c, "Today's sales", 'Aaj ki bikri'), value: `${rs(today.gross)} (${today.orders})` },
    { label: t(c, "This month's sales", 'Is mahine ki bikri'), value: `${rs(month.gross)} (${month.orders})` },
  ];
  if (ds.perms.profit) metrics.push({ label: t(c, 'Profit this month', 'Is mahine ka munafa'), value: rs(month.profit) });
  if (ds.perms.expenses) {
    const r = periodRange('month', c);
    const exp = ds.expenses.filter((e) => inRange(e.date, r, c.tz)).reduce((s, e) => s + n(e.amount), 0);
    metrics.push({ label: t(c, 'Expenses this month', 'Is mahine ka kharcha'), value: rs(exp) });
    metrics.push({ label: t(c, 'Net profit this month', 'Is mahine ka khalis munafa'), value: rs(month.profit - exp) });
  }
  metrics.push({ label: t(c, 'Outstanding payments', 'Baqaya raqam'), value: `${rs(owed)} (${owing.length})` });
  metrics.push({ label: t(c, 'Pending orders', 'Pending orders'), value: String(pending) });
  metrics.push({ label: t(c, 'Low stock items', 'Kam stock items'), value: String(low) });
  if (top) metrics.push({ label: t(c, 'Top product this month', 'Is mahine ka top product'), value: `${top[0]} (${top[1]})` });
  return {
    tool: 'business_snapshot',
    title: t(c, 'Sales summary', 'Bikri ka khulasa'),
    summary: t(c, `Today ${rs(today.gross)}, this month ${rs(month.gross)}; ${rs(owed)} still to collect.`, `Aaj ${rs(today.gross)}, is mahine ${rs(month.gross)}; ${rs(owed)} abhi wasool karna baqi hai.`),
    metrics,
  };
}

export function customerLookup(ds: Dataset, c: Ctx, a: { name?: string }): ToolResult {
  const found = findByName(liveCustomers(ds), String(a.name || ''), ['shopName', 'ownerName']);
  if (found.length === 0) {
    return { tool: 'customer_lookup', title: t(c, 'Customer not found', 'Customer nahi mila'), summary: t(c, `I could not find a customer matching "${a.name}".`, `"${a.name}" naam ka koi customer nahi mila.`), metrics: [] };
  }
  if (found.length > 1) {
    return { tool: 'customer_lookup', title: t(c, 'Several customers match', 'Kai customers mil gaye'), summary: t(c, 'Please type the full shop name.', 'Barae meherbani poora naam likhein.'), metrics: [], table: { columns: [t(c, 'Shop', 'Dukan'), t(c, 'City', 'Shehar')], rows: found.slice(0, 8).map((x) => [x.shopName, x.city || '']) } };
  }
  const cu = found[0];
  const orders = ds.orders.filter((o) => o.customerId === cu.id && o.status !== 'CANCELLED').sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
  const lifetime = orders.reduce((s, o) => s + n(o.grandTotal), 0);
  const metrics: Metric[] = [
    { label: t(c, 'Balance due', 'Baqaya'), value: rs(n(cu.currentBalance)) },
    { label: t(c, 'Phone', 'Phone'), value: String(cu.phone || '-') },
    { label: t(c, 'Orders (total)', 'Orders (kul)'), value: String(orders.length) },
    { label: t(c, 'Total purchases', 'Kul kharidari'), value: rs(lifetime) },
    { label: t(c, 'Last order', 'Aakhri order'), value: orders[0] ? String(orders[0].createdAt).slice(0, 10) : '-' },
  ];
  if (ds.perms.ledger) {
    const pay = ds.ledgerEntries.filter((l) => l.customerId === cu.id && l.referenceType === 'PAYMENT_RECEIVED').sort((x, y) => String(y.date).localeCompare(String(x.date)))[0];
    metrics.push({ label: t(c, 'Last payment', 'Aakhri payment'), value: pay ? `${rs(n(pay.credit))} (${String(pay.date).slice(0, 10)})` : t(c, 'none recorded', 'koi nahi') });
    if (n(cu.creditLimit) > 0) metrics.push({ label: t(c, 'Credit limit', 'Credit limit'), value: rs(n(cu.creditLimit)) });
  }
  return {
    tool: 'customer_lookup',
    title: cu.shopName,
    summary: t(c, `${cu.shopName} owes ${rs(n(cu.currentBalance))}.`, `${cu.shopName} par ${rs(n(cu.currentBalance))} baqaya hai.`),
    metrics,
    table: orders.length ? { columns: [t(c, 'Order', 'Order'), t(c, 'Amount', 'Raqam'), t(c, 'Date', 'Tareekh')], rows: orders.slice(0, 5).map((o) => [o.orderNumber, rs(n(o.grandTotal)), String(o.createdAt).slice(0, 10)]) } : undefined,
  };
}

export function productLookup(ds: Dataset, c: Ctx, a: { name?: string }): ToolResult {
  const found = findByName(liveProducts(ds), String(a.name || ''), ['name', 'sku']);
  if (found.length === 0) {
    return { tool: 'product_lookup', title: t(c, 'Product not found', 'Product nahi mila'), summary: t(c, `I could not find a product matching "${a.name}".`, `"${a.name}" naam ka koi product nahi mila.`), metrics: [] };
  }
  if (found.length > 1) {
    return { tool: 'product_lookup', title: t(c, 'Several products match', 'Kai products mil gaye'), summary: t(c, 'Please type the full product name.', 'Barae meherbani poora naam likhein.'), metrics: [], table: { columns: [t(c, 'Product', 'Product'), 'SKU'], rows: found.slice(0, 8).map((x) => [x.name, x.sku]) } };
  }
  const p = found[0];
  const month = periodRange('month', c);
  let soldQty = 0;
  for (const o of salesOrders(ds, month, c.tz)) for (const it of o.items || []) if (it.productId === p.id) soldQty += n(it.quantity);
  const metrics: Metric[] = [
    { label: t(c, 'In stock', 'Stock'), value: `${n(p.stock)} ${p.unit || ''}`.trim() },
    { label: t(c, 'Minimum stock', 'Kam az kam stock'), value: String(n(p.minStockAlert)) },
    { label: t(c, 'Sale price', 'Farokht qeemat'), value: rs(n(p.salePrice)) },
    { label: t(c, 'Sold this month', 'Is mahine bika'), value: String(soldQty) },
  ];
  if (ds.perms.profit) {
    metrics.push({ label: t(c, 'Buy price', 'Kharid qeemat'), value: rs(n(p.buyPrice)) });
    metrics.push({ label: t(c, 'Profit per unit', 'Munafa per unit'), value: rs(n(p.salePrice) - n(p.buyPrice)) });
  }
  return {
    tool: 'product_lookup',
    title: p.name,
    summary: t(c, `${p.name}: ${n(p.stock)} ${p.unit || 'units'} in stock.`, `${p.name}: stock mein ${n(p.stock)} ${p.unit || 'units'}.`),
    metrics,
    notes: n(p.stock) <= n(p.minStockAlert) ? [t(c, 'Stock is at or below the minimum level.', 'Stock kam az kam hadd par ya us se neeche hai.')] : undefined,
  };
}

export function orderTakerPerformance(ds: Dataset, c: Ctx, a: { period?: Period; from?: string; to?: string }): ToolResult {
  const r = periodRange(a.period || 'month', c, a.from, a.to);
  const m = new Map<string, { name: string; orders: number; revenue: number; shops: Set<string> }>();
  for (const o of salesOrders(ds, r, c.tz)) {
    const row = m.get(o.orderTakerId) || { name: o.orderTakerName, orders: 0, revenue: 0, shops: new Set<string>() };
    row.orders += 1; row.revenue += n(o.grandTotal); row.shops.add(o.customerId);
    m.set(o.orderTakerId, row);
  }
  for (const ot of ds.orderTakers.filter((x) => !x.isSoftDeleted)) if (!m.has(ot.id)) m.set(ot.id, { name: ot.name, orders: 0, revenue: 0, shops: new Set() });
  const rows = [...m.values()].sort((x, y) => y.revenue - x.revenue);
  return {
    tool: 'order_taker_performance',
    title: t(c, `Order taker performance — ${r.label}`, `Order takers ki karkardagi — ${r.label}`),
    summary: rows.length && rows[0].revenue > 0
      ? t(c, `Top: ${rows[0].name} with ${rs(rows[0].revenue)} from ${rows[0].orders} order(s).`, `Sab se aage: ${rows[0].name}, ${rows[0].orders} order(s) se ${rs(rows[0].revenue)}.`)
      : t(c, 'No order taker sales in this period.', 'Is muddat mein order takers ki koi bikri nahi.'),
    metrics: [],
    table: rows.length ? { columns: [t(c, 'Order taker', 'Order taker'), 'Orders', t(c, 'Shops', 'Dukanein'), t(c, 'Sales', 'Bikri'), t(c, 'Avg order', 'Ausat')], rows: rows.map((x) => [x.name, x.orders, x.shops.size, rs(x.revenue), rs(x.orders ? x.revenue / x.orders : 0)]) } : undefined,
  };
}

export function returnsSummary(ds: Dataset, c: Ctx, a: { period?: Period; from?: string; to?: string }): ToolResult {
  const r = periodRange(a.period || 'month', c, a.from, a.to);
  const list = ds.returns.filter((x) => inRange(x.date, r, c.tz)).sort((x, y) => String(y.date).localeCompare(String(x.date)));
  const value = list.reduce((s, x) => s + n(x.totalRefundAmount), 0);
  return {
    tool: 'returns_summary',
    title: t(c, `Returns — ${r.label}`, `Wapsi (returns) — ${r.label}`),
    summary: list.length ? t(c, `${list.length} return(s) worth ${rs(value)}.`, `${list.length} wapsi, kul ${rs(value)}.`) : t(c, 'No returns in this period.', 'Is muddat mein koi wapsi nahi.'),
    metrics: [{ label: t(c, 'Returns', 'Wapsi'), value: String(list.length) }, { label: t(c, 'Refund value', 'Wapsi ki raqam'), value: rs(value) }],
    table: list.length ? { columns: [t(c, 'Return', 'Return'), t(c, 'Customer', 'Customer'), t(c, 'Product', 'Product'), t(c, 'Qty', 'Qty'), t(c, 'Refund', 'Raqam')], rows: list.slice(0, 10).map((x) => [x.returnNumber, x.customerName, x.productName, n(x.returnedQuantity), rs(n(x.totalRefundAmount))]) } : undefined,
  };
}

const EXPENSE_LABELS: Record<string, [string, string]> = {
  RENT: ['Rent', 'Kiraya'], SALARY: ['Salaries', 'Tankhwah'], FUEL_TRANSPORT: ['Fuel / Transport', 'Petrol / Transport'],
  UTILITIES: ['Utilities', 'Bijli / Internet'], REPAIRS: ['Repairs', 'Marammat'], MARKETING: ['Marketing', 'Marketing'], OTHER: ['Other', 'Deegar'],
};

export function expensesSummary(ds: Dataset, c: Ctx, a: { period?: Period; from?: string; to?: string }): ToolResult {
  const r = periodRange(a.period || 'month', c, a.from, a.to);
  const list = ds.expenses.filter((e) => inRange(e.date, r, c.tz));
  const total = list.reduce((s, e) => s + n(e.amount), 0);
  const by = new Map<string, number>();
  for (const e of list) by.set(e.category, (by.get(e.category) || 0) + n(e.amount));
  const sales = computeSales(ds, c, r);
  return {
    tool: 'expenses_summary',
    title: t(c, `Expenses — ${r.label}`, `Kharcha — ${r.label}`),
    summary: t(c, `Expenses ${rs(total)}; net profit ${rs(sales.profit - total)}.`, `Kharcha ${rs(total)}; khalis munafa ${rs(sales.profit - total)}.`),
    metrics: [
      { label: t(c, 'Total expenses', 'Kul kharcha'), value: rs(total) },
      { label: t(c, 'Gross profit', 'Kul munafa'), value: rs(sales.profit) },
      { label: t(c, 'Net profit', 'Khalis munafa'), value: rs(sales.profit - total) },
    ],
    table: by.size ? { columns: [t(c, 'Category', 'Qism'), t(c, 'Amount', 'Raqam')], rows: [...by.entries()].sort((x, y) => y[1] - x[1]).map(([k, v]) => [(EXPENSE_LABELS[k] || [k, k])[c.lang === 'ur' ? 1 : 0], rs(v)]) } : undefined,
  };
}

export function ledgerForCustomer(ds: Dataset, c: Ctx, a: { name?: string }): ToolResult {
  const found = findByName(liveCustomers(ds), String(a.name || ''), ['shopName', 'ownerName']);
  if (found.length !== 1) return customerLookup(ds, c, a);
  const cu = found[0];
  const entries = ds.ledgerEntries.filter((l) => l.customerId === cu.id).sort((x, y) => String(y.date).localeCompare(String(x.date)));
  return {
    tool: 'ledger_for_customer',
    title: t(c, `Ledger — ${cu.shopName}`, `Khata — ${cu.shopName}`),
    summary: t(c, `Current balance ${rs(n(cu.currentBalance))}.`, `Maujooda baqaya ${rs(n(cu.currentBalance))}.`),
    metrics: [{ label: t(c, 'Balance due', 'Baqaya'), value: rs(n(cu.currentBalance)) }],
    table: entries.length ? { columns: [t(c, 'Date', 'Tareekh'), t(c, 'Details', 'Tafseel'), t(c, 'Debit', 'Debit'), t(c, 'Credit', 'Credit'), t(c, 'Balance', 'Baqaya')], rows: entries.slice(0, 10).map((l) => [String(l.date).slice(0, 10), l.description, rs(n(l.debit)), rs(n(l.credit)), rs(n(l.balance))]) } : undefined,
  };
}

// ---------- registry: which role may use which tool ----------
export interface ToolDef {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  roles: ('DEALER' | 'ORDER_TAKER')[];
  run: (ds: Dataset, c: Ctx, a: any) => ToolResult;
}

const periodProp = { type: 'string', enum: PERIODS, description: 'Time period. Use "custom" with from/to (YYYY-MM-DD).' };
const dateProps = { from: { type: 'string', description: 'Start date YYYY-MM-DD (custom period)' }, to: { type: 'string', description: 'End date YYYY-MM-DD (custom period)' } };
const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, additionalProperties: false });

export const TOOLS: ToolDef[] = [
  { name: 'sales_summary', description: 'Sales totals (orders, sales, average, collected/due, and profit/returns when permitted) for a period.', schema: obj({ period: periodProp, ...dateProps }), roles: ['DEALER', 'ORDER_TAKER'], run: salesSummary },
  { name: 'best_selling_products', description: 'Top selling products by quantity for a period.', schema: obj({ period: periodProp, limit: { type: 'integer' }, ...dateProps }), roles: ['DEALER', 'ORDER_TAKER'], run: bestSellingProducts },
  { name: 'low_stock_products', description: 'Products at or below their minimum stock level.', schema: obj({}), roles: ['DEALER', 'ORDER_TAKER'], run: (d, c) => lowStockProducts(d, c) },
  { name: 'pending_orders', description: 'Orders that are confirmed but not yet delivered.', schema: obj({ limit: { type: 'integer' } }), roles: ['DEALER', 'ORDER_TAKER'], run: pendingOrders },
  { name: 'outstanding_payments', description: 'Customers with unpaid balances, largest first.', schema: obj({ limit: { type: 'integer' } }), roles: ['DEALER', 'ORDER_TAKER'], run: outstandingPayments },
  { name: 'recent_invoices', description: 'The latest invoices.', schema: obj({ limit: { type: 'integer' } }), roles: ['DEALER', 'ORDER_TAKER'], run: recentInvoices },
  { name: 'business_snapshot', description: 'A one-screen summary: today, this month, receivables, pending orders, low stock.', schema: obj({}), roles: ['DEALER', 'ORDER_TAKER'], run: (d, c) => businessSnapshot(d, c) },
  { name: 'customer_lookup', description: 'Details of one customer/shop by name: balance, orders, last order.', schema: obj({ name: { type: 'string' } }), roles: ['DEALER', 'ORDER_TAKER'], run: customerLookup },
  { name: 'product_lookup', description: 'Details of one product by name: stock, price, sold this month.', schema: obj({ name: { type: 'string' } }), roles: ['DEALER', 'ORDER_TAKER'], run: productLookup },
  { name: 'order_taker_performance', description: 'Sales per order taker for a period (dealer only).', schema: obj({ period: periodProp, ...dateProps }), roles: ['DEALER'], run: orderTakerPerformance },
  { name: 'returns_summary', description: 'Sales returns for a period (dealer only).', schema: obj({ period: periodProp, ...dateProps }), roles: ['DEALER'], run: returnsSummary },
  { name: 'expenses_summary', description: 'Expenses by category and net profit for a period (dealer only).', schema: obj({ period: periodProp, ...dateProps }), roles: ['DEALER'], run: expensesSummary },
  { name: 'ledger_for_customer', description: 'Recent ledger entries of one customer (dealer only).', schema: obj({ name: { type: 'string' } }), roles: ['DEALER'], run: ledgerForCustomer },
];

export const toolsForRole = (role: 'DEALER' | 'ORDER_TAKER') => TOOLS.filter((x) => x.roles.includes(role));
