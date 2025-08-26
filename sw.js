const CACHE_NAME = 'tci-bus-scanner-v2'; // increment version
const FILES_TO_CACHE = [
  '/',                  
  '/index.html',
  '/dashboard.html',
  '/manifest.json',
  '/BUS_IMAGE.jpg',
  '/EVENT_PASS_IMAGE.png.emf',
  '/sw.js',
  // Local JS libraries
  '/libs/firebase-app.js',
  '/libs/firebase-firestore.js',
  '/libs/html5-qrcode.min.js',
  '/libs/xlsx.full.min.js',
  '/libs/jspdf.umd.min.js',
  '/libs/qrcode.min.js',
  '/libs/jszip.min.js',
  '/libs/FileSaver.min.js'
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
      if (response) return response;

      return fetch(event.request).catch(() => {
        // Fallback to index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Optional: Listen to a message from dashboard to cache all files on demand
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CACHE_OFFLINE') {
    caches.open(CACHE_NAME).then(cache => {
      cache.addAll(FILES_TO_CACHE).then(() => {
        console.log('[SW] All files cached for offline mode');
      });
    });
  }
});
