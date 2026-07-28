const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    avatarColor: { type: String, default: "#4f46e5" }, // simple placeholder "avatar"
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
