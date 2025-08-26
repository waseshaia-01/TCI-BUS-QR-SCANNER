const CACHE_NAME = 'tci-bus-scanner-v1';
const FILES_TO_CACHE = [
  '/',                  // very important for offline index.html
  '/index.html',
  '/dashboard.html',
  '/manifest.json',
  '/BUS_IMAGE.jpg',
  '/EVENT_PASS_IMAGE.png.emf',
  '/sw.js',
  // add any CSS/JS files you use locally
];

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching files');
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch handler: offline fallback
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        return response; // return cached file if available
      }
      return fetch(event.request).catch(() => {
        // Fallback to index.html if offline
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
