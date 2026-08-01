/* App-shell offline cache for Rounds. Cache-first for the shell, falling
   back to network and re-caching what comes back. Deliberately tiny —
   this is not a full offline-data strategy, just keeps the app itself
   loadable with no connection once it's been opened once. */
const CACHE_NAME = 'rounds-shell-v1';
const SHELL_ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(resp => {
        if(resp && resp.ok){
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
