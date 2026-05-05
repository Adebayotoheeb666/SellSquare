const mongoose = require("mongoose");

const followupCampaignSchema = new mongoose.Schema(
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

    // Campaign type
    type: {
      type: String,
      enum: ["registration_welcome", "onboarding", "re_engagement", "feature_announcement", "promotional", "custom"],
      default: "custom",
    },

    // Campaign scope
    targetAudience: {
      type: String,
      enum: ["all_new_registrations", "specific_segment", "custom_list"],
      default: "all_new_registrations",
    },

    // Targeting criteria
    targetingCriteria: {
      minDaysAfterRegistration: Number,
      maxDaysAfterRegistration: Number,
      minProductCount: Number,
      subscriptionPlans: [String],
      customTags: [String],
    },

    // Campaign messaging
    channels: {
      type: [String],
      enum: ["email", "whatsapp", "sms"],
      required: true,
    },

    // Sequence of messages
    messageSequence: [
      {
        sequenceNumber: Number,
        channel: {
          type: String,
          enum: ["email", "whatsapp", "sms"],
        },
        templateId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FollowupTemplate",
        },
        sendAfterHours: {
          type: Number,
          description: "Hours after previous message to send this",
          default: 24,
        },
        sendAtDay: {
          type: String,
          enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
        },
        sendAtTime: {
          type: String,
          description: "HH:mm format",
        },
        description: String,
      },
    ],

    // Campaign status
    status: {
      type: String,
      enum: ["draft", "active", "paused", "completed", "archived"],
      default: "draft",
    },

    // Campaign timing
    startDate: Date,

    endDate: Date,

    pausedAt: Date,

    activatedAt: Date,

    completedAt: Date,

    // Campaign metrics
    metrics: {
      totalRecipientsAdded: {
        type: Number,
        default: 0,
      },
      totalMessagesSent: {
        type: Number,
        default: 0,
      },
      emailsSent: {
        type: Number,
        default: 0,
      },
      emailsOpened: {
        type: Number,
        default: 0,
      },
      emailsClicked: {
        type: Number,
        default: 0,
      },
      emailBouncedCount: {
        type: Number,
        default: 0,
      },
      whatsappMessagesSent: {
        type: Number,
        default: 0,
      },
      whatsappMessagesRead: {
        type: Number,
        default: 0,
      },
      whatsappReplies: {
        type: Number,
        default: 0,
      },
      conversions: {
        type: Number,
        default: 0,
      },
      conversionValue: {
        type: Number,
        default: 0,
      },
    },

    // Performance tracking
    performance: {
      emailOpenRate: Number, // percentage
      emailClickRate: Number, // percentage
      conversionRate: Number, // percentage
      roi: Number, // percentage
      averageResponseTime: Number, // hours
    },

    // A/B Testing
    abTesting: {
      enabled: {
        type: Boolean,
        default: false,
      },
      variants: [
        {
          name: String,
          templateIds: [mongoose.Schema.Types.ObjectId],
          performanceMetrics: {
            openRate: Number,
            clickRate: Number,
            conversionRate: Number,
          },
          winner: Boolean,
        },
      ],
    },

    // Recipients
    recipients: [
      {
        followupId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "RegistrationFollowup",
        },
        status: {
          type: String,
          enum: ["pending", "in_progress", "completed", "failed", "unsubscribed"],
          default: "pending",
        },
        addedAt: Date,
        completedAt: Date,
      },
    ],

    // Budget and limits
    dailyMessageLimit: Number,

    totalBudget: Number,

    budgetSpent: {
      type: Number,
      default: 0,
    },

    // Configuration
    autoAddNewRegistrations: {
      type: Boolean,
      default: true,
      description: "Auto-add new registrations matching criteria",
    },

    retryFailedMessages: {
      type: Boolean,
      default: true,
    },

    respectUserPreferences: {
      type: Boolean,
      default: true,
      description: "Respect opt-out preferences for channels",
    },

    // Created by
    createdBy: mongoose.Schema.Types.ObjectId,

    updatedBy: mongoose.Schema.Types.ObjectId,

    // Tags
    tags: [String],

    // Notes
    notes: String,
  },
  { timestamps: true }
);

// Indexes
followupCampaignSchema.index({ business: 1 });
followupCampaignSchema.index({ business: 1, status: 1 });
followupCampaignSchema.index({ business: 1, createdAt: -1 });
followupCampaignSchema.index({ business: 1, "recipients.followupId": 1 });
followupCampaignSchema.index({ startDate: 1, endDate: 1 });

// Calculate performance metrics before saving
followupCampaignSchema.pre("save", function (next) {
  if (this.metrics.emailsSent > 0) {
    this.performance.emailOpenRate = ((this.metrics.emailsOpened / this.metrics.emailsSent) * 100).toFixed(2);
    this.performance.emailClickRate = ((this.metrics.emailsClicked / this.metrics.emailsSent) * 100).toFixed(2);
  }

  if (this.metrics.totalMessagesSent > 0) {
    this.performance.conversionRate = (
      (this.metrics.conversions / this.metrics.totalMessagesSent) *
      100
    ).toFixed(2);
  }

  next();
});

module.exports = mongoose.model("FollowupCampaign", followupCampaignSchema);
