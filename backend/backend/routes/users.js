const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const mongoose = require("mongoose");
const User = require("../models/User");
const FriendRequest = require("../models/FriendRequest");
const protect = require("../middleware/auth");
const { storage } = require("../config/cloudinary");

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

const uploadAvatarMiddleware = (req, res, next) => {
  upload.single("avatar")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "File size cannot exceed 5MB" });
      }
      return res.status(400).json({ message: err.message });
    } else if (err) {
      return res.status(400).json({ message: err.message || "File upload failed" });
    }
    next();
  });
};

const router = express.Router();

// @route  GET /api/users
// @desc   Get every user except the logged-in one (the "contact list"),
//         annotated with the current user's relationship to each one.
router.get("/", protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const [me, users, pendingRequests] = await Promise.all([
      User.findById(req.userId).select("friends"),
      User.find({ _id: { $ne: req.userId } }).select("username email avatarColor avatarUrl"),
      FriendRequest.find({ $or: [{ sender: req.userId }, { receiver: req.userId }] }),
    ]);

    if (!me) {
      return res.status(404).json({ message: "User not found" });
    }

    const myFriends = Array.isArray(me.friends) ? me.friends : [];

    const result = users.map((u) => {
      const uid = u._id.toString();

      if (myFriends.some((id) => id && id.toString() === uid)) {
        return { ...u.toObject(), friendStatus: "friends" };
      }

      const sent = pendingRequests.find(
        (r) => r.sender && r.sender.toString() === req.userId && r.receiver && r.receiver.toString() === uid
      );
      if (sent) return { ...u.toObject(), friendStatus: "request-sent", requestId: sent._id };

      const received = pendingRequests.find(
        (r) => r.receiver && r.receiver.toString() === req.userId && r.sender && r.sender.toString() === uid
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
    if (typeof username !== "string" || !username.trim()) {
      return res.status(400).json({ message: "Username is required" });
    }
    const cleanUsername = username.trim();
    if (cleanUsername.length < 2 || cleanUsername.length > 30) {
      return res.status(400).json({ message: "Username must be between 2 and 30 characters" });
    }

    const existing = await User.findOne({ username: cleanUsername, _id: { $ne: req.userId } });
    if (existing) {
      return res.status(400).json({ message: "That username is already taken" });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { username: cleanUsername },
      { new: true }
    ).select("username email avatarColor avatarUrl");

    if (!user) return res.status(404).json({ message: "User not found" });

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
    if (typeof currentPassword !== "string" || typeof newPassword !== "string" || !currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
      return res.status(400).json({ message: "New password must be between 6 and 128 characters" });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

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
router.post("/me/avatar", protect, uploadAvatarMiddleware, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatarUrl: req.file.path },
      { new: true }
    ).select("username email avatarColor avatarUrl");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// @route  POST /api/users/me/push-subscription
// @desc   Register a Web Push subscription for this device
router.post("/me/push-subscription", protect, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (
      !subscription ||
      typeof subscription !== "object" ||
      typeof subscription.endpoint !== "string" ||
      !subscription.keys ||
      typeof subscription.keys.p256dh !== "string" ||
      typeof subscription.keys.auth !== "string"
    ) {
      return res.status(400).json({ message: "Invalid push subscription" });
    }

    await User.findByIdAndUpdate(req.userId, {
      $pull: { pushSubscriptions: { endpoint: subscription.endpoint } },
    });
    await User.findByIdAndUpdate(req.userId, {
      $push: { pushSubscriptions: subscription },
    });

    res.status(201).json({ message: "Subscribed" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// @route  DELETE /api/users/me/push-subscription
// @desc   Remove a push subscription
router.delete("/me/push-subscription", protect, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (typeof endpoint !== "string" || !endpoint) {
      return res.status(400).json({ message: "endpoint is required" });
    }

    await User.findByIdAndUpdate(req.userId, { $pull: { pushSubscriptions: { endpoint } } });
    res.json({ message: "Unsubscribed" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
