const mongoose = require("mongoose");

const socialMediaEngagementSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },

    platform: {
      type: String,
      enum: ["tiktok", "instagram"],
      required: true,
    },

    // Original post details
    originalPost: {
      postId: String, // Platform-specific post ID
      authorId: String, // Profile ID of the business owner
      authorHandle: String,
      postUrl: String,
      content: String,
      mediaUrls: [String],
      likes: Number,
      comments: Number,
      shares: Number,
      views: Number,
      postedAt: Date,
    },

    // Engagement actions taken
    engagementActions: [
      {
        type: {
          type: String,
          enum: ["like", "comment"],
        },
        comment: String, // Only for comment type
        actionedAt: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ["pending", "success", "failed"],
          default: "pending",
        },
        error: String,
      },
    ],

    // Generated insights
    insights: {
      keyThemes: [String],
      sentiment: {
        type: String,
        enum: ["positive", "neutral", "negative"],
      },
      audienceInterest: [String],
      engagementLevel: {
        type: String,
        enum: ["high", "medium", "low"],
      },
      relevanceScore: {
        type: Number,
        min: 0,
        max: 100,
      },
      summary: String,
    },

    // Content idea generated from this post
    generatedContentIdea: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ContentIdea",
    },

    // Status tracking
    status: {
      type: String,
      enum: ["new", "insights_generated", "content_idea_created", "archived"],
      default: "new",
    },

    // Processing metadata
    processedAt: Date,
    processedBy: String, // "automation" or user ID if manual
  },
  { timestamps: true }
);

// Indexes for efficient querying
socialMediaEngagementSchema.index({ business: 1, platform: 1 });
socialMediaEngagementSchema.index({ business: 1, createdAt: -1 });
socialMediaEngagementSchema.index({ platform: 1, status: 1 });
socialMediaEngagementSchema.index({ business: 1, "originalPost.postedAt": -1 });

module.exports = mongoose.model("SocialMediaEngagement", socialMediaEngagementSchema);
