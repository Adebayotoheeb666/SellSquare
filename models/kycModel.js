const mongoose = require("mongoose");

const kycSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessRegistration",
      required: true,
      unique: true,
    },
    businessName: String,
    businessRegistrationNumber: String,
    businessRegistrationType: {
      type: String,
      enum: ["sole_proprietor", "partnership", "llc", "corporation", "other"],
    },
    businessDocument: {
      url: String,
      type: String, // certificate, license, registration, etc
      uploadedAt: Date,
    },
    ownerFullName: String,
    ownerNationalId: String,
    ownerIdDocument: {
      url: String,
      type: String, // passport, national_id, drivers_license
      uploadedAt: Date,
    },
    ownerProofOfAddress: {
      url: String,
      uploadedAt: Date,
    },
    businessProofOfAddress: {
      url: String,
      uploadedAt: Date,
    },
    bankAccountName: String,
    bankAccountNumber: String,
    bankName: String,
    bankCountry: String,
    bankSwiftCode: String,
    bankProofDocument: {
      url: String,
      uploadedAt: Date,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "under_review"],
      default: "pending",
    },
    rejectionReason: String,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessRegistration", // admin business
    },
    verificationNotes: String,
    verificationDate: Date,
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for quick lookups by business
kycSchema.index({ business: 1 });
kycSchema.index({ status: 1 });

const KYC = mongoose.model("KYC", kycSchema);

module.exports = KYC;
