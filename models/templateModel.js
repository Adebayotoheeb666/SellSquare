const mongoose = require("mongoose");

const templateSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessRegistration",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Template name is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    type: {
      type: String,
      enum: ["email", "whatsapp", "sms"],
      required: [true, "Template type is required"],
      index: true,
    },
    category: {
      type: String,
      enum: [
        "transactional",
        "marketing",
        "operational",
        "abandoned-cart",
        "welcome",
        "confirmation",
        "reminder",
        "custom",
      ],
      default: "custom",
      index: true,
    },
    subject: {
      type: String,
      default: "",
    },
    body: {
      type: String,
      required: [true, "Template body is required"],
    },
    variables: {
      type: [String],
      default: [],
    },
    attachments: {
      type: [
        {
          type: {
            type: String,
            enum: ["file", "dynamic"],
          },
          name: String,
          url: String,
          path: String,
          dynamicSource: String,
        },
      ],
      default: [],
    },
    previewData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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

templateSchema.index({ business: 1, name: 1 });
templateSchema.index({ business: 1, type: 1 });
templateSchema.index({ business: 1, isActive: 1 });

const Template = mongoose.model("Template", templateSchema);

module.exports = Template;
