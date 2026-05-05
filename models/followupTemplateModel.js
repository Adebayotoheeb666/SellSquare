const mongoose = require("mongoose");

const followupTemplateSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    description: String,

    channel: {
      type: String,
      enum: ["email", "whatsapp", "sms"],
      required: true,
    },

    sequencePosition: {
      type: Number,
      description: "Position in the follow-up sequence (1st, 2nd, 3rd, etc.)",
    },

    // Template content
    subject: {
      type: String,
      description: "Email subject line",
    },

    body: {
      type: String,
      required: true,
      description: "Template body with placeholders like {{businessName}}, {{ownerName}}, etc.",
    },

    callToAction: {
      text: String,
      url: String,
      style: {
        type: String,
        enum: ["primary", "secondary"],
        default: "primary",
      },
    },

    // Personalization placeholders
    availablePlaceholders: [
      {
        key: String, // {{businessName}}
        description: String,
      },
    ],

    // Send timing
    sendAfterHours: {
      type: Number,
      description: "Hours after registration to send this message",
      default: 24,
    },

    sendAtDay: {
      type: String,
      enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
      description: "Specific day of week to send (optional)",
    },

    sendAtTime: {
      type: String,
      description: "Specific time to send HH:mm format (optional)",
    },

    // A/B Testing
    abTestGroup: {
      type: String,
      enum: ["control", "variant_a", "variant_b"],
      default: "control",
    },

    // Performance metrics
    metrics: {
      sentCount: {
        type: Number,
        default: 0,
      },
      openCount: {
        type: Number,
        default: 0,
      },
      clickCount: {
        type: Number,
        default: 0,
      },
      conversionCount: {
        type: Number,
        default: 0,
      },
      bounceCount: {
        type: Number,
        default: 0,
      },
      unsubscribeCount: {
        type: Number,
        default: 0,
      },
    },

    // Template type
    templateType: {
      type: String,
      enum: ["welcome", "engagement", "offer", "feature_introduction", "reminder", "re_engagement", "survey", "other"],
      default: "welcome",
    },

    // Status
    active: {
      type: Boolean,
      default: true,
    },

    // Media attachments (for email)
    attachments: [
      {
        type: String, // URLs
      },
    ],

    // Rich content for WhatsApp
    mediaUrl: String, // Image/video URL for WhatsApp

    // Conditions to send
    conditions: {
      minProductCount: {
        type: Number,
        description: "Only send if business has min products",
      },
      minCheckouts: {
        type: Number,
        description: "Only send if business has min checkouts",
      },
      subscriptionPlan: [String], // Only for specific plans
    },

    // Created by
    createdBy: {
      type: String,
      description: "admin or business user ID",
    },

    // Tags for organization
    tags: [String],
  },
  { timestamps: true }
);

// Indexes
followupTemplateSchema.index({ business: 1 });
followupTemplateSchema.index({ business: 1, channel: 1 });
followupTemplateSchema.index({ business: 1, active: 1 });
followupTemplateSchema.index({ business: 1, templateType: 1 });

module.exports = mongoose.model("FollowupTemplate", followupTemplateSchema);
