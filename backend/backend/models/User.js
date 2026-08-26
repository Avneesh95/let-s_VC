const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    avatarColor: { type: String, default: "#F4600F" }, // fallback initial-circle color if no photo
    avatarUrl: { type: String, default: null }, // uploaded profile picture, takes priority if set
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // One entry per device/browser that has enabled "ring when app is
    // closed". Structure matches the PushSubscription object the browser
    // hands back from pushManager.subscribe() — endpoint + encryption keys.
    pushSubscriptions: [
      {
        endpoint: { type: String, required: true },
        keys: {
          p256dh: { type: String, required: true },
          auth: { type: String, required: true },
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
