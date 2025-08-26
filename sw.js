const CACHE_NAME = 'tci-bus-scanner-v3'; // increment version
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

// External CDN libs for offline button
const EXTERNAL_LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js'
];

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
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
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Listen for offline button
self.addEventListener('message', async event => {
  if (event.data && event.data.type === 'CACHE_OFFLINE') {
    const cache = await caches.open(CACHE_NAME);
    try {
      // Cache all app files + external libs
      await cache.addAll([...FILES_TO_CACHE, ...EXTERNAL_LIBS]);
      console.log('[SW] All files cached for offline use.');

      // Notify all clients that offline mode is ready
      const clientsList = await self.clients.matchAll();
      clientsList.forEach(client =>
        client.postMessage({ type: 'OFFLINE_READY' })
      );
    } catch (err) {
      console.error('[SW] Error caching files:', err);
    }
  }
});
