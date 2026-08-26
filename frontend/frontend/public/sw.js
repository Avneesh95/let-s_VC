const CACHE_NAME = "chatapp-shell-v1";
const PRECACHE_URLS = ["/", "/manifest.json"];
const CONFIG_CACHE_KEY = "https://sw-config.local/api-base-url"; // synthetic — never actually fetched, just used as a Cache Storage key

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

// The page tells the service worker its own API base URL right after
// registering (see main.jsx) — this is stashed in Cache Storage rather
// than a plain in-memory variable because a service worker can be killed
// by the browser and respawned later purely to handle a `push` event, with
// no page open to re-send it. Cache Storage (unlike an in-memory variable)
// survives that restart.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "SET_API_BASE_URL" || !event.data.apiBaseUrl) return;
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.put(CONFIG_CACHE_KEY, new Response(JSON.stringify({ apiBaseUrl: event.data.apiBaseUrl }))))
  );
});

async function getApiBaseUrl() {
  const cache = await caches.open(CACHE_NAME);
  const res = await cache.match(CONFIG_CACHE_KEY);
  if (!res) return null;
  const { apiBaseUrl } = await res.json();
  return apiBaseUrl || null;
}

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

// --- Background notifications (calls + messages) ---
// This fires even when the app is fully closed (that's the whole point —
// a foreground/backgrounded-but-open tab already gets these live over the
// socket/in-page and doesn't need this). One real limitation worth being
// upfront about for calls: a service worker has no page to play looping
// audio through, so this can't reproduce a continuous phone ringtone. What
// it CAN do — and does — is a persistent, high-priority OS notification
// (system sound + vibration + stays on screen until acted on) with
// Answer/Decline actions that jump straight into the call. Messages are
// simpler: just a normal notification that opens straight into that
// conversation on tap.
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  if (payload.type === "incoming-call") {
    const { roomCode, callerName, callerAvatarUrl, declineToken } = payload;
    event.waitUntil(
      self.registration.showNotification(`${callerName || "Someone"} is calling…`, {
        body: "Tap Answer to join",
        tag: `call-${roomCode}`, // replaces any previous notification for the same call
        icon: callerAvatarUrl || "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        vibrate: [300, 150, 300, 150, 300],
        requireInteraction: true, // stays up until the person acts, doesn't auto-dismiss
        data: { type: "incoming-call", roomCode, callerName, declineToken },
        actions: [
          { action: "answer", title: "Answer" },
          { action: "decline", title: "Decline" },
        ],
      })
    );
    return;
  }

  if (payload.type === "new-message") {
    const { senderId, senderName, senderAvatarUrl, preview } = payload;
    event.waitUntil(
      self.registration.showNotification(senderName || "New message", {
        body: preview || "Sent you a message",
        // Replaces any earlier not-yet-seen notification from the same
        // sender instead of stacking a separate one per message — matches
        // how the in-app unread badge already collapses to one count.
        tag: `message-${senderId}`,
        icon: senderAvatarUrl || "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        vibrate: [150],
        data: { type: "new-message", senderId },
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  event.notification.close();

  if (data.type === "new-message") {
    const targetUrl = `/chat?with=${data.senderId}`;
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
    return;
  }

  const { roomCode, declineToken } = data;

  if (event.action === "decline") {
    // Best-effort: let the caller's screen know right away instead of
    // leaving them ringing until the call naturally times out. There's no
    // live socket to send this over (that's why push was needed at all),
    // so it goes through a REST endpoint authenticated by the short-lived
    // token issued alongside this specific push (see sendCallPush in the
    // backend). If this fails — offline device, expired token, anything —
    // declining locally still closes the notification either way; the
    // caller's own ring timeout is the fallback.
    if (declineToken) {
      event.waitUntil(
        getApiBaseUrl()
          .then((base) => {
            if (!base) return;
            return fetch(`${base}/calls/decline`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: declineToken }),
            });
          })
          .catch(() => {})
      );
    }
    return;
  }

  if (!roomCode) return;

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
