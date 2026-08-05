const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const User = require("../models/User");
const FriendRequest = require("../models/FriendRequest");
const protect = require("../middleware/auth");
const { storage } = require("../config/cloudinary");

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();

// @route  GET /api/users
// @desc   Get every user except the logged-in one (the "contact list"),
//         annotated with the current user's relationship to each one.
router.get("/", protect, async (req, res) => {
  try {
    const [me, users, pendingRequests] = await Promise.all([
      User.findById(req.userId).select("friends"),
      User.find({ _id: { $ne: req.userId } }).select("username email avatarColor avatarUrl"),
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

// @route  PUT /api/users/me
// @desc   Update your own username
router.put("/me", protect, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username?.trim()) {
      return res.status(400).json({ message: "Username is required" });
    }

    const existing = await User.findOne({ username: username.trim(), _id: { $ne: req.userId } });
    if (existing) {
      return res.status(400).json({ message: "That username is already taken" });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { username: username.trim() },
      { new: true }
    ).select("username email avatarColor avatarUrl");

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// @route  PUT /api/users/me/password
// @desc   Change your own password — requires the current password
router.put("/me/password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.userId);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password updated" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// @route  POST /api/users/me/avatar
// @desc   Upload a profile picture (same Cloudinary pipeline as chat images)
router.post("/me/avatar", protect, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatarUrl: req.file.path },
      { new: true }
    ).select("username email avatarColor avatarUrl");

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
