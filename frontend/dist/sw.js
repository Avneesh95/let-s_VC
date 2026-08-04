const CACHE_NAME = "chatapp-shell-v1";
const PRECACHE_URLS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle same-origin GET requests for the app shell (HTML, JS, CSS,
  // icons) — never intercept API calls, Socket.IO's websocket/polling
  // requests, or cross-origin requests (the backend on a different domain,
  // Cloudinary-hosted images). Those must always hit the network live;
  // caching them would mean serving stale chat data or silently breaking
  // real-time behavior.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Network-first: always try to get the latest version when online, only
  // falling back to the cached shell when the network request fails
  // (offline) — this way a redeploy is never masked by a stale cache.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
  );
});
