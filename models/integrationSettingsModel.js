const mongoose = require("mongoose");

const integrationSettingsSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },

    // TikTok Integration
    tiktok: {
      enabled: {
        type: Boolean,
        default: false,
      },
      apiKey: {
        type: String,
        default: null,
        select: false, // Never select by default for security
      },
      apiSecret: {
        type: String,
        default: null,
        select: false,
      },
      accessToken: {
        type: String,
        default: null,
        select: false,
      },
      refreshToken: {
        type: String,
        default: null,
        select: false,
      },
      businessAccountId: {
        type: String,
        default: null,
      },
      status: {
        type: String,
        enum: ["connected", "disconnected", "error"],
        default: "disconnected",
      },
      connectedAt: Date,
      lastSyncedAt: Date,
      syncError: String,
      automationSettings: {
        monitoringEnabled: {
          type: Boolean,
          default: false,
        },
        engagementEnabled: {
          type: Boolean,
          default: false,
        },
        contentGenerationEnabled: {
          type: Boolean,
          default: false,
        },
        contentApprovalRequired: {
          type: Boolean,
          default: true,
        },
        postingFrequency: {
          type: String,
          enum: ["daily", "weekly", "biweekly", "monthly"],
          default: "weekly",
        },
        jobSchedule: {
          type: String,
          default: "0 */6 * * *", // default to every 6 hours
        },
        engagementKeywords: [String], // Keywords to look for in recent posts
      },
    },

    // Instagram Integration
    instagram: {
      enabled: {
        type: Boolean,
        default: false,
      },
      apiKey: {
        type: String,
        default: null,
        select: false,
      },
      accessToken: {
        type: String,
        default: null,
        select: false,
      },
      refreshToken: {
        type: String,
        default: null,
        select: false,
      },
      businessAccountId: {
        type: String,
        default: null,
      },
      igUserId: {
        type: String,
        default: null,
      },
      status: {
        type: String,
        enum: ["connected", "disconnected", "error"],
        default: "disconnected",
      },
      connectedAt: Date,
      lastSyncedAt: Date,
      syncError: String,
      automationSettings: {
        monitoringEnabled: {
          type: Boolean,
          default: false,
        },
        engagementEnabled: {
          type: Boolean,
          default: false,
        },
        contentGenerationEnabled: {
          type: Boolean,
          default: false,
        },
        contentApprovalRequired: {
          type: Boolean,
          default: true,
        },
        postingFrequency: {
          type: String,
          enum: ["daily", "weekly", "biweekly", "monthly"],
          default: "weekly",
        },
        jobSchedule: {
          type: String,
          default: "0 3 * * *", // default to once a day at 3am
        },
        engagementKeywords: [String],
      },
    },

    // WhatsApp Integration
    whatsapp: {
      enabled: {
        type: Boolean,
        default: false,
      },
      businessPhoneNumberId: {
        type: String,
        default: null,
      },
      accessToken: {
        type: String,
        default: null,
        select: false,
      },
      webhookToken: {
        type: String,
        default: null,
        select: false,
      },
      status: {
        type: String,
        enum: ["connected", "disconnected", "error"],
        default: "disconnected",
      },
      connectedAt: Date,
      lastSyncedAt: Date,
      syncError: String,
      automationSettings: {
        followupEnabled: {
          type: Boolean,
          default: false,
        },
        messageTemplate: String,
        delayHours: {
          type: Number,
          default: 24,
        },
        campaignFrequency: {
          type: String,
          enum: ["once", "weekly", "biweekly", "monthly"],
          default: "once",
        },
        jobSchedule: {
          type: String,
          default: "*/30 * * * *", // every 30 mins
        },
      },
    },

    // Email Integration
    email: {
      enabled: {
        type: Boolean,
        default: false,
      },
      provider: {
        type: String,
        enum: ["sendgrid", "mailgun", "aws_ses", "custom_smtp"],
        default: "sendgrid",
      },
      apiKey: {
        type: String,
        default: null,
        select: false,
      },
      senderEmail: String,
      senderName: String,
      status: {
        type: String,
        enum: ["connected", "disconnected", "error"],
        default: "disconnected",
      },
      connectedAt: Date,
      lastSyncedAt: Date,
      syncError: String,
      automationSettings: {
        followupEnabled: {
          type: Boolean,
          default: false,
        },
        sequenceTemplate: String,
        delayHours: {
          type: Number,
          default: 24,
        },
        campaignFrequency: {
          type: String,
          enum: ["once", "weekly", "biweekly", "monthly"],
          default: "once",
        },
        jobSchedule: {
          type: String,
          default: "*/30 * * * *", // every 30 mins
        },
      },
    },

    // Eleven Labs Integration (for content generation)
    elevenLabs: {
      enabled: {
        type: Boolean,
        default: false,
      },
      apiKey: {
        type: String,
        default: null,
        select: false,
      },
      voiceId: {
        type: String,
        default: null,
      },
      status: {
        type: String,
        enum: ["connected", "disconnected", "error"],
        default: "disconnected",
      },
      connectedAt: Date,
      syncError: String,
    },

    // Global Automation Schedules
    contentPublishingSchedule: {
      type: String,
      default: "0 */4 * * *", // every 4 hours
    },
  },
  { timestamps: true }
);

// Compound index for business
integrationSettingsSchema.index({ business: 1 });

// Ensure only one integration settings per business
integrationSettingsSchema.index({ business: 1 }, { unique: true });

module.exports = mongoose.model("IntegrationSettings", integrationSettingsSchema);
