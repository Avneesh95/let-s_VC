const express = require("express");
const { pushEnabled, VAPID_PUBLIC_KEY } = require("../config/webpush");

const router = express.Router();

// @route  GET /api/push/vapid-public-key
// @desc   The frontend needs this to call pushManager.subscribe().
router.get("/vapid-public-key", (req, res) => {
  if (!pushEnabled || !VAPID_PUBLIC_KEY) {
    return res.json({ configured: false, publicKey: null, message: "Push notifications aren't configured on this server" });
  }
  res.json({ configured: true, publicKey: VAPID_PUBLIC_KEY });
});

module.exports = router;
