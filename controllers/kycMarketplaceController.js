const asyncHandler = require("express-async-handler");
const BusinessKyc = require("../models/businessKycModel");
const Business = require("../models/businessRegistration");
const crypto = require("crypto");
const {
  sendKycApprovalEmail,
  sendKycRejectionEmail,
  sendAdminKycNotification,
} = require("../services/marketplace/kycEmailService");

/**
 * Submit or Update KYC for Marketplace
 * [requires `protect`]
 * Allows businesses to submit KYC documentation for marketplace approval
 */
const submitKYC = asyncHandler(async (req, res) => {
  const business = req.business; // From auth middleware

  // Check if business is already approved
  let businessKyc = await BusinessKyc.findOne({ business: business._id });

  if (businessKyc && businessKyc.status === "approved") {
    res.status(400);
    throw new Error("Your business is already approved for the marketplace. You cannot resubmit.");
  }

  if (businessKyc && businessKyc.status === "under_review") {
    res.status(400);
    throw new Error("Your KYC is currently under review. Please wait for the review to complete.");
  }

  // Extract form data
  const {
    ownerFullName,
    ownerNationalIdNumber,
    businessRegNumber,
    businessRegDocumentUrl,
    ownerIdDocumentUrl,
    businessAddress,
    bankAccountName,
    bankAccountNumber,
    bankName,
  } = req.body;

  let parsedAddress = businessAddress;
  if (typeof businessAddress === "string") {
    try {
      parsedAddress = JSON.parse(businessAddress);
    } catch (error) {
      parsedAddress = {};
    }
  }

  const ownerIdDocumentPath = req.files?.ownerIdDocument?.[0]?.path || ownerIdDocumentUrl;
  const businessRegDocumentPath =
    req.files?.businessRegDocument?.[0]?.path || businessRegDocumentUrl;

  // Validation
  if (!ownerFullName || !ownerNationalIdNumber || !businessRegNumber) {
    res.status(400);
    throw new Error("Please provide all required owner and business information");
  }

  if (!bankAccountName || !bankAccountNumber || !bankName) {
    res.status(400);
    throw new Error("Please provide complete bank account information");
  }

  const kycData = {
    business: business._id,
    status: "submitted",
    submittedAt: new Date(),
    ownerFullName: ownerFullName.trim(),
    ownerNationalIdNumber: ownerNationalIdNumber.trim(),
    ownerIdDocumentUrl: ownerIdDocumentPath,
    businessRegNumber: businessRegNumber.trim(),
    businessRegDocumentUrl: businessRegDocumentPath,
    businessAddress: {
      street: parsedAddress?.street?.trim() || "",
      city: parsedAddress?.city?.trim() || "",
      state: parsedAddress?.state?.trim() || "",
      country: parsedAddress?.country || "Nigeria",
    },
    bankAccountName: bankAccountName.trim(),
    bankAccountNumber: bankAccountNumber.trim(),
    bankName: bankName.trim(),
  };

  if (businessKyc) {
    // Update existing KYC
    Object.assign(businessKyc, kycData);
    businessKyc.resubmissionCount = (businessKyc.resubmissionCount || 0) + 1;
  } else {
    // Create new KYC
    businessKyc = new BusinessKyc(kycData);
  }

  await businessKyc.save();

  // Send admin notification for new/resubmitted KYC
  const businessPopulated = await Business.findById(business._id);
  await sendAdminKycNotification(businessPopulated, businessKyc);

  res.status(201).json({
    message: "KYC submitted successfully. Please wait for admin review.",
    data: businessKyc,
  });
});

/**
 * Get KYC Status for Current Business
 * [requires `protect`]
 * Returns the current KYC status and details for the authenticated business
 */
const getKYCStatus = asyncHandler(async (req, res) => {
  const business = req.business;

  const businessKyc = await BusinessKyc.findOne({ business: business._id });

  if (!businessKyc) {
    return res.status(200).json({
      message: "No KYC record found",
      data: null,
      status: "not_submitted",
    });
  }

  res.status(200).json({
    message: "KYC record retrieved successfully",
    data: businessKyc,
  });
});

/**
 * List KYCs for Admin Review
 * [requires `protect` + `adminMiddleware`]
 * Returns paginated list of KYC submissions for admin review
 */
const listKYCs = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const query = {};

  // Filter by status if provided
  if (status && status !== "all") {
    const validStatuses = ["draft", "submitted", "under_review", "approved", "rejected"];
    if (validStatuses.includes(status)) {
      query.status = status;
    }
  }

  const kycs = await BusinessKyc.find(query)
    .populate("business", "businessName businessEmail industry")
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ submittedAt: -1 });

  const total = await BusinessKyc.countDocuments(query);

  res.status(200).json({
    message: "KYC records retrieved successfully",
    data: kycs,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

/**
 * Get KYC for Specific Business (Admin)
 * [requires `protect` + `adminMiddleware`]
 * Returns full KYC details for a specific business
 */
const getKYCForBusiness = asyncHandler(async (req, res) => {
  const { businessId } = req.params;

  const businessKyc = await BusinessKyc.findOne({ business: businessId }).populate(
    "business",
    "businessName businessEmail industry address"
  );

  if (!businessKyc) {
    res.status(404);
    throw new Error("KYC record not found for this business");
  }

  res.status(200).json({
    message: "KYC record retrieved successfully",
    data: businessKyc,
  });
});

/**
 * Approve KYC (Admin)
 * [requires `protect` + `adminMiddleware`]
 * Approves a KYC submission and generates a store token
 */
const approveKYC = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const adminBusiness = req.business;

  const businessKyc = await BusinessKyc.findOne({ business: businessId });

  if (!businessKyc) {
    res.status(404);
    throw new Error("KYC record not found");
  }

  if (businessKyc.status === "approved") {
    res.status(400);
    throw new Error("This KYC is already approved");
  }

  // Update KYC status
  businessKyc.status = "approved";
  businessKyc.approvedAt = new Date();
  businessKyc.reviewedAt = new Date();
  businessKyc.reviewedBy = adminBusiness.businessEmail;

  // Generate store token if not already generated
  if (!businessKyc.storeToken) {
    businessKyc.storeToken = crypto.randomBytes(16).toString("hex");
    businessKyc.storeLinkGeneratedAt = new Date();
  }

  await businessKyc.save();

  // Send approval email to business
  const approvedBusiness = await Business.findById(businessId);
  await sendKycApprovalEmail(approvedBusiness, businessKyc);

  res.status(200).json({
    message: "KYC approved successfully. Store token generated.",
    data: businessKyc,
  });
});

/**
 * Reject KYC (Admin)
 * [requires `protect` + `adminMiddleware`]
 * Rejects a KYC submission with a reason
 */
const rejectKYC = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const { rejectionReason } = req.body;
  const adminBusiness = req.business;

  if (!rejectionReason || !rejectionReason.trim()) {
    res.status(400);
    throw new Error("Rejection reason is required");
  }

  const businessKyc = await BusinessKyc.findOne({ business: businessId });

  if (!businessKyc) {
    res.status(404);
    throw new Error("KYC record not found");
  }

  if (businessKyc.status === "approved") {
    res.status(400);
    throw new Error("Cannot reject an already approved KYC");
  }

  // Update KYC status
  businessKyc.status = "rejected";
  businessKyc.rejectionReason = rejectionReason.trim();
  businessKyc.reviewedAt = new Date();
  businessKyc.reviewedBy = adminBusiness.businessEmail;

  await businessKyc.save();

  // Send rejection email to business
  const rejectedBusiness = await Business.findById(businessId);
  await sendKycRejectionEmail(rejectedBusiness, businessKyc, rejectionReason.trim());

  res.status(200).json({
    message: "KYC rejected successfully",
    data: businessKyc,
  });
});

/**
 * Generate Store Token (Marketplace)
 * [requires `protect`]
 * Generates an idempotent store token for approved businesses
 * Calling this multiple times returns the same token
 */
const generateStoreToken = asyncHandler(async (req, res) => {
  const business = req.business;

  const businessKyc = await BusinessKyc.findOne({ business: business._id });

  if (!businessKyc) {
    res.status(404);
    throw new Error("KYC record not found. Please submit KYC first.");
  }

  if (businessKyc.status !== "approved") {
    res.status(400);
    throw new Error("Your business is not approved for the marketplace yet");
  }

  // If token already exists, return it (idempotent)
  if (businessKyc.storeToken) {
    return res.status(200).json({
      message: "Store token generated successfully",
      data: {
        storeToken: businessKyc.storeToken,
        storeUrl: `${process.env.CLIENT_URL || "https://app.sellsquare.io"}/marketplace/store/${businessKyc.storeToken}`,
      },
    });
  }

  // Generate new token
  businessKyc.storeToken = crypto.randomBytes(16).toString("hex");
  businessKyc.storeLinkGeneratedAt = new Date();

  await businessKyc.save();

  res.status(200).json({
    message: "Store token generated successfully",
    data: {
      storeToken: businessKyc.storeToken,
      storeUrl: `${process.env.CLIENT_URL || "https://app.sellsquare.io"}/marketplace/store/${businessKyc.storeToken}`,
    },
  });
});

module.exports = {
  submitKYC,
  getKYCStatus,
  listKYCs,
  getKYCForBusiness,
  approveKYC,
  rejectKYC,
  generateStoreToken,
};
