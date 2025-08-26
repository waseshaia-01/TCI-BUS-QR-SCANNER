const CACHE_NAME = "bus-scanner-cache-v1";
const OFFLINE_QUEUE = "offline-scans";

// Assets to cache initially
const ASSETS_TO_CACHE = [
  "/", "/index.html", "/dashboard.html", "/favicon.ico",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js",
  "https://cdn.jsdelivr.net/npm/face-api.js",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js"
];

// Install SW and cache assets
self.addEventListener("install", event => {
  console.log("[SW] Install");
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate SW and clean old caches
self.addEventListener("activate", event => {
  console.log("[SW] Activate");
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch handler: cache first, fallback to network
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(request, response.clone());
          return response;
        });
      }).catch(() => {
        if (request.headers.get("accept")?.includes("text/html")) {
          return caches.match("/index.html");
        }
      });
    })
  );
});

// IndexedDB for offline scans
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

async function saveOfflineScan(scan) {
  const db = await openDB();
  const tx = db.transaction(OFFLINE_QUEUE, "readwrite");
  await tx.objectStore(OFFLINE_QUEUE).add(scan);
  await tx.done;
}

async function syncOfflineScans() {
  const db = await openDB();
  const tx = db.transaction(OFFLINE_QUEUE, "readwrite");
  const store = tx.objectStore(OFFLINE_QUEUE);
  const allScans = await store.getAll();

  for (let scan of allScans) {
    try {
      // Replace with your real server or Supabase sync endpoint
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

// Background sync
self.addEventListener("sync", event => {
  if (event.tag === "sync-scans") {
    event.waitUntil(syncOfflineScans());
  }
});

// Listen for messages from dashboard
self.addEventListener("message", async event => {
  const data = event.data;

  if (!data) return;

  if (data.type === "SAVE_OFFLINE_SCAN") {
    saveOfflineScan(data.scan);
  }

  if (data.type === "CACHE_OFFLINE") {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS_TO_CACHE);

    // Notify dashboard that offline mode is ready
    const clients = await self.clients.matchAll();
    clients.forEach(client => client.postMessage({ type: 'OFFLINE_READY' }));
  }
});
