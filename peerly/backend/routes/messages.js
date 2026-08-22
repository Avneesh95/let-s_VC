const express = require("express");
const Message = require("../models/Message");
const User = require("../models/User");
const protect = require("../middleware/auth");

const router = express.Router();

// @route  GET /api/messages/:otherUserId
// @desc   Get full conversation history between logged-in user and otherUserId
router.get("/:otherUserId", protect, async (req, res) => {
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
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
