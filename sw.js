// Service Worker for Route Stats PWA
//
// This service worker implements an offline‑first caching strategy.
// During installation the static assets defined in STATIC_ASSETS are
// pre‑cached. When fetching resources from the same origin we first
// attempt to serve them from the cache, falling back to the network
// on a miss. For cross‑origin requests we try the network first
// and fall back to the cache if the network is unavailable.

const CACHE_NAME = 'route-stats-cache-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Immediately take control after installation
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return cached;
  }
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cached = await caches.match(request);
    return cached;
  }
}

self.addEventListener('fetch', event => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  // For navigation requests (e.g. clicking links, entering a URL) use network‑first.
  // This ensures that magic‑link callbacks and other dynamic pages are fetched
  // from the network rather than served from an old cache.
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request));
    return;
  }
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin) {
    // For same‑origin subresources use cache‑first
    event.respondWith(cacheFirst(event.request));
  } else {
    // For cross‑origin requests fall back to network‑first
    event.respondWith(networkFirst(event.request));
  }
});