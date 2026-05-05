import axios from "axios";

const API_URL = "/api/discounts";

// Create discount
const createDiscount = async (discountData) => {
  const response = await axios.post(API_URL, discountData);
  return response.data;
};

// Get all discounts
const getDiscounts = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) {
    params.append("status", filters.status);
  }
  const response = await axios.get(`${API_URL}?${params.toString()}`);
  return response.data;
};

// Get single discount
const getDiscount = async (id) => {
  const response = await axios.get(`${API_URL}/${id}`);
  return response.data;
};

// Update discount
const updateDiscount = async (id, discountData) => {
  const response = await axios.put(`${API_URL}/${id}`, discountData);
  return response.data;
};

// Delete discount
const deleteDiscount = async (id) => {
  const response = await axios.delete(`${API_URL}/${id}`);
  return response.data;
};

// Get products for discount selection
const getProductsForDiscount = async (options = {}) => {
  const params = new URLSearchParams();

  if (options.excludeDiscountId) {
    params.append("excludeDiscountId", options.excludeDiscountId);
  }

  const query = params.toString();
  const response = await axios.get(
    `${API_URL}/products/list${query ? `?${query}` : ""}`,
  );
  return response.data;
};

// Get product groups for discount selection
const getGroupsForDiscount = async () => {
  const response = await axios.get(`${API_URL}/groups/list`);
  return response.data;
};

const discountService = {
  createDiscount,
  getDiscounts,
  getDiscount,
  updateDiscount,
  deleteDiscount,
  getProductsForDiscount,
  getGroupsForDiscount,
};

export default discountService;
