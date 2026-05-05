const express = require("express");
const router = express.Router();
const protect = require("../middleWare/authMiddleware");
const {
  createBlogPost,
  getBlogPosts,
  getBlogPost,
  updateBlogPost,
  deleteBlogPost,
} = require("../controllers/blogController");
const { upload } = require("../utils/fileUpload");

// Public routes
router.get("/", getBlogPosts);
router.get("/:id", getBlogPost);

// Protected routes (require authentication)
router.post("/", protect, upload.single("coverImage"), createBlogPost);
router.patch("/:id", protect, upload.single("coverImage"), updateBlogPost);
router.delete("/:id", protect, deleteBlogPost);

module.exports = router;
