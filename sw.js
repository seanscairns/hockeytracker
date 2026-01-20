const CACHE = "hockey-tracker-v13";
const ASSETS = ["./", "./index.html", "./app.js", "./sw.js", "./manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Network-first for core files so updates arrive, fallback to cache.
  const isCore = url.pathname.endsWith("/") ||
                 url.pathname.endsWith("/index.html") ||
                 url.pathname.endsWith("/app.js") ||
                 url.pathname.endsWith("/sw.js") ||
                 url.pathname.endsWith("/manifest.webmanifest");

  if (req.method !== "GET") return;

  if (isCore) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
