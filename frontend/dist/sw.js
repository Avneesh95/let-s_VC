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

// --- Background call notifications ---
// This fires even when the app is fully closed (that's the whole point —
// a foreground/backgrounded-but-open tab already rings via the in-page
// ringtone in utils/ringtone.js and doesn't need this). One real
// limitation worth being upfront about: a service worker has no page to
// play looping audio through, so this can't reproduce a continuous phone
// ringtone. What it CAN do — and does — is a persistent, high-priority OS
// notification (system sound + vibration + stays on screen until acted on)
// with Answer/Decline actions that jump straight into the call.
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  if (payload.type !== "incoming-call") return;

  const { roomCode, callerName, callerAvatarUrl } = payload;

  event.waitUntil(
    self.registration.showNotification(`${callerName || "Someone"} is calling…`, {
      body: "Tap Answer to join",
      tag: `call-${roomCode}`, // replaces any previous notification for the same call
      icon: callerAvatarUrl || "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      vibrate: [300, 150, 300, 150, 300],
      requireInteraction: true, // stays up until the person acts, doesn't auto-dismiss
      data: { roomCode, callerName },
      actions: [
        { action: "answer", title: "Answer" },
        { action: "decline", title: "Decline" },
      ],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  const { roomCode } = event.notification.data || {};
  event.notification.close();

  if (event.action === "decline" || !roomCode) return;

  // "answer" or a plain tap on the notification body both join the call.
  const targetUrl = `/room/${roomCode}`;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => new URL(c.url).origin === self.location.origin);
      if (existing) {
        existing.navigate(targetUrl);
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
