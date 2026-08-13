// Thin wrapper around the browser Notification API, used for the
// foreground/backgrounded-but-open-tab case (an in-page Notification with
// no service worker involved — simple and immediate). The fully-closed-app
// case is handled separately by Web Push + the service worker's own
// showNotification call in public/sw.js, which is what supports the
// Answer/Decline action buttons.

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "default") {
    return Notification.requestPermission();
  }
  return Notification.permission;
}

export function showNotification(title, options) {
  if (!("Notification" in window)) return null;
  if (Notification.permission !== "granted") return null;
  try {
    return new Notification(title, options);
  } catch (err) {
    // Some mobile browsers throw here even when permission is "granted"
    // (they only support notifications via a service worker) — fail
    // quietly rather than breaking the call flow over a notification.
    console.warn("Could not show notification:", err);
    return null;
  }
}
