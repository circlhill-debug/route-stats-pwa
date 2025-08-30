/* Route Stats PWA Service Worker — SAFE NETWORK HANDLING
   - Caches only same-origin GET requests
   - Never intercepts Supabase (*.supabase.co) or any cross-origin requests
   - Never caches POST/PUT/PATCH/DELETE
   - Navigation fallback to cached index.html when offline
*/
const CACHE_NAME = 'route-stats-cache-v025';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k === CACHE_NAME ? null : caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Never handle non-GET (POST/PUT/etc.) — let network handle
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never handle cross-origin (e.g., Supabase) — let network handle
  if (url.origin !== self.location.origin) return;

  // For navigation requests, try network first, fallback to cached index.html
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match('./index.html');
        return cached || Response.error();
      }
    })());
    return;
  }

  // For same-origin GET assets: stale-while-revalidate
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    const fetchPromise = fetch(req).then(networkResp => {
      cache.put(req, networkResp.clone());
      return networkResp;
    }).catch(() => cached);
    return cached || fetchPromise;
  })());
});
