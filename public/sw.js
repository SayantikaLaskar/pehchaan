// Pehchaan service worker: the dashboard, kiosk and offer pages keep working with no network.
// The churn model runs in the browser, so cached pages can still score every customer offline.
const CACHE = "pehchaan-v1";
const SHELL = ["/app", "/app/winback", "/app/resilience", "/app/orders", "/kiosk", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  // Hashed build assets never change: cache first.
  if (url.pathname.startsWith("/_next/static/") || /\.(woff2|svg|png|ico)$/.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })));
    return;
  }
  // Pages: network first, last good copy when offline (offer links fall back to the offer shell).
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req, { ignoreSearch: url.pathname.startsWith("/o/") }).then((hit) => hit || caches.match("/app"))),
    );
  }
});
