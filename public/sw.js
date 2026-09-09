const CACHE_NAME = 'databook-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((response) => {
        const responseForCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseForCache));
        return response;
      }).catch(() => caches.match('./index.html'));
    }),
  );
});
