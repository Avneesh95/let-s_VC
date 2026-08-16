const express = require("express");
const jwt = require("jsonwebtoken");
const asyncHandler = require("../middleware/asyncHandler");
const socketModule = require("../socket/socket");

const router = express.Router();

// @route  POST /api/calls/decline
// @desc   Relays "call declined" to the caller when the callee taps
//         Decline on a push notification with the app fully closed.
//
//         Why this exists: a service worker handling that tap has no live
//         Socket.IO connection (that's the whole reason push was needed —
//         the app has no open tab/socket at all) and can't read the JWT
//         from localStorage either, since a service worker runs in a
//         separate context with no access to it. It can't use the normal
//         `protect` auth middleware.
//
//         Instead it authenticates with a token scoped to exactly one
//         call: signed server-side when the push was sent (see
//         sendCallPush in socket/socket.js), naming only that call's room
//         and caller, expiring with the ring window. It can decline that
//         one call and nothing else — it's not a general-purpose credential.
router.post(
  "/decline",
  asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "token is required" });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // Expired is the common case here (ring window passed) — not
      // worth distinguishing from a malformed/tampered token, since
      // either way there's nothing left to decline.
      return res.status(401).json({ message: "This call is no longer active" });
    }
    if (payload.purpose !== "call-decline" || !payload.roomCode || !payload.from) {
      return res.status(401).json({ message: "Invalid token" });
    }

    socketModule.relayCallDeclined(payload.from, payload.roomCode);
    // Always 200 even if the caller had already gone offline by the time
    // this arrived — from the callee's device's point of view, declining
    // succeeded either way; there's no meaningful retry it could do.
    res.json({ message: "Declined" });
  })
);

module.exports = router;
