const mongoose = require("mongoose");

const registrationFollowupSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },

    // Business owner/contact details
    contactEmail: {
      type: String,
      required: true,
    },

    contactPhone: String, // For WhatsApp follow-ups

    contactName: String,

    businessName: String,

    // Registration details
    registeredAt: {
      type: Date,
      required: true,
    },

    // Follow-up sequence
    followupSequence: [
      {
        sequenceNumber: Number,
        channel: {
          type: String,
          enum: ["email", "whatsapp", "sms"],
          required: true,
        },
        templateId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FollowupTemplate",
        },
        templateContent: {
          subject: String, // for email
          body: String,
          cta: String, // Call to action
        },
        scheduledFor: Date,
        sentAt: Date,
        status: {
          type: String,
          enum: ["pending", "sent", "failed", "bounced", "opened"],
          default: "pending",
        },
        deliveryStatus: {
          type: String,
          enum: ["pending", "delivered", "failed"],
        },
        openedAt: Date,
        clickedAt: Date,
        clickedLinks: [String],
        error: String,
      },
    ],

    // Campaign assignment
    assignedCampaigns: [
      {
        campaignId: mongoose.Schema.Types.ObjectId,
        campaignName: String,
        addedAt: Date,
      },
    ],

    // Engagement tracking
    engagementMetrics: {
      totalEmailsSent: {
        type: Number,
        default: 0,
      },
      emailsOpened: {
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
      linksClicked: {
        type: Number,
        default: 0,
      },
      converted: {
        type: Boolean,
        default: false,
      },
      conversionDate: Date,
      conversionValue: Number, // If tracked
    },

    // Interaction tracking
    interactions: [
      {
        type: {
          type: String,
          enum: ["email_open", "email_click", "whatsapp_read", "whatsapp_reply", "conversion"],
        },
        timestamp: Date,
        metadata: mongoose.Schema.Types.Mixed,
      },
    ],

    // AI-generated follow-up
    aiGenerated: {
      type: Boolean,
      default: false,
    },

    aiGenerationModel: String,

    // Status and lifecycle
    status: {
      type: String,
      enum: ["in_sequence", "completed", "paused", "unsubscribed", "converted"],
      default: "in_sequence",
    },

    pausedAt: Date,

    pauseReason: String,

    completedAt: Date,

    // Preferences
    unsubscribedAt: Date,

    preferences: {
      allowEmail: {
        type: Boolean,
        default: true,
      },
      allowWhatsapp: {
        type: Boolean,
        default: true,
      },
      allowSms: {
        type: Boolean,
        default: false,
      },
      frequency: {
        type: String,
        enum: ["daily", "every_2_days", "weekly", "biweekly"],
        default: "every_2_days",
      },
    },

    // Notes
    notes: String,

    // Last activity
    lastActivityAt: Date,

    lastActivityType: String,
  },
  { timestamps: true }
);

// Indexes
registrationFollowupSchema.index({ business: 1 });
registrationFollowupSchema.index({ business: 1, status: 1 });
registrationFollowupSchema.index({ contactEmail: 1 });
registrationFollowupSchema.index({ business: 1, registeredAt: -1 });
registrationFollowupSchema.index({ business: 1, "engagementMetrics.converted": 1 });
registrationFollowupSchema.index({ business: 1, lastActivityAt: -1 });

module.exports = mongoose.model("RegistrationFollowup", registrationFollowupSchema);
