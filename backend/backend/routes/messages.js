const express = require("express");
const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");
const protect = require("../middleware/auth");

const router = express.Router();

// @route  GET /api/messages/:otherUserId
// @desc   Get full conversation history between logged-in user and otherUserId
router.get("/:otherUserId", protect, async (req, res) => {
  try {
    const { otherUserId } = req.params;

    if (!mongoose.isValidObjectId(otherUserId) || !mongoose.isValidObjectId(req.userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const me = await User.findById(req.userId).select("friends");
    if (!me) {
      return res.status(404).json({ message: "User not found" });
    }

    const myFriends = Array.isArray(me.friends) ? me.friends : [];
    const isFriend = myFriends.some((id) => id && id.toString() === otherUserId);
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
