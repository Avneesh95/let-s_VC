import api from "../api/axios";

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window;
}

// Push subscription keys are base64url-encoded; the browser API wants raw bytes.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Returns the active subscription if this device already has one — lets
// the Settings toggle show accurate on/off state instead of always
// defaulting to "off" after a refresh.
export async function getExistingPushSubscription() {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

// Subscribes this device to push and registers it with the backend.
// Throws on failure (permission denied, server has no VAPID key configured,
// etc) — callers should catch and show a friendly message rather than fail silently.
export async function enableCallPush() {
  if (!isPushSupported()) {
    throw new Error("Push notifications aren't supported in this browser");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted");
  }

  const { data } = await api.get("/push/vapid-public-key");
  const registration = await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true, // required by Chrome: every push must show a visible notification
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });
  }

  await api.post("/users/me/push-subscription", { subscription });
  return subscription;
}

export async function disableCallPush() {
  const subscription = await getExistingPushSubscription();
  if (!subscription) return;

  try {
    await api.delete("/users/me/push-subscription", { data: { endpoint: subscription.endpoint } });
  } finally {
    await subscription.unsubscribe();
  }
}
