import axios from "../utils/axiosConfig";

const KYC_API_BASE = "/api/kyc";

/**
 * Submit or Update KYC Information
 * Sends business KYC documentation to backend for review
 */
const submitKyc = (formData) => {
  return axios.post(`${KYC_API_BASE}/submit`, formData);
};

/**
 * Get KYC Status
 * Returns current KYC status for authenticated business
 */
const getKycStatus = () => {
  return axios.get(`${KYC_API_BASE}/status`);
};

/**
 * Generate Store Token
 * Creates an idempotent store token for approved businesses
 * Calling multiple times returns the same token
 */
const generateStoreToken = () => {
  return axios.post(`${KYC_API_BASE}/generate-store-token`);
};

/**
 * Admin: List all KYC submissions
 * Returns paginated list of KYC records for admin review
 */
const listKycForAdmin = (params = {}) => {
  return axios.get(`${KYC_API_BASE}/admin/list`, { params });
};

/**
 * Admin: Get KYC for specific business
 * Returns full KYC details for a business (admin view)
 */
const getKycForBusiness = (businessId) => {
  return axios.get(`${KYC_API_BASE}/admin/business/${businessId}`);
};

/**
 * Admin: Approve KYC
 * Approves a KYC submission and generates store token
 */
const approveKyc = (businessId) => {
  return axios.post(`${KYC_API_BASE}/admin/business/${businessId}/approve`);
};

/**
 * Admin: Reject KYC
 * Rejects a KYC submission with a reason
 */
const rejectKyc = (businessId, rejectionReason) => {
  return axios.post(`${KYC_API_BASE}/admin/business/${businessId}/reject`, {
    rejectionReason,
  });
};

const kycService = {
  // Business routes
  submitKyc,
  getKycStatus,
  generateStoreToken,
  // Admin routes
  listKycForAdmin,
  getKycForBusiness,
  approveKyc,
  rejectKyc,
};

export default kycService;
