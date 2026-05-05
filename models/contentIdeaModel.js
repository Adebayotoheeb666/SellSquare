const mongoose = require("mongoose");

const contentIdeaSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },

    // Source information
    sourceEngagement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SocialMediaEngagement",
    },

    sourcePlatform: {
      type: String,
      enum: ["tiktok", "instagram", "manual"],
      required: true,
    },

    // Content idea details
    title: String,

    description: String,

    contentType: {
      type: String,
      enum: ["product_showcase", "lifestyle", "educational", "entertainment", "trending", "other"],
      default: "product_showcase",
    },

    suggestedContent: {
      headline: String,
      body: String,
      hashtags: [String],
      callToAction: String,
      mediaType: {
        type: String,
        enum: ["image", "video", "carousel", "reels"],
      },
    },

    // AI-generated variations for platforms
    variations: {
      tiktok: {
        script: String, // For TikTok video script
        audioSuggestion: String,
        duration: Number, // seconds
      },
      instagram: {
        caption: String,
        hashtags: [String],
      },
    },

    // Approval & posting
    status: {
      type: String,
      enum: ["draft", "pending_approval", "approved", "rejected", "scheduled", "published", "archived"],
      default: "draft",
    },

    approvalNotes: String,

    approvedBy: mongoose.Schema.Types.ObjectId, // User ID who approved

    approvedAt: Date,

    // Scheduled publishing
    scheduledFor: {
      platform: {
        type: String,
        enum: ["tiktok", "instagram", "both"],
      },
      scheduledDate: Date,
    },

    // Publishing history
    publishingHistory: [
      {
        platform: {
          type: String,
          enum: ["tiktok", "instagram"],
        },
        publishedAt: Date,
        postId: String,
        postUrl: String,
        performance: {
          views: Number,
          likes: Number,
          comments: Number,
          shares: Number,
          saves: Number,
        },
      },
    ],

    // AI generation metadata
    aiGeneration: {
      model: String, // "gpt-4", "claude", etc.
      temperature: Number,
      tokens: Number,
      prompt: String,
    },

    // Resonance metrics
    resonanceScore: {
      type: Number,
      min: 0,
      max: 100,
      description: "How well the idea resonates with target audience based on analysis",
    },

    targetAudience: [String], // Tags for audience segments

    // Tracking
    viewCount: {
      type: Number,
      default: 0,
    },

    shareCount: {
      type: Number,
      default: 0,
    },

    createdFromPostUrl: String, // Link to original post that inspired this idea
  },
  { timestamps: true }
);

// Indexes
contentIdeaSchema.index({ business: 1 });
contentIdeaSchema.index({ business: 1, status: 1 });
contentIdeaSchema.index({ business: 1, createdAt: -1 });
contentIdeaSchema.index({ business: 1, "publishingHistory.publishedAt": -1 });
contentIdeaSchema.index({ sourcePlatform: 1 });

module.exports = mongoose.model("ContentIdea", contentIdeaSchema);
