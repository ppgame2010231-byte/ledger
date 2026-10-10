// 逐筆帳本 service worker: app shell works offline; the page is fetched fresh when online so updates arrive.
const VERSION = "ledger-1.8.0"; // keep in step with APP_VERSION in index.html
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
];
// the page's own path(s): only these may be stored as the offline copy of index.html
const APP_DIR = new URL("./", self.location.href).pathname;
const isAppPage = (u) => {
  const p = new URL(u, self.location.href).pathname;
  return p === APP_DIR || p === APP_DIR + "index.html";
};

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // no network beyond our own files
  // pages: network first (bypassing the HTTP cache's heuristic freshness, but still conditional, so a
  // deploy shows up on the next launch), fall back to the cached shell offline
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(new Request(req, { cache: "no-cache" }))
        .then((r) => {
          if (!r.ok) return caches.match("./index.html").then((hit) => hit || r); // site down or removed: keep running the saved copy
          const ct = r.headers.get("content-type") || "";
          // only our own HTML page may replace the offline copy (a captive-portal login page must not)
          if (/text\/html/i.test(ct) && isAppPage(r.url || req.url)) {
            const copy = r.clone();
            e.waitUntil(caches.open(VERSION).then((c) => c.put("./index.html", copy)));
          }
          return r;
        })
        .catch(() => caches.match("./index.html")),
    );
    return;
  }
  // static files: cache first, then network (and remember it)
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((r) => {
          if (r.ok) {
            const copy = r.clone();
            e.waitUntil(caches.open(VERSION).then((c) => c.put(req, copy)));
          }
          return r;
        }),
    ),
  );
});
