const CACHE_NAME = "bus-scanner-cache-v1";
const OFFLINE_QUEUE = "offline-scans";

// List of assets to cache
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/dashboard.html",
  "/scanner.js",
  "/dashboard.js",
  "/style.css",
  "/favicon.ico",
  // External libraries
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js",
  "https://cdn.jsdelivr.net/npm/face-api.js"
];

// Install Service Worker and cache assets
self.addEventListener("install", event => {
  console.log("[ServiceWorker] Install");
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate Service Worker and cleanup old caches
self.addEventListener("activate", event => {
  console.log("[ServiceWorker] Activate");
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch handler: serve cache first, fallback to network
self.addEventListener("fetch", event => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request)
        .then(response => {
          // Cache fetched external resources
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(request, response.clone());
            return response;
          });
        })
        .catch(() => {
          // Optional: fallback offline page if needed
          if (request.headers.get("accept").includes("text/html")) {
            return caches.match("/index.html");
          }
        });
    })
  );
});

// Handle offline scan storage
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SAVE_OFFLINE_SCAN") {
    saveOfflineScan(event.data.scan);
  }
});

// Save offline scans in IndexedDB
async function saveOfflineScan(scan) {
  const db = await openDB();
  const tx = db.transaction(OFFLINE_QUEUE, "readwrite");
  await tx.objectStore(OFFLINE_QUEUE).add(scan);
  await tx.done;
}

// Sync offline scans when back online
self.addEventListener("sync", event => {
  if (event.tag === "sync-scans") {
    event.waitUntil(syncOfflineScans());
  }
});

// IndexedDB helper functions
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("busScannerDB", 1);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(OFFLINE_QUEUE)) {
        db.createObjectStore(OFFLINE_QUEUE, { autoIncrement: true });
      }
    };
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject(event.target.error);
  });
}

async function syncOfflineScans() {
  const db = await openDB();
  const tx = db.transaction(OFFLINE_QUEUE, "readwrite");
  const store = tx.objectStore(OFFLINE_QUEUE);
  const allScans = await store.getAll();

  for (let scan of allScans) {
    try {
      // Replace with your Supabase upload function
      await fetch("/sync-scan", {
        method: "POST",
        body: JSON.stringify(scan),
        headers: { "Content-Type": "application/json" }
      });
      store.delete(scan.id);
    } catch (err) {
      console.error("Failed to sync scan", scan, err);
    }
  }
  await tx.done;
}
