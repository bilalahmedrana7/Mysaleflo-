import { store } from './store';
import { api } from './api';

// Keeps the dealer's business data on the server (versioned, conflict-safe).
// - On login: loads the latest server copy (or uploads this device's data the very first time).
// - After every change: uploads a fresh copy a moment later.
// - If another device changed the data first, the server copy is loaded and the user is told.

export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'offline' | 'conflict' | 'error';
export interface SyncState {
  status: SyncStatus;
  message: string;
  lastSavedAt?: string;
}

const versionKey = (dealerId: string) => `mysaleflo_sync_version_${dealerId}`;
const PUSH_DELAY_MS = 2000;
const RETRY_MS = 30000;

let dealerId: string | null = null;
let knownVersion = 0;
let dirty = false;
let applyingRemote = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeStore: (() => void) | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
const POLL_MS = 20000;
let state: SyncState = { status: 'idle', message: '' };
const listeners = new Set<(s: SyncState) => void>();
const remoteListeners = new Set<() => void>();

function setState(next: Partial<SyncState>) {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn(state));
}

function readVersion(id: string): number {
  try {
    return Number(localStorage.getItem(versionKey(id))) || 0;
  } catch {
    return 0;
  }
}
function writeVersion(id: string, v: number) {
  knownVersion = v;
  try {
    localStorage.setItem(versionKey(id), String(v));
  } catch {
    /* ignore */
  }
}

async function request(method: 'GET' | 'PUT', body?: unknown, knownVersionParam?: number): Promise<{ status: number; json: any }> {
  const query = knownVersionParam && knownVersionParam > 0 ? `?knownVersion=${knownVersionParam}` : '';
  const res = await fetch(`/api/dealer/sync${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${api.getToken() || ''}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON error page */
  }
  return { status: res.status, json };
}

function applyRemote(id: string, data: unknown, version: number) {
  applyingRemote = true;
  try {
    store.restoreDealerBackup(id, data);
    writeVersion(id, version);
    dirty = false;
  } finally {
    applyingRemote = false;
  }
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (dirty) void push();
  }, RETRY_MS);
}

async function push(): Promise<void> {
  if (!dealerId) return;
  const id = dealerId;
  setState({ status: 'syncing', message: 'Saving…' });
  try {
    const r = await request('PUT', { baseVersion: knownVersion, data: store.exportDealerBackup(id) });
    if (r.status === 200) {
      writeVersion(id, r.json.version);
      dirty = false;
      setState({ status: 'saved', message: 'All changes saved', lastSavedAt: new Date().toISOString() });
    } else if (r.status === 409) {
      // Another device saved first: load the server copy so nothing is silently overwritten
      await pull(true);
      setState({
        status: 'conflict',
        message: 'Data was changed on another device. The latest copy was loaded — please re-check your last entry.',
      });
    } else if (r.status === 401) {
      setState({ status: 'error', message: 'Session expired. Please log in again.' });
    } else {
      setState({ status: 'error', message: r.json?.error || 'Could not save to the server.' });
      scheduleRetry();
    }
  } catch {
    setState({ status: 'offline', message: 'Offline — changes will be saved when you reconnect.' });
    scheduleRetry();
  }
}

async function pull(force = false): Promise<void> {
  if (!dealerId) return;
  const id = dealerId;
  try {
    const r = await request('GET', undefined, force ? 0 : knownVersion);
    if (r.status === 200 && r.json?.dealer) {
      // The server decides the dealer record (name, subscription, ID)
      applyingRemote = true;
      let changed = false;
      try {
        changed = store.upsertDealers([r.json.dealer]);
      } finally {
        applyingRemote = false;
      }
      if (changed) remoteListeners.forEach((fn) => fn());
    }
    if (r.status === 200 && r.json?.unchanged) {
      if (state.status !== 'saved') setState({ status: 'saved', message: 'All changes saved' });
      return;
    }
    if (r.status !== 200) {
      setState({ status: 'error', message: r.json?.error || 'Could not load data from the server.' });
      return;
    }
    const { version, data } = r.json;
    if (!data) {
      // First time on the server: upload what this device already has
      dirty = true;
      await push();
      return;
    }
    if (force || version !== knownVersion) {
      applyRemote(id, data, version);
      remoteListeners.forEach((fn) => fn());
    }
    setState({ status: 'saved', message: 'All changes saved', lastSavedAt: new Date().toISOString() });
  } catch {
    setState({ status: 'offline', message: 'Offline — using data saved on this device.' });
  }
}

export const sync = {
  getState: () => state,
  subscribe(fn: (s: SyncState) => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  // Called after data from the server replaced the local copy (screens should refresh)
  onRemote(fn: () => void) {
    remoteListeners.add(fn);
    return () => remoteListeners.delete(fn);
  },

  async start(id: string) {
    this.stop();
    dealerId = id;
    knownVersion = readVersion(id);
    dirty = false;
    unsubscribeStore = store.subscribe(() => {
      if (applyingRemote || !dealerId) return;
      dirty = true;
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(() => void push(), PUSH_DELAY_MS);
    });
    window.addEventListener('online', onOnline);
    // Pick up orders that order takers placed (only when nothing of ours is waiting to be saved)
    pollTimer = setInterval(() => {
      if (!dirty && !pushTimer) void pull();
    }, POLL_MS);
    setState({ status: 'syncing', message: 'Loading your data…' });
    await pull();
  },

  stop() {
    if (pushTimer) clearTimeout(pushTimer);
    if (retryTimer) clearTimeout(retryTimer);
    pushTimer = retryTimer = null;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    unsubscribeStore?.();
    unsubscribeStore = null;
    window.removeEventListener('online', onOnline);
    dealerId = null;
    dirty = false;
    setState({ status: 'idle', message: '' });
  },

  // Save immediately (e.g. before the tab closes)
  async flush() {
    if (dirty) {
      if (pushTimer) clearTimeout(pushTimer);
      await push();
    }
  },
};

function onOnline() {
  if (dirty) void push();
  else void pull();
}
