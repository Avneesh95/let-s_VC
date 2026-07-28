const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// multer will stream the uploaded file straight to Cloudinary —
// no need to touch the local filesystem, which is important since
// hosts like Render don't persist disk writes between deploys.
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "chat-app",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ width: 1200, crop: "limit" }], // cap size, keep it simple
  },
});

module.exports = { cloudinary, storage };
