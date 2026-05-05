import axios from "axios";

const MARKETPLACE_BASE_URL = "/api/public/v1/marketplace";
const API_URL = "/api/public/v1/marketplace/internal";
const AUTH_API_URL = "/api/public/v1/marketplace/auth";

const getMarketplaceOrders = async ({ status = "" } = {}) => {
  const query = new URLSearchParams();
  if (status) query.set("status", status);

  const response = await axios.get(`${API_URL}/orders?${query.toString()}`);
  return response.data;
};

const getMarketplaceOrder = async (orderId) => {
  const response = await axios.get(`${API_URL}/orders/${orderId}`);
  return response.data;
};

const confirmMarketplacePayment = async (orderId, payload = {}) => {
  const response = await axios.post(`${API_URL}/orders/${orderId}/payment-confirm`, payload);
  return response.data;
};

const updateMarketplaceOrderStatus = async (orderId, payload) => {
  const response = await axios.post(`${API_URL}/orders/${orderId}/status`, payload);
  return response.data;
};

const decideMarketplaceOrderLines = async (orderId, payload) => {
  const response = await axios.post(
    `${API_URL}/orders/${orderId}/lines/decision`,
    payload,
  );
  return response.data;
};

const createMarketplaceApiKey = async (payload) => {
  const response = await axios.post(`${AUTH_API_URL}/keys`, payload);
  return response.data;
};

const listMarketplaceApiKeys = async () => {
  const response = await axios.get(`${AUTH_API_URL}/keys`);
  return response.data;
};

const rotateMarketplaceApiKey = async (keyId) => {
  const response = await axios.post(`${AUTH_API_URL}/keys/${keyId}/rotate`);
  return response.data;
};

const updateMarketplaceApiKey = async (keyId, payload) => {
  const response = await axios.patch(`${AUTH_API_URL}/keys/${keyId}`, payload);
  return response.data;
};

const revokeMarketplaceApiKey = async (keyId) => {
  const response = await axios.post(`${AUTH_API_URL}/keys/${keyId}/revoke`);
  return response.data;
};

const listWebhookEndpoints = async () => {
  const response = await axios.get(`${MARKETPLACE_BASE_URL}/webhooks/endpoints`);
  return response.data;
};

const createWebhookEndpoint = async (payload) => {
  const response = await axios.post(`${MARKETPLACE_BASE_URL}/webhooks/endpoints`, payload);
  return response.data;
};

const updateWebhookEndpoint = async (endpointId, payload) => {
  const response = await axios.patch(
    `${MARKETPLACE_BASE_URL}/webhooks/endpoints/${endpointId}`,
    payload,
  );
  return response.data;
};

const getInternalMarketplaceOrders = async ({ status = "", page = 1, limit = 20 } = {}) => {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  query.set("page", String(page));
  query.set("limit", String(limit));

  const response = await axios.get(`/api/marketplace/internal-orders?${query.toString()}`);
  return response.data;
};

const getInternalMarketplaceOrder = async (orderId) => {
  const response = await axios.get(`/api/marketplace/internal-orders/${orderId}`);
  return response.data;
};

const decideInternalMarketplaceOrder = async (orderId, payload) => {
  const response = await axios.post(`/api/marketplace/internal-orders/${orderId}/decide`, payload);
  return response.data;
};

const updateInternalMarketplaceOrderStatus = async (orderId, payload) => {
  const response = await axios.post(`/api/marketplace/internal-orders/${orderId}/status`, payload);
  return response.data;
};

const marketplaceService = {
  getMarketplaceOrders,
  getMarketplaceOrder,
  confirmMarketplacePayment,
  updateMarketplaceOrderStatus,
  decideMarketplaceOrderLines,
  createMarketplaceApiKey,
  listMarketplaceApiKeys,
  updateMarketplaceApiKey,
  rotateMarketplaceApiKey,
  revokeMarketplaceApiKey,
  listWebhookEndpoints,
  createWebhookEndpoint,
  updateWebhookEndpoint,
  getInternalMarketplaceOrders,
  getInternalMarketplaceOrder,
  decideInternalMarketplaceOrder,
  updateInternalMarketplaceOrderStatus,
};

export default marketplaceService;
