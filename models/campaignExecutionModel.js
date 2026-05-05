const mongoose = require("mongoose");

const campaignExecutionSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessRegistration",
      required: true,
      index: true,
    },
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    recipient: {
      email: String,
      phone: String,
      customerId: mongoose.Schema.Types.ObjectId,
      metadata: mongoose.Schema.Types.Mixed,
    },
    channels: [
      {
        type: {
          type: String,
          enum: ["email", "whatsapp", "sms"],
        },
        status: {
          type: String,
          enum: ["pending", "sent", "failed", "delivered"],
          default: "pending",
        },
        messageId: String,
        sentAt: Date,
        deliveredAt: Date,
        failureReason: String,
        response: mongoose.Schema.Types.Mixed,
      },
    ],
    engagement: {
      opened: {
        type: Boolean,
        default: false,
      },
      openedAt: Date,
      clicked: {
        type: Boolean,
        default: false,
      },
      clickedAt: Date,
      clickedLinks: [
        {
          url: String,
          clickedAt: Date,
          count: {
            type: Number,
            default: 1,
          },
        },
      ],
      replied: {
        type: Boolean,
        default: false,
      },
      repliedAt: Date,
    },
    variables: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    error: {
      message: String,
      stack: String,
      timestamp: Date,
    },
    attemptCount: {
      type: Number,
      default: 1,
    },
    nextRetryAt: Date,
  },
  { timestamps: true }
);

campaignExecutionSchema.index({ business: 1, campaign: 1 });
campaignExecutionSchema.index({ business: 1, "channels.status": 1 });
campaignExecutionSchema.index({ campaign: 1, "engagement.opened": 1 });
campaignExecutionSchema.index({ campaign: 1, createdAt: 1 });

const CampaignExecution = mongoose.model(
  "CampaignExecution",
  campaignExecutionSchema
);

module.exports = CampaignExecution;
