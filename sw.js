const CACHE_NAME = "tripmaster-v1006";

// Core assets required for the app shell to work offline.
// If any of these fail to cache, installation fails (as intended).
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./sw.js",
];

// Optional assets: nice to have offline, but their absence must not
// break Service Worker installation (e.g. icons not yet added to the project).
const OPTIONAL_ASSETS = [
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(CORE_ASSETS);
      await Promise.all(
        OPTIONAL_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn("TripMaster SW: optional asset not cached:", asset, err);
          })
        )
      );
      self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.mode === "navigate") {
    // Navigation requests (page loads/refreshes): try cache, then network,
    // then fall back to the cached app shell so offline refresh never
    // shows a white screen even if the exact URL wasn't cached.
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).catch(() =>
          caches.match("./index.html")
        );
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
