const asyncHandler = require("express-async-handler");
const BlogPost = require("../models/blogModel");
const { fileSizeFormatter } = require("../utils/fileUpload");
const { uploadImageToS3 } = require("../utils/fileDownload");
const logActivity = require("../middleWare/logActivityMiddleware");

// Create Blog Post
const createBlogPost = asyncHandler(async (req, res) => {
  const { title, subtitle, content, readTime, published, tags } = req.body;

//   console.log("Request Body:", req.body);

  if (!req.loggedInUser) {
    res.status(401);
    throw new Error("User not authenticated");
  }

  // Validation
  if (!title || !subtitle || !content) {
    res.status(400);
    throw new Error("Please fill in all required fields");
  }

  // Handle Image upload
  let coverImage = "";
  if (req.file) {
    // console.log("Uploading file:", req.file);

    const uniqueFilename = `blog-${req.business._id}-${Date.now()}-${
      req.file.originalname
    }`;
    try {
      const uploadedFile = await uploadImageToS3(req.file.path, uniqueFilename);
      coverImage = uploadedFile.Location;
    } catch (error) {
      res.status(500);
      throw new Error("Image could not be uploaded");
    }
  }

  // Create Blog Post
  const blogPost = await BlogPost.create({
    title,
    subtitle,
    content,
    coverImage,
    author: req.business._id,
    readTime: readTime || "5 min read",
    published: published || false,
    tags: tags ? JSON.parse(tags) : [],
  });

  logActivity(`Created blog post "${title}"${published ? " (published)" : ""}`)(req, res);

  res.status(201).json(blogPost);
});

// Get All Blog Posts
const getBlogPosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 9, search = "" } = req.query;

  const query = search
    ? {
        published: true,
        $or: [
          { title: { $regex: search, $options: "i" } },
          { subtitle: { $regex: search, $options: "i" } },
          { tags: { $in: [new RegExp(search, "i")] } },
        ],
      }
    : { published: true };

  const blogPosts = await BlogPost.find(query)
    .populate("author", "name email")
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const count = await BlogPost.countDocuments(query);

  res.status(200).json({
    blogPosts,
    totalPages: Math.ceil(count / limit),
    currentPage: Number(page),
    totalPosts: count,
  });
});

// Get Single Blog Post
const getBlogPost = asyncHandler(async (req, res) => {
  const blogPost = await BlogPost.findById(req.params.id).populate(
    "author",
    "name email"
  );

  //   console.log("Retrieved blog post:", blogPost);

  if (!blogPost) {
    res.status(404);
    throw new Error("Blog post not found");
  }

  // Increment views
  blogPost.views += 1;
  await blogPost.save();

  res.status(200).json(blogPost);
});

// Update Blog Post
const updateBlogPost = asyncHandler(async (req, res) => {
  const { title, subtitle, content, readTime, published, tags, imageChanged } = req.body;
  const { id } = req.params;

  if (!req.business) {
    res.status(401);
    throw new Error("User not authenticated");
  }

  const blogPost = await BlogPost.findById(id);

  if (!blogPost) {
    res.status(404);
    throw new Error("Blog post not found");
  }

  // Check if user is the author
  if (blogPost.author.toString() !== req.business._id.toString()) {
    res.status(401);
    throw new Error("User not authorized to update this post");
  }

  // Handle Image upload - Only process if imageChanged flag is true
  let coverImage = blogPost.coverImage;
  if (req.file && imageChanged === "true") {
    const uniqueFilename = `blog-${req.business._id}-${Date.now()}-${
      req.file.originalname
    }`;
    try {
      const uploadedFile = await uploadImageToS3(req.file.path, uniqueFilename);
      coverImage = uploadedFile.Location;
    } catch (error) {
      res.status(500);
      throw new Error("Image could not be uploaded");
    }
  }

  // Update Blog Post
  const updatedBlogPost = await BlogPost.findByIdAndUpdate(
    { _id: id },
    {
      title: title || blogPost.title,
      subtitle: subtitle || blogPost.subtitle,
      content: content || blogPost.content,
      coverImage,
      readTime: readTime || blogPost.readTime,
      published: published !== undefined ? published : blogPost.published,
      tags: tags ? JSON.parse(tags) : blogPost.tags,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  logActivity(`Updated blog post "${updatedBlogPost.title}"${published ? " (published)" : ""}`)(req, res);

  res.status(200).json(updatedBlogPost);
});

// Delete Blog Post
const deleteBlogPost = asyncHandler(async (req, res) => {
  console.log("Delete request - req.business:", req.business);
  console.log("Delete request - req.loggedInUser:", req.loggedInUser);

  if (!req.business) {
    res.status(401);
    throw new Error("User not authenticated");
  }

  const blogPost = await BlogPost.findById(req.params.id);

  if (!blogPost) {
    res.status(404);
    throw new Error("Blog post not found");
  }

//   console.log("Blog post author:", blogPost.author.toString());
//   console.log("Request business ID:", req.business._id.toString());

  // Check if user is the author
  if (blogPost.author.toString() !== req.business._id.toString()) {
    res.status(401);
    throw new Error("User not authorized to delete this post");
  }

  await blogPost.deleteOne();
  logActivity(`Deleted blog post "${blogPost.title}"`)(req, res);
  res.status(200).json({ message: "Blog post deleted successfully" });
});

module.exports = {
  createBlogPost,
  getBlogPosts,
  getBlogPost,
  updateBlogPost,
  deleteBlogPost,
};
