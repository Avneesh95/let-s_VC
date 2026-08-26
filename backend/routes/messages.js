const express = require("express");
const rateLimit = require("express-rate-limit");
const Message = require("../models/Message");
const User = require("../models/User");
const protect = require("../middleware/auth");

const router = express.Router();

// This is a read endpoint, not a message-send endpoint (sending happens
// over the socket) — the limit here is generous and mainly guards against
// a runaway client-side loop, not real abuse.
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const MAX_HISTORY = 300; // see note below

// @route  GET /api/messages/:otherUserId
// @desc   Get conversation history between logged-in user and otherUserId,
//         most recent MAX_HISTORY messages. This app doesn't have an
//         infinite-scroll/"load older messages" UI, so rather than fetch
//         truly unbounded history on every chat open (fine for a demo
//         conversation, a real performance problem for a long-running one),
//         this caps it at the most recent 300 — plenty for an interview
//         demo, and prevents the worst case from a query with no limit at
//         all. Adding true pagination is the natural next step if this
//         conversation history feature grows further.
router.get("/:otherUserId", protect, readLimiter, async (req, res) => {
  try {
    const { otherUserId } = req.params;

    const me = await User.findById(req.userId).select("friends");
    const isFriend = me?.friends.some((id) => id.toString() === otherUserId);
    if (!isFriend) {
      return res.status(403).json({ message: "You can only view messages with friends" });
    }

    const messages = await Message.find({
      $or: [
        { sender: req.userId, receiver: otherUserId },
        { sender: otherUserId, receiver: req.userId },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(MAX_HISTORY);

    res.json(messages.reverse()); // back to chronological order for display
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
