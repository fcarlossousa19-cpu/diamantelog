const CACHE_NAME = 'diamantelog-cache-v1';
const assetsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assetsToCache).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip APIs and backend functions
  if (
    url.pathname.startsWith('/api') || 
    url.pathname.includes('/node_modules') || 
    url.hostname.includes('googleapis.com') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Filter out any chrome-extensions, safari-extensions, websockets, or other schemes
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Only intercept navigate requests or local assets
  const isNavigate = event.request.mode === 'navigate';
  const isMainAsset = assetsToCache.some(path => url.pathname === path || (path !== '/' && url.pathname.endsWith(path)));

  if (!isNavigate && !isMainAsset && !url.pathname.startsWith('/assets/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return from cache if found
      if (cachedResponse) {
        return cachedResponse;
      }

      // Otherwise fetch from network
      return fetch(event.request)
        .then((networkResponse) => {
          // If valid response, save to cache and return
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((err) => {
          // Serve cached index.html for page navigation if offline
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          // Do NOT return undefined for asset failures, reject properly
          throw err;
        });
    })
  );
});
