// Bump this version on every deploy that changes cached files,
// otherwise returning visitors keep seeing the old cached version.
const CACHE_NAME = 'honduras-palpita-v5';

// NOTE: this app is a single-page app (index.html handles both views
// via JS, see #envivo / #contactenos hash routing). If you still have
// separate envivo.html / contactenos.html files in the repo, add them
// back here — otherwise leave them out, caching a 404 is wasted space.
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './img/logo.png',
  './img/honduras-palpita-logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png'
];

// Install Event - Pre-cache shell assets safely
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of ASSETS_TO_CACHE) {
        try {
          await cache.add(asset);
        } catch (e) {
          console.warn('Cache add skipped for:', asset, e);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Serve cached assets when offline, never touch the radio stream
self.addEventListener('fetch', (event) => {
  // Only handle same-origin GET requests. Never intercept the audio
  // stream, cross-origin requests (fonts, tailwind CDN, etc.) or
  // non-GET requests — trying to cache those causes silent failures
  // and, worse, can break the live stream on some browsers.
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/stream') || url.hostname.includes('sistemahost.es')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (
          !networkResponse ||
          networkResponse.status !== 200 ||
          networkResponse.type !== 'basic'
        ) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback for HTML navigation requests when fully offline
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
