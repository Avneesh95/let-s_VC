import api from "../api/axios";

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window;
}

// Axios errors default to a generic "Request failed with status code 503" —
// the backend's actual, useful explanation lives in response.data.message.
// Every push.js function that talks to the API should throw through this so
// the real reason reaches the UI instead of a raw HTTP status code.
function apiErrorMessage(err, fallback) {
  return err.response?.data?.message || fallback;
}

// Checked once per page load and cached — this doesn't change during a
// session, so there's no reason to hit the network every time Settings
// opens. Lets the UI tell "your browser can't do push" apart from "this
// server hasn't configured push yet" (missing VAPID keys) instead of
// lumping both into one confusing failure at click-time.
let serverConfiguredCache = null;
export async function isPushConfiguredOnServer() {
  if (serverConfiguredCache !== null) return serverConfiguredCache;
  try {
    await api.get("/push/vapid-public-key");
    serverConfiguredCache = true;
  } catch (err) {
    // Any other failure (network hiccup, server down) shouldn't be cached
    // as "not configured" — only a clean 503 from this specific endpoint
    // means push really is disabled server-side.
    serverConfiguredCache = err.response?.status === 503 ? false : null;
  }
  return serverConfiguredCache ?? true; // unknown → don't block the UI on a transient error
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

  let data;
  try {
    ({ data } = await api.get("/push/vapid-public-key"));
  } catch (err) {
    throw new Error(apiErrorMessage(err, "Couldn't reach the server to set up notifications"));
  }

  const registration = await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true, // required by Chrome: every push must show a visible notification
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });
  }

  try {
    await api.post("/users/me/push-subscription", { subscription });
  } catch (err) {
    // The browser subscription itself succeeded — only the "tell the
    // server about it" step failed, so roll the subscription back rather
    // than leaving the device silently subscribed with no server record
    // of it (it would then never actually receive anything).
    await subscription.unsubscribe().catch(() => {});
    throw new Error(apiErrorMessage(err, "Couldn't save your notification settings"));
  }
  return subscription;
}

export async function disableCallPush() {
  const subscription = await getExistingPushSubscription();
  if (!subscription) return;

  try {
    await api.delete("/users/me/push-subscription", { data: { endpoint: subscription.endpoint } });
  } catch (err) {
    throw new Error(apiErrorMessage(err, "Couldn't update your notification settings"));
  } finally {
    await subscription.unsubscribe();
  }
}
