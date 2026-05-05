import axios from "axios";

const API_URL = "/api/admin/marketplace/escrow";

/**
 * List pending escrow releases for super-admin review
 */
const listPendingEscrows = async ({ status = "all", page = 1, limit = 20 } = {}) => {
  const query = new URLSearchParams();
  query.set("status", status);
  query.set("page", String(page));
  query.set("limit", String(limit));

  const response = await axios.get(`${API_URL}/pending?${query.toString()}`);
  return response.data;
};

/**
 * Manually release escrow funds to a business
 */
const releaseEscrow = async (orderId) => {
  const response = await axios.post(`${API_URL}/${orderId}/release`);
  return response.data;
};

const marketplaceAdminService = {
  listPendingEscrows,
  releaseEscrow,
};

export default marketplaceAdminService;
