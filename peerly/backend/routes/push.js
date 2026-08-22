const express = require("express");
const { pushEnabled, VAPID_PUBLIC_KEY } = require("../config/webpush");

const router = express.Router();

// @route  GET /api/push/vapid-public-key
// @desc   The frontend needs this to call pushManager.subscribe(). Public
//         by design — it's not a secret, only VAPID_PRIVATE_KEY is.
router.get("/vapid-public-key", (req, res) => {
  if (!pushEnabled) {
    return res.status(503).json({ message: "Push notifications aren't configured on this server" });
  }
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

module.exports = router;
