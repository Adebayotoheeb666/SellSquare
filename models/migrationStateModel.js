const mongoose = require("mongoose");

const migrationStateSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessRegistration",
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed"],
      default: "pending",
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    lastRunAt: {
      type: Date,
      default: null,
    },
    error: {
      type: String,
      default: "",
    },
    metrics: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

migrationStateSchema.index({ business: 1, key: 1 }, { unique: true });

const MigrationState = mongoose.model("MigrationState", migrationStateSchema);

module.exports = MigrationState;
