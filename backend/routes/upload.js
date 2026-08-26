const express = require("express");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const { storage } = require("../config/cloudinary");
const protect = require("../middleware/auth");

// Every accepted file is a real Cloudinary upload (real bandwidth, real
// storage quota) — tighter than the general API limiter on purpose.
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many uploads. Please slow down." },
});

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB cap — plenty for chat images
  fileFilter: (req, file, cb) => {
    // multer's own limits option only checks file size, not content type —
    // without this, anything (a .exe renamed to .jpg, an .svg carrying an
    // inline <script>) sails through to Cloudinary and back out as a URL
    // your own users' browsers will fetch.
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, GIF, or WEBP images are allowed"));
    }
    cb(null, true);
  },
});

const router = express.Router();

// @route  POST /api/upload
// @desc   Upload a single image, get back a URL to attach to a message
router.post("/", protect, uploadLimiter, upload.single("image"), (req, res, next) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  res.json({ url: req.file.path });
}, (err, req, res, next) => {
  // multer (file-too-large) and the fileFilter above both signal failure by
  // calling next(err) rather than throwing — Express only routes those to
  // an error-handling middleware (4-arg signature), so without this they'd
  // fall through to the app-level handler and surface as a generic 500
  // instead of a clear 400.
  if (err) return res.status(400).json({ message: err.message || "Upload failed" });
  next();
});

module.exports = router;
