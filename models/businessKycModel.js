const mongoose = require("mongoose");
const { Schema } = mongoose;

const businessKycSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "submitted", "under_review", "approved", "rejected"],
      default: "draft",
      index: true,
    },
    submittedAt: Date,
    reviewedAt: Date,
    reviewedBy: String,
    rejectionReason: String,
    resubmissionCount: {
      type: Number,
      default: 0,
    },

    // KYC form fields
    ownerFullName: {
      type: String,
      trim: true,
    },
    ownerNationalIdNumber: {
      type: String,
      trim: true,
    },
    ownerIdDocumentUrl: String, // uploaded file path
    businessRegNumber: {
      type: String,
      trim: true,
    },
    businessRegDocumentUrl: String, // uploaded file path
    businessAddress: {
      street: String,
      city: String,
      state: String,
      country: {
        type: String,
        default: "Nigeria",
      },
    },
    bankAccountName: {
      type: String,
      trim: true,
    },
    bankAccountNumber: {
      type: String,
      trim: true,
    },
    bankName: {
      type: String,
      trim: true,
    },

    // Set by system on approval
    storeToken: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    storeLinkGeneratedAt: Date,
    approvedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("BusinessKyc", businessKycSchema);
