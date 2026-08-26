const mongoose = require("mongoose");

// A FriendRequest document only exists while pending. Accepting it adds
// each user to the other's `friends` array (see routes/friends.js) and
// deletes this document; rejecting it just deletes this document. This
// keeps the data model simple — there's no "status" field to track.
const friendRequestSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Prevents sending duplicate pending requests to the same person
friendRequestSchema.index({ sender: 1, receiver: 1 }, { unique: true });

module.exports = mongoose.model("FriendRequest", friendRequestSchema);
