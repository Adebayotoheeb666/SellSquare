const mongoose = require("mongoose");

const ActivitiesSchema = mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "BusinessRegistration",
    },
    activity: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Add index for efficient cleanup query
ActivitiesSchema.index({ createdAt: 1 });
// Compound index for efficient business-specific queries
ActivitiesSchema.index({ business: 1, createdAt: -1 });

const Activites = mongoose.model("Activities", ActivitiesSchema);
module.exports = Activites;
