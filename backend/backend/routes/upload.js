const express = require("express");
const multer = require("multer");
const { storage } = require("../config/cloudinary");
const protect = require("../middleware/auth");

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB cap
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

const uploadImageMiddleware = (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "Image size cannot exceed 5MB" });
      }
      return res.status(400).json({ message: err.message });
    } else if (err) {
      return res.status(400).json({ message: err.message || "File upload failed" });
    }
    next();
  });
};

const router = express.Router();

// @route  POST /api/upload
// @desc   Upload a single image, get back a URL to attach to a message
router.post("/", protect, uploadImageMiddleware, (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  res.json({ url: req.file.path });
});

module.exports = router;
