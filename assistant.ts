import { Persistence } from '../persist';
import { getDealerData } from '../dealerSync';
import { getOrderTakerView, DealerInfo } from '../orderTakerApi';
import { askWithLlm } from './llm';
import {
  Ctx, Dataset, Lang, Period, Role, ToolResult, DEALER_PERMS, TAKER_PERMS, TOOLS,
} from './tools';

export interface AskContext {
  role: Role;
  dealerId?: string;
  orderTakerId?: string;
  store: Persistence;
  dealers: any[]; // server dealer records (used for the dealer's own info and for Super Admin's platform view)
  now?: Date;
  tz?: string;
  mode?: 'builtin' | 'llm' | 'auto';
  llmKey?: string;
  llmModel?: string;
  fetchImpl?: typeof fetch;
}

export type AskResult =
  | { ok: true; answer: string; cards: ToolResult[]; source: 'builtin' | 'llm'; language: Lang; asOf?: string; unknown?: boolean; denied?: boolean }
  | { ok: false; status: number; error: string; code: string };

const fail = (status: number, code: string, error: string): AskResult => ({ ok: false, status, code, error });

// ---------- language ----------
const UR_WORDS = /\b(aaj|ajj|kal|kitna|kitni|kitne|kya|hai|hain|ka|ki|ke|ko|mein|mahine|mahina|maheena|maheene|bikri|bikree|baqaya|baqiya|udhaar|udhar|dikhao|batao|bataen|bataein|mujhe|sab|zyada|kam|hafta|haftay|saal|wasooli|wasuli|kharcha|munafa|nafa|dukan|dukaan|kaun|kon|nahi|nahin|wapsi|khatam|bhi|abhi|pichle|guzishta|wala|wali|wale|karkardagi|paise|raqam|khulasa|maal)\b/;
export function detectLanguage(q: string): Lang {
  return UR_WORDS.test(q.toLowerCase()) ? 'ur' : 'en';
}

const norm = (s: string) => s.toLowerCase().replace(/['’`]/g, '').replace(/[^a-z0-9\u0600-\u06ff\- ]+/g, ' ').replace(/\s+/g, ' ').trim();

// ---------- built-in understanding (English + Roman Urdu) ----------
interface Call { tool: string; args: Record<string, unknown> }
type Plan = { calls: Call[] } | { denied: string } | null;

function extractPeriod(q: string, fallback: Period): { period: Period; from?: string; to?: string } {
  const dates = q.match(/\d{4}-\d{2}-\d{2}/g);
  if (dates && dates.length >= 2) return { period: 'custom', from: dates[0], to: dates[1] };
  if (/\b(last months?|previous months?|pichle (mahine|mahina|maheene|maheena)|pichla (mahina|maheena)|guzishta (mahine|mahina))\b/.test(q)) return { period: 'last_month' };
  if (/\b(yesterdays?|kal)\b/.test(q)) return { period: 'yesterday' };
  if (/\b(this months?|months?|monthly|mahine|mahina|maheena|maheene|mahinay)\b/.test(q)) return { period: 'month' };
  if (/\b(weeks?|weekly|hafta|haftay|haftae|7 days|7 din)\b/.test(q)) return { period: 'week' };
  if (/\b(years?|yearly|saal|sal)\b/.test(q)) return { period: 'year' };
  if (/\b(all time|overall|shuru se|total sales)\b/.test(q)) return { period: 'all' };
  if (/\b(todays?|aaj|ajj|aj)\b/.test(q)) return { period: 'today' };
  return { period: fallback };
}

function extractLimit(q: string): number | undefined {
  const m = q.match(/\b(?:top|last|latest|recent|pichle|aakhri)?\s*(\d{1,2})\b/);
  return m ? Number(m[1]) : undefined;
}

function matchName(q: string, items: any[], fields: string[]): any | null {
  let best: any = null, bestLen = 0;
  for (const it of items) {
    if (it.isSoftDeleted) continue;
    for (const f of fields) {
      const name = norm(String(it[f] ?? ''));
      if (name.length >= 3 && ` ${q} `.includes(` ${name} `) && name.length > bestLen) { best = it; bestLen = name.length; }
    }
  }
  return best;
}

export function planBuiltin(question: string, ds: Dataset): Plan {
  const q = norm(question);
  const isDealer = ds.role === 'DEALER';
  const p = extractPeriod(q, 'today');
  const limit = extractLimit(q);
  const dealerOnly = (what: string): Plan => ({ denied: what });

  if (/\bstock\b/.test(q) && /(low|kam|khatam|khatm|shortage|running|reorder|ending|out of)/.test(q) || /(kam|low)\s*stock|stock\s*(kam|low)|khatam hone/.test(q)) {
    return { calls: [{ tool: 'low_stock_products', args: {} }] };
  }
  if (/pending|undelivered|not delivered|deliver\s*(nahi|nahin|baqi)/.test(q)) return { calls: [{ tool: 'pending_orders', args: { limit } }] };
  if (/outstanding|baqaya|baqiya|baqi (raqam|payment|paisa|paise)|udhaar|udhar|wasooli|wasuli|recovery|receivable|\bdues?\b|\bowe\b|owing|unpaid|payment.{0,15}(due|baqi)|paise (lene|dene)/.test(q) && !/\b(ledger|khata|statement)\b/.test(q)) {
    const cust = matchName(q, ds.customers, ['shopName', 'ownerName']);
    if (!cust) return { calls: [{ tool: 'outstanding_payments', args: { limit } }] };
  }
  if (/best.?sell|top (selling|products?|items?)|sab ?se zyada|zyada (bik|sale|bech)|most sold|bestseller|popular|sab se (acha|achha|behtareen)/.test(q) && !/(order ?taker|salesman|sales ?man)/.test(q)) {
    const per = extractPeriod(q, 'month');
    return { calls: [{ tool: 'best_selling_products', args: { ...per, limit } }] };
  }
  if (/(order ?takers?|salesmen|salesman|sales ?man|sales ?rep)/.test(q) || /karkardagi|performance/.test(q)) {
    if (!isDealer) return dealerOnly('order taker performance');
    return { calls: [{ tool: 'order_taker_performance', args: extractPeriod(q, 'month') }] };
  }
  if (/\b(returns?|wapsi|wapis|waapis)\b/.test(q)) {
    if (!isDealer) return dealerOnly('returns');
    return { calls: [{ tool: 'returns_summary', args: extractPeriod(q, 'month') }] };
  }
  if (/expenses?|kharcha|kharch|akhrajat|spending/.test(q)) {
    if (!isDealer) return dealerOnly('expenses');
    return { calls: [{ tool: 'expenses_summary', args: extractPeriod(q, 'month') }] };
  }
  if (/\b(ledger|khata|statement)\b/.test(q)) {
    if (!isDealer) return dealerOnly('the customer ledger');
    const cust = matchName(q, ds.customers, ['shopName', 'ownerName']);
    return { calls: [{ tool: 'ledger_for_customer', args: { name: cust ? cust.shopName : q.replace(/\b(ledger|khata|statement|of|ka|ki|show|dikhao|batao)\b/g, '').trim() } }] };
  }
  if (/invoices?|\bbills?\b/.test(q)) return { calls: [{ tool: 'recent_invoices', args: { limit } }] };
  if (/summary|overview|snapshot|khulasa|khulaasa|dashboard|business (kaisa|status|report)/.test(q)) return { calls: [{ tool: 'business_snapshot', args: {} }] };
  if (/profit|munafa|munafe|nafa|faida|margin/.test(q)) {
    if (!isDealer) return dealerOnly('profit and cost information');
    return { calls: [{ tool: 'sales_summary', args: extractPeriod(q, 'month') }] };
  }
  const cust = matchName(q, ds.customers, ['shopName', 'ownerName']);
  const prod = matchName(q, ds.products, ['name', 'sku']);
  const productWords = /(stock|price|qeemat|rate|bika|bikta|sold|margin)/.test(q);
  if (prod && (productWords || !cust)) return { calls: [{ tool: 'product_lookup', args: { name: prod.name } }] };
  if (cust) return { calls: [{ tool: 'customer_lookup', args: { name: cust.shopName } }] };
  if (/\b(sales?|sale|sell|sold|bikri|bikree|becha|bechi|revenue|business|orders?|kamaya|kamai)\b/.test(q)) return { calls: [{ tool: 'sales_summary', args: p }] };
  return null;
}

const HELP: Record<Lang, string> = {
  en: 'I can answer questions about your sales, orders, products and stock, customers, invoices and payments. Try: "Today\'s sales", "Low stock products", "Outstanding payments" or ask about a shop or product by name.',
  ur: 'Main aap ki bikri, orders, products aur stock, customers, invoices aur payments ke baare mein bata sakta hoon. Masalan: "Aaj ki bikri", "Kam stock wale products", "Baqaya raqam", ya kisi dukan ya product ka naam likhein.',
};
const DENIED: Record<Lang, (what: string) => string> = {
  en: (w) => `Your account does not have access to ${w}. Please ask your dealer.`,
  ur: (w) => `Aap ke account ko ${w} dekhne ki ijazat nahi. Barae meherbani apne dealer se poochhein.`,
};
const SA_REFUSAL: Record<Lang, string> = {
  en: 'For privacy, dealers\' sales, customers, stock and ledgers are not available to the Super Admin. I can help with platform information: dealers, subscriptions and expiry dates.',
  ur: 'Privacy ki wajah se dealers ki bikri, customers, stock aur khata Super Admin ko nazar nahi aate. Main platform ki maloomat bata sakta hoon: dealers, subscriptions aur expiry ki tareekhein.',
};

// ---------- Super Admin: platform-level information only ----------
export function platformSummary(dealers: any[], c: Ctx): ToolResult {
  const list = dealers.filter((d) => !d.isSoftDeleted);
  const status = (d: any) => d.subscription?.status || 'UNKNOWN';
  const by = (s: string) => list.filter((d) => status(d) === s).length;
  const today = c.now.toISOString().slice(0, 10);
  const in30 = new Date(c.now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const expiring = list.filter((d) => d.subscription?.expiryDate >= today && d.subscription?.expiryDate <= in30 && status(d) !== 'SUSPENDED')
    .sort((a, b) => String(a.subscription.expiryDate).localeCompare(String(b.subscription.expiryDate)));
  const t = (en: string, ur: string) => (c.lang === 'ur' ? ur : en);
  return {
    tool: 'platform_summary',
    title: t('Platform summary', 'Platform ka khulasa'),
    summary: t(`${list.length} dealer(s): ${by('ACTIVE')} active, ${by('EXPIRED')} expired, ${by('SUSPENDED')} suspended; ${expiring.length} expiring within 30 days.`, `${list.length} dealer(s): ${by('ACTIVE')} active, ${by('EXPIRED')} expired, ${by('SUSPENDED')} suspended; ${expiring.length} ki expiry 30 din mein hai.`),
    metrics: [
      { label: t('Dealers', 'Dealers'), value: String(list.length) },
      { label: t('Active', 'Active'), value: String(by('ACTIVE')) },
      { label: t('Expired', 'Expired'), value: String(by('EXPIRED')) },
      { label: t('Suspended', 'Suspended'), value: String(by('SUSPENDED')) },
      { label: t('Expiring in 30 days', '30 din mein expiry'), value: String(expiring.length) },
    ],
    table: expiring.length ? { columns: [t('Dealer', 'Dealer'), t('Plan', 'Plan'), t('Expires', 'Expiry')], rows: expiring.slice(0, 15).map((d) => [d.name, d.subscription.plan, d.subscription.expiryDate]) } : undefined,
  };
}

// ---------- data loading, scoped strictly to the signed-in user ----------
function loadDataset(ctx: AskContext): { ds: Dataset } | { error: AskResult } {
  if (!ctx.dealerId) return { error: fail(403, 'NO_TENANT', 'Your account is not linked to a dealer.') };
  const dealer = ctx.dealers.find((d) => d.id === ctx.dealerId);
  if (!dealer) return { error: fail(403, 'DEALER_NOT_FOUND', 'Dealer not found.') };

  if (ctx.role === 'DEALER') {
    const got = getDealerData(ctx.store, ctx.dealerId);
    if (!got.data) return { error: fail(409, 'NO_DATA', 'No saved business data yet. Add some products and customers first, then ask again.') };
    const d = got.data as Record<string, any[]> & { exportedAt?: string };
    return { ds: { role: 'DEALER', perms: DEALER_PERMS, products: d.products || [], customers: d.customers || [], orders: d.orders || [], invoices: d.invoices || [], returns: d.returns || [], ledgerEntries: d.ledgerEntries || [], expenses: d.expenses || [], orderTakers: d.orderTakers || [], asOf: d.exportedAt } };
  }
  // Order Taker: only the already-sanitised view (no cost prices, own orders only)
  const view = getOrderTakerView(ctx.store, dealer as DealerInfo, ctx.orderTakerId || '');
  if (!view.ok) return { error: fail(view.status, view.code, view.error) };
  const d = view.data as unknown as Record<string, any[]> & { exportedAt?: string };
  return { ds: { role: 'ORDER_TAKER', perms: TAKER_PERMS, products: d.products, customers: d.customers, orders: d.orders, invoices: d.invoices, returns: [], ledgerEntries: [], expenses: [], orderTakers: [], asOf: d.exportedAt } };
}

// ---------- main entry ----------
export async function askAssistant(ctx: AskContext, question: unknown): Promise<AskResult> {
  if (typeof question !== 'string' || !question.trim()) return fail(400, 'EMPTY_QUESTION', 'Please type a question.');
  const q = question.trim();
  if (q.length > 500) return fail(400, 'TOO_LONG', 'Please keep your question under 500 characters.');
  const lang = detectLanguage(q);
  const now = ctx.now || new Date();
  const c: Ctx = { now, tz: ctx.tz || 'Asia/Karachi', lang };

  if (ctx.role === 'SUPER_ADMIN') {
    const nq = norm(q);
    if (/dealers?|subscriptions?|expir|plan|platform|active|suspended|renew/.test(nq) && !/(sale|bikri|stock|customer|invoice|ledger|order|profit|munafa|expense|kharcha|baqaya)/.test(nq)) {
      const r = platformSummary(ctx.dealers, c);
      return { ok: true, answer: r.summary, cards: [r], source: 'builtin', language: lang };
    }
    return { ok: true, answer: SA_REFUSAL[lang], cards: [], source: 'builtin', language: lang, denied: true };
  }
  if (ctx.role !== 'DEALER' && ctx.role !== 'ORDER_TAKER') return fail(403, 'FORBIDDEN', 'Not allowed.');

  const loaded = loadDataset(ctx);
  if ('error' in loaded) return loaded.error;
  const ds = loaded.ds;

  // Optional language-model path (falls back to the built-in engine on any problem)
  const mode = ctx.mode || 'auto';
  if (mode !== 'builtin' && ctx.llmKey) {
    try {
      const out = await askWithLlm({ apiKey: ctx.llmKey, model: ctx.llmModel || 'claude-sonnet-5-5', question: q, ds, ctx: c, fetchImpl: ctx.fetchImpl });
      return { ok: true, answer: out.text, cards: out.results, source: 'llm', language: lang, asOf: ds.asOf };
    } catch (e) {
      console.warn('AI model unavailable, using built-in assistant:', e instanceof Error ? e.message : e);
    }
  }

  const plan = planBuiltin(q, ds);
  if (!plan) return { ok: true, answer: HELP[lang], cards: [], source: 'builtin', language: lang, asOf: ds.asOf, unknown: true };
  if ('denied' in plan) return { ok: true, answer: DENIED[lang](plan.denied), cards: [], source: 'builtin', language: lang, asOf: ds.asOf, denied: true };

  const cards: ToolResult[] = [];
  for (const call of plan.calls) {
    const def = TOOLS.find((d) => d.name === call.tool && d.roles.includes(ds.role));
    if (!def) return { ok: true, answer: DENIED[lang](call.tool.replace(/_/g, ' ')), cards: [], source: 'builtin', language: lang, denied: true };
    cards.push(def.run(ds, c, call.args));
  }
  return { ok: true, answer: cards.map((x) => x.summary).join(' '), cards, source: 'builtin', language: lang, asOf: ds.asOf };
}
