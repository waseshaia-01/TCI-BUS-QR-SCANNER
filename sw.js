const CACHE_NAME = "bus-scanner-cache-v1";
const ASSETS_TO_CACHE = [
  "/", "/index.html", "/dashboard.html",
  "manifest.json",
  "BUS_IMAGE.jpg",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js"
];

// Install: cache core assets
self.addEventListener("install", event => {
  console.log("[SW] Installing and caching core assets");
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate: cleanup old caches
self.addEventListener("activate", event => {
  console.log("[SW] Activating");
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first strategy
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(resp => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, resp.clone());
          return resp;
        });
      });
    }).catch(() => {
      // Optional: fallback page if offline
      if (event.request.destination === "document") {
        return caches.match("/index.html");
      }
    })
  );
});

// Listen for offline caching request from the button
self.addEventListener("message", event => {
  if (event.data?.type === "CACHE_OFFLINE") {
    caches.open(CACHE_NAME).then(cache => {
      // Cache all known pages & assets dynamically
      const urlsToCache = ["/", "/index.html", "/dashboard.html", "manifest.json", "BUS_IMAGE.jpg"];
      urlsToCache.forEach(url => {
        fetch(url).then(resp => cache.put(url, resp));
      });
    }).then(() => {
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: "OFFLINE_READY" }));
      });
    });
  }
});
