// Thin wrapper around the browser Notification API — no service worker,
// so no interactive action buttons on the notification itself (that
// requires a registered service worker), but simple and enough to alert
// someone that a call is coming in when they're not looking at the tab.

export function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
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
