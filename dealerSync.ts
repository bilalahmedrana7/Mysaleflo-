import { Persistence } from './persist';

// Dealer business data is stored per dealer as one versioned document.
// Order Takers never read or write this document (it contains buy prices and profit).

const DATA_KEYS = [
  'orderTakers',
  'customers',
  'products',
  'orders',
  'invoices',
  'stockTransactions',
  'ledgerEntries',
  'returns',
  'printerSettings',
  'payments',
  'expenses',
  'reminders',
] as const;

export const MAX_SYNC_BYTES = 15 * 1024 * 1024;

export const dealerKey = (dealerId: string) => `dealer-data:${dealerId}`;

export type SyncValidation = { ok: true; blob: Record<string, unknown> } | { ok: false; error: string };

export function validateDealerBlob(dealerId: string, blob: unknown): SyncValidation {
  if (!blob || typeof blob !== 'object') return { ok: false, error: 'Data must be an object.' };
  const b = blob as Record<string, any>;
  if (b.app !== 'My Saleflo' || b.version !== 1) return { ok: false, error: 'Unrecognised data format.' };
  if (b.dealerId !== dealerId) return { ok: false, error: 'Data belongs to a different dealer.' };

  const clean: Record<string, unknown> = { app: b.app, version: b.version, dealerId, exportedAt: new Date().toISOString() };
  for (const k of DATA_KEYS) {
    const arr = b[k];
    if (!Array.isArray(arr)) return { ok: false, error: `Missing "${k}".` };
    for (const rec of arr) {
      if (!rec || typeof rec !== 'object' || rec.dealerId !== dealerId) {
        return { ok: false, error: `"${k}" contains a record that does not belong to this dealer.` };
      }
    }
    // Never store plain-text passwords
    clean[k] = k === 'orderTakers' ? arr.map((r: any) => ({ ...r, password: undefined })) : arr;
  }
  return { ok: true, blob: clean };
}

export function getDealerData(store: Persistence, dealerId: string) {
  const row = store.get(dealerKey(dealerId));
  return row ? { version: row.version, data: JSON.parse(row.value) } : { version: 0, data: null };
}

export function putDealerData(store: Persistence, dealerId: string, baseVersion: unknown, data: unknown) {
  if (typeof baseVersion !== 'number' || !Number.isInteger(baseVersion) || baseVersion < 0) {
    return { status: 400 as const, body: { error: 'baseVersion must be a non-negative integer.', code: 'BAD_VERSION' } };
  }
  const v = validateDealerBlob(dealerId, data);
  if (!v.ok) return { status: 400 as const, body: { error: v.error, code: 'INVALID_DATA' } };
  const json = JSON.stringify(v.blob);
  if (Buffer.byteLength(json) > MAX_SYNC_BYTES) {
    return { status: 413 as const, body: { error: 'Data is too large to sync.', code: 'TOO_LARGE' } };
  }
  const res = store.compareAndSet(dealerKey(dealerId), baseVersion, json);
  if (!res.ok) {
    return {
      status: 409 as const,
      body: { error: 'Your data changed on another device. Latest data has been loaded.', code: 'SYNC_CONFLICT', version: res.version },
    };
  }
  return { status: 200 as const, body: { success: true, version: res.version } };
}
