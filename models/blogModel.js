const mongoose = require("mongoose");

const blogPostSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please add a title"],
      trim: true,
    },
    subtitle: {
      type: String,
      required: [true, "Please add a subtitle"],
      trim: true,
    },
    content: {
      type: String,
      required: [true, "Please add content"],
    },
    coverImage: {
      type: String,
      required: false,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "BusinessRegistration",
    },
    readTime: {
      type: String,
      default: "5 min read",
    },
    published: {
      type: Boolean,
      default: false,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    views: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const BlogPost = mongoose.model("BlogPost", blogPostSchema);
module.exports = BlogPost;
