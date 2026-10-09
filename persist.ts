import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// Small SQLite-backed key/value store with optimistic versioning.
// Uses Node's built-in `node:sqlite` (Node 22.13+), so there is nothing extra to install.
export class Persistence {
  private db: DatabaseSync;

  constructor(file: string) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS kv (
         key TEXT PRIMARY KEY,
         value TEXT NOT NULL,
         version INTEGER NOT NULL DEFAULT 1,
         updated_at TEXT NOT NULL
       )`
    );
  }

  get(key: string): { value: string; version: number } | null {
    const row = this.db.prepare('SELECT value, version FROM kv WHERE key = ?').get(key) as
      | { value: string; version: number }
      | undefined;
    return row ? { value: row.value, version: row.version } : null;
  }

  // Unconditional write (used for the server snapshot, which only the server writes).
  set(key: string, value: string): number {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO kv (key, value, version, updated_at) VALUES (?, ?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, version = kv.version + 1, updated_at = excluded.updated_at`
      )
      .run(key, value, now);
    return this.get(key)!.version;
  }

  // Write only if the stored version equals baseVersion (0 = key must not exist yet).
  compareAndSet(
    key: string,
    baseVersion: number,
    value: string
  ): { ok: true; version: number } | { ok: false; version: number } {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.get(key);
      const currentVersion = current ? current.version : 0;
      if (currentVersion !== baseVersion) {
        this.db.exec('ROLLBACK');
        return { ok: false, version: currentVersion };
      }
      const version = this.set(key, value);
      this.db.exec('COMMIT');
      return { ok: true, version };
    } catch (e) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        /* already rolled back */
      }
      throw e;
    }
  }

  ping(): boolean {
    try {
      this.db.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  close() {
    try {
      this.db.close();
    } catch {
      /* ignore */
    }
  }
}

// ---- Server snapshot (accounts, dealers and server-side collections) ----
export const SERVER_COLLECTIONS = [
  'users',
  'dealers',
  'orderTakers',
  'customers',
  'products',
  'orders',
  'invoices',
  'stockTransactions',
  'ledgerEntries',
  'returns',
  'printerSettings',
] as const;

export function snapshotServerDb(db: Record<string, any>): string {
  const out: Record<string, unknown> = {};
  for (const k of SERVER_COLLECTIONS) out[k] = db[k];
  return JSON.stringify(out);
}

export function restoreServerDb(db: Record<string, any>, json: string): void {
  const parsed = JSON.parse(json);
  for (const k of SERVER_COLLECTIONS) {
    if (Array.isArray(parsed[k])) db[k] = parsed[k];
  }
}

// Debounced saver: coalesces bursts of writes into one disk write.
export function createSaver(save: () => void, delayMs = 500) {
  let timer: NodeJS.Timeout | null = null;
  return {
    schedule() {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        try {
          save();
        } catch (e) {
          console.error('Persist failed:', e);
        }
      }, delayMs);
      timer.unref?.();
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      try {
        save();
      } catch (e) {
        console.error('Persist failed:', e);
      }
    },
  };
}
