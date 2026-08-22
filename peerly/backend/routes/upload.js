const express = require("express");
const multer = require("multer");
const { storage } = require("../config/cloudinary");
const protect = require("../middleware/auth");

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB cap — plenty for chat images
});

const router = express.Router();

// @route  POST /api/upload
// @desc   Upload a single image, get back a URL to attach to a message
router.post("/", protect, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  res.json({ url: req.file.path });
});

module.exports = router;
