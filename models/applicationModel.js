const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
    },
    position: {
      type: String,
      enum: [
        "Social Media Manager",
        "Email Marketing Specialist",
        "Growth Marketing Lead",
      ],
      required: true,
    },
    portfolioUrl: {
      type: String,
      default: "",
    },
    message: {
      type: String,
      default: "",
    },
    cvFileName: {
      type: String,
      required: true,
    },
    cvPath: {
      type: String,
      required: true,
    },
    coverLetterFileName: {
      type: String,
      required: true,
    },
    coverLetterPath: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["received", "reviewing", "interview", "rejected", "accepted"],
      default: "received",
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const Application = mongoose.model("Application", applicationSchema);

module.exports = Application;
