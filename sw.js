// 逐筆帳本 service worker: app shell works offline; the page is fetched fresh when online so updates arrive.
const VERSION = "ledger-v2";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // pages: network first, fall back to cached shell offline
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(r => {
        if (!r.ok) return caches.match("./index.html").then(hit => hit || r); // site down or removed: keep running the saved copy
        const copy = r.clone(); caches.open(VERSION).then(c => c.put("./index.html", copy)); return r;
      }).catch(() => caches.match("./index.html")));
    return;
  }
  // fonts and static files: cache first, then network (and remember it)
  if (url.origin === location.origin || url.hostname.endsWith("gstatic.com") || url.hostname.endsWith("googleapis.com")) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return r;
    })));
  }
});
