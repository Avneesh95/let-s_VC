const express = require("express");
const User = require("../models/User");
const FriendRequest = require("../models/FriendRequest");
const protect = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

// @route  POST /api/friends/request/:userId
// @desc   Send a friend request
router.post("/request/:userId", protect, asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (userId === req.userId) {
    return res.status(400).json({ message: "You can't add yourself" });
  }

  const me = await User.findById(req.userId).select("friends");
  if (me.friends.some((id) => id.toString() === userId)) {
    return res.status(400).json({ message: "Already friends" });
  }

  // If they already sent us a request, accept it instead of creating a
  // duplicate request going the other direction — without this, two
  // people who both hit "Add" on each other around the same time would
  // end up with two separate pending requests that never resolve into an
  // actual friendship.
  const reverseRequest = await FriendRequest.findOne({ sender: userId, receiver: req.userId });
  if (reverseRequest) {
    await User.findByIdAndUpdate(req.userId, { $addToSet: { friends: userId } });
    await User.findByIdAndUpdate(userId, { $addToSet: { friends: req.userId } });
    await reverseRequest.deleteOne();
    return res.status(200).json({ message: "Friend added" });
  }

  try {
    const request = await FriendRequest.create({ sender: req.userId, receiver: userId });
    res.status(201).json(request);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Request already sent" });
    }
    res.status(500).json({ message: "Server error", error: err.message });
  }
}));

// @route  POST /api/friends/accept/:requestId
// @desc   Accept a friend request — adds both users to each other's friends list
router.post("/accept/:requestId", protect, asyncHandler(async (req, res) => {
  const request = await FriendRequest.findById(req.params.requestId);
  if (!request || request.receiver.toString() !== req.userId) {
    return res.status(404).json({ message: "Request not found" });
  }

  await User.findByIdAndUpdate(request.sender, { $addToSet: { friends: request.receiver } });
  await User.findByIdAndUpdate(request.receiver, { $addToSet: { friends: request.sender } });
  await request.deleteOne();

  res.json({ message: "Friend added" });
}));

// @route  POST /api/friends/reject/:requestId
// @desc   Reject (or cancel) a pending friend request
router.post("/reject/:requestId", protect, asyncHandler(async (req, res) => {
  const request = await FriendRequest.findById(req.params.requestId);
  if (!request) return res.status(404).json({ message: "Request not found" });

  // Either the sender (cancelling) or receiver (declining) can remove it
  const isParticipant =
    request.sender.toString() === req.userId || request.receiver.toString() === req.userId;
  if (!isParticipant) return res.status(403).json({ message: "Not authorized" });

  await request.deleteOne();
  res.json({ message: "Request removed" });
}));

module.exports = router;
