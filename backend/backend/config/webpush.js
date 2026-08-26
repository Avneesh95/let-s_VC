const webpush = require("web-push");

// VAPID keys identify this server to push services (FCM, Mozilla's push
// service, etc). Generate a pair once with `npx web-push generate-vapid-keys`
// and put them in .env — they should stay stable across deploys, since
// existing browser subscriptions are tied to the public key that created them.
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT_EMAIL } = process.env;

const pushEnabled = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (pushEnabled) {
  webpush.setVapidDetails(
    `mailto:${VAPID_CONTACT_EMAIL || "admin@example.com"}`,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} else {
  // Not fatal — the rest of the app (chat, calls between two open tabs)
  // works fine without it. Only the "ring when the app is closed" feature
  // needs these, so we degrade gracefully instead of crashing on boot.
  console.warn(
    "VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set — background call push notifications are disabled."
  );
}

module.exports = { webpush, pushEnabled, VAPID_PUBLIC_KEY };
