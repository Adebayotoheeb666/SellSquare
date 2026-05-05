const asyncHandler = require("express-async-handler");
const KYC = require("../models/kycModel");
const BusinessRegistration = require("../models/businessRegistration");

// Submit or update KYC information
const submitKYC = asyncHandler(async (req, res) => {
  const { businessId } = req.body;
  const business = req.business; // From auth middleware

  // Ensure user can only submit KYC for their own business
  if (business._id.toString() !== businessId) {
    return res.status(403).json({ message: "Unauthorized access" });
  }

  // Extract file URLs from upload if applicable
  const kycData = {
    business: businessId,
    businessName: req.body.businessName,
    businessRegistrationNumber: req.body.businessRegistrationNumber,
    businessRegistrationType: req.body.businessRegistrationType,
    businessDocument: req.body.businessDocument || undefined,
    ownerFullName: req.body.ownerFullName,
    ownerNationalId: req.body.ownerNationalId,
    ownerIdDocument: req.body.ownerIdDocument || undefined,
    ownerProofOfAddress: req.body.ownerProofOfAddress || undefined,
    businessProofOfAddress: req.body.businessProofOfAddress || undefined,
    bankAccountName: req.body.bankAccountName,
    bankAccountNumber: req.body.bankAccountNumber,
    bankName: req.body.bankName,
    bankCountry: req.body.bankCountry,
    bankSwiftCode: req.body.bankSwiftCode,
    bankProofDocument: req.body.bankProofDocument || undefined,
    status: "pending",
    submittedAt: new Date(),
  };

  let kyc = await KYC.findOne({ business: businessId });

  if (kyc) {
    // Update existing KYC if it's not already approved
    if (kyc.status === "approved") {
      return res.status(400).json({
        message: "This business is already KYC verified and cannot be updated",
      });
    }
    Object.assign(kyc, kycData);
    kyc.status = "pending"; // Reset to pending on resubmission
  } else {
    // Create new KYC record
    kyc = new KYC(kycData);
  }

  await kyc.save();

  res.status(201).json({
    message: "KYC submitted successfully",
    kyc,
  });
});

// Get KYC status for current business
const getKYCStatus = asyncHandler(async (req, res) => {
  const business = req.business;

  const kyc = await KYC.findOne({ business: business._id }).lean();

  if (!kyc) {
    return res.status(404).json({
      message: "No KYC record found",
      kyc: null,
      status: "not_submitted",
    });
  }

  res.status(200).json({
    message: "KYC record retrieved successfully",
    kyc,
  });
});

// Get all pending/under-review KYCs for admin verification
const getAllKYCsForVerification = asyncHandler(async (req, res) => {
  const { status = "pending", page = 1, limit = 20 } = req.query;
  const business = req.business;

  // Check if user is admin (has access to admin routes)
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const query = {};
  if (status && status !== "all") {
    query.status = status;
  }

  const kycs = await KYC.find(query)
    .populate("business", "businessName businessEmail businessOwner industry country")
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await KYC.countDocuments(query);

  res.status(200).json({
    message: "KYC records retrieved successfully",
    kycs,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// Verify/approve a KYC submission
const verifyKYC = asyncHandler(async (req, res) => {
  const { kycId } = req.params;
  const { approved, rejectionReason, verificationNotes } = req.body;
  const business = req.business; // admin business

  const kyc = await KYC.findById(kycId);

  if (!kyc) {
    return res.status(404).json({ message: "KYC record not found" });
  }

  kyc.status = approved ? "approved" : "rejected";
  kyc.verifiedBy = business._id;
  kyc.verificationDate = new Date();
  kyc.verificationNotes = verificationNotes;
  if (!approved) {
    kyc.rejectionReason = rejectionReason;
  }

  await kyc.save();

  res.status(200).json({
    message: `KYC ${approved ? "approved" : "rejected"} successfully`,
    kyc,
  });
});

module.exports = {
  submitKYC,
  getKYCStatus,
  getAllKYCsForVerification,
  verifyKYC,
};
