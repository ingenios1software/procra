// This is a basic service worker for caching static assets.
// It uses a "cache-first" strategy for performance.

const CACHE_NAME = 'crapro95-cache-v1';
const urlsToCache = [
  '/',
  '/dashboard',
  '/eventos',
  '/parcelas',
  '/zafras',
  '/stock',
  '/offline.html' // A fallback page
];

// Install the service worker and cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Cache core assets without blocking installation on individual failures
        fetch('/_next/static/chunks/app-pages-internals.js').then(response => {
            if (response.ok) {
                const assetManifestUrl = response.headers.get('x-next-asset-manifest-url');
                if (assetManifestUrl) {
                    fetch(assetManifestUrl).then(res => res.json()).then(manifest => {
                        const assetsToCache = Object.values(manifest);
                        cache.addAll(assetsToCache);
                    });
                }
            }
        });
        return cache.addAll(urlsToCache);
      })
  );
});

// Serve cached content when offline
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // First, try to use the navigation preload response if it's supported.
          const preloadResponse = await event.preloadResponse;
          if (preloadResponse) {
            return preloadResponse;
          }

          // Always try the network first for navigation requests.
          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch (error) {
          // catch is only triggered if an exception is thrown, which is likely a network error.
          // If fetch() returns a valid HTTP response with a 4xx or 5xx status, the catch() will NOT be called.
          console.log('Fetch failed; returning offline page instead.', error);

          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(event.request.url);
          if (cachedResponse) return cachedResponse;
          
          // If the page is not in cache, return a fallback page
          const fallbackResponse = await cache.match('/offline.html');
          return fallbackResponse;
        }
      })()
    );
  } else {
     event.respondWith(
        caches.match(event.request).then((response) => {
          return response || fetch(event.request);
        })
      );
  }
});
