const mongoose = require("mongoose");

const campaignSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessRegistration",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Campaign name is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["draft", "active", "paused", "completed", "failed"],
      default: "draft",
      index: true,
    },
    type: {
      type: String,
      enum: ["scheduled", "event-triggered", "manual"],
      required: true,
      index: true,
    },
    channels: {
      type: [
        {
          type: {
            type: String,
            enum: ["email", "whatsapp", "sms"],
            required: true,
          },
          templateId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Template",
            required: true,
          },
        },
      ],
      required: [true, "At least one channel with template is required"],
      validate: [
        {
          validator: function (v) {
            return v.length > 0;
          },
          message: "At least one channel is required",
        },
      ],
    },
    triggerConfig: {
      scheduleType: {
        type: String,
        enum: ["once", "recurring"],
        default: "once",
      },
      scheduledFor: Date,
      recurrance: {
        frequency: {
          type: String,
          enum: ["daily", "weekly", "monthly", "custom"],
        },
        interval: {
          type: Number,
          default: 1,
        },
        daysOfWeek: [Number],
        dayOfMonth: Number,
        time: String,
      },
      eventType: {
        type: String,
        enum: [
          "order_created",
          "order_completed",
          "customer_signup",
          "product_purchase",
          "cart_abandoned",
          "payment_failed",
          "custom_event",
        ],
      },
      eventConditions: mongoose.Schema.Types.Mixed,
    },
    targetAudience: {
      type: {
        type: String,
        enum: ["all_customers", "segment", "email_list", "custom"],
        default: "all_customers",
      },
      segmentId: mongoose.Schema.Types.ObjectId,
      emailList: [
        {
          email: String,
          name: String,
          metadata: mongoose.Schema.Types.Mixed,
        },
      ],
      filter: mongoose.Schema.Types.Mixed,
    },
    variableMapping: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    executionLimit: {
      type: {
        type: String,
        enum: ["unlimited", "max_recipients"],
        default: "unlimited",
      },
      maxRecipients: Number,
    },
    stats: {
      totalSent: {
        type: Number,
        default: 0,
      },
      totalFailed: {
        type: Number,
        default: 0,
      },
      totalDelivered: {
        type: Number,
        default: 0,
      },
      totalOpened: {
        type: Number,
        default: 0,
      },
      totalClicked: {
        type: Number,
        default: 0,
      },
      lastExecutedAt: Date,
      nextScheduledFor: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Email",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Email",
    },
  },
  { timestamps: true }
);

campaignSchema.index({ business: 1, status: 1 });
campaignSchema.index({ business: 1, type: 1 });
campaignSchema.index({ business: 1, "stats.nextScheduledFor": 1 });

const Campaign = mongoose.model("Campaign", campaignSchema);

module.exports = Campaign;
