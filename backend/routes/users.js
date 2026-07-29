const express = require("express");
const User = require("../models/User");
const FriendRequest = require("../models/FriendRequest");
const protect = require("../middleware/auth");

const router = express.Router();

// @route  GET /api/users
// @desc   Get every user except the logged-in one (the "contact list"),
//         annotated with the current user's relationship to each one.
router.get("/", protect, async (req, res) => {
  try {
    const [me, users, pendingRequests] = await Promise.all([
      User.findById(req.userId).select("friends"),
      User.find({ _id: { $ne: req.userId } }).select("username email avatarColor"),
      FriendRequest.find({ $or: [{ sender: req.userId }, { receiver: req.userId }] }),
    ]);

    const result = users.map((u) => {
      const uid = u._id.toString();

      if (me.friends.some((id) => id.toString() === uid)) {
        return { ...u.toObject(), friendStatus: "friends" };
      }

      const sent = pendingRequests.find(
        (r) => r.sender.toString() === req.userId && r.receiver.toString() === uid
      );
      if (sent) return { ...u.toObject(), friendStatus: "request-sent", requestId: sent._id };

      const received = pendingRequests.find(
        (r) => r.receiver.toString() === req.userId && r.sender.toString() === uid
      );
      if (received) {
        return { ...u.toObject(), friendStatus: "request-received", requestId: received._id };
      }

      return { ...u.toObject(), friendStatus: "none" };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
