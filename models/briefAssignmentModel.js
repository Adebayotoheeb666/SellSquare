const mongoose = require("mongoose");

const briefAssignmentSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["sent", "submitted", "reviewed", "expired"],
      default: "sent",
    },
    instructions: {
      type: String,
      default: "",
    },
    dueDate: {
      type: Date,
    },
    responses: {
      campaignIdea: { type: String, default: "" },
      channelPlan: { type: String, default: "" },
      measurementPlan: { type: String, default: "" },
      links: { type: String, default: "" },
    },
    submittedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

const BriefAssignment = mongoose.model(
  "BriefAssignment",
  briefAssignmentSchema
);

module.exports = BriefAssignment;
