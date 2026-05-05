import axios from "../utils/axiosConfig";

const BUYER_API_BASE = "/api/buyer/marketplace";

/**
 * Phase 3: Cart Hold Operations
 */

const createOrUpdateHold = (data) => {
  return axios.post(`${BUYER_API_BASE}/cart/hold`, data);
};

const releaseHold = (productId) => {
  return axios.delete(`${BUYER_API_BASE}/cart/hold/${productId}`);
};

const getCartHolds = () => {
  return axios.get(`${BUYER_API_BASE}/cart/holds`);
};

const refreshCartHolds = () => {
  return axios.post(`${BUYER_API_BASE}/cart/heartbeat`);
};

/**
 * Phase 4: Product Listings & Discovery
 */

const getListings = (params = {}) => {
  return axios.get(`${BUYER_API_BASE}/products`, { params });
};

const getProductsByIds = (ids) => {
  return axios.get(`${BUYER_API_BASE}/products`, { params: { ids: ids.join(",") } });
};

const getProductDetail = (productId) => {
  return axios.get(`${BUYER_API_BASE}/products/${productId}`);
};

const getStoreInfo = (storeToken) => {
  return axios.get(`${BUYER_API_BASE}/store`, { params: { storeToken } });
};

/**
 * Phase 5: Checkout & Escrow
 */

const checkout = (data) => {
  return axios.post(`${BUYER_API_BASE}/orders/checkout`, data);
};

const buyerMarketplaceService = {
  // Phase 3
  createOrUpdateHold,
  releaseHold,
  getCartHolds,
  refreshCartHolds,
  // Phase 4
  getListings,
  getProductsByIds,
  getProductDetail,
  getStoreInfo,
  // Phase 5
  checkout,
};

export default buyerMarketplaceService;
