/* My Saleflo service worker: lets the app open and run with no signal.
   - App files (pages, scripts, styles): saved on first visit, refreshed in the background.
   - /api/ calls are never cached here; the app keeps its own saved copy of the data. */
const VERSION = 'v1';
const CACHE = 'saleflo-app-' + VERSION;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon.svg'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('saleflo-app-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // fonts etc.: let the browser handle them
  if (url.pathname.startsWith('/api/')) return; // data is never served from here

  // Opening the app: try the network briefly, otherwise use the saved copy (weak signal counts as no signal)
  if (req.mode === 'navigate') {
    event.respondWith(
      withTimeout(fetch(req), 4000)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || new Response('You are offline.', { status: 503 })))
    );
    return;
  }

  // Scripts, styles, images: saved copy first, updated in the background
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});
