import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const API_URL = `/api/products/`;

// Create New Product
const createProduct = async (formData) => {
  const response = await axios.post(API_URL, formData);
  return response.data;
};

const createMultipleProducts = async (formData) => {
  const response = await axios.post(`${API_URL}multiple`, formData);
  return response.data;
};

// Get all products
const getProducts = async ({
  page = 1,
  limit = 10,
  search = "",
  category = [],
  warehouse = [],
  priceRange = [],
} = {}) => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (search) params.append("search", search);
  if (category.length > 0) params.append("category", category.join(","));
  if (warehouse.length > 0) params.append("warehouse", warehouse.join(","));
  if (priceRange.length > 0) params.append("priceRange", priceRange.join(","));

  const response = await axios.get(`${API_URL}?${params.toString()}`);
  return response.data;
};

/**
 * Bulk fetch products for client-side pagination
 * Fetches all products (up to limit) in a single request
 * This enables state-driven pagination without backend calls per page
 *
 * @param {Object} options - Options object
 * @param {number} options.limit - Maximum number of products to fetch (default: 1000)
 * @param {string[]} options.category - Category filters
 * @param {string[]} options.warehouse - Warehouse filters
 */
const getProductsBulk = async ({
  limit = 1000,
  category = [],
  warehouse = [],
} = {}) => {
  const params = new URLSearchParams({
    limit: limit.toString(),
  });

  if (category.length > 0) params.append("category", category.join(","));
  if (warehouse.length > 0) params.append("warehouse", warehouse.join(","));

  const response = await axios.get(`${API_URL}bulk?${params.toString()}`);
  return response.data;
};

const getProductsCursor = async ({
  cursor = null,
  limit = 500,
  search = "",
  category = [],
  warehouse = [],
  priceRange = [],
} = {}) => {
  const params = new URLSearchParams({
    limit: String(limit),
  });

  if (cursor) params.append("cursor", cursor);
  if (search) params.append("search", search);
  if (category.length > 0) params.append("category", category.join(","));
  if (warehouse.length > 0) params.append("warehouse", warehouse.join(","));
  if (priceRange.length > 0) params.append("priceRange", priceRange.join(","));

  const response = await axios.get(`${API_URL}cursor?${params.toString()}`);
  return response.data;
};

// Get filter options (all categories and warehouses)
const getFilterOptions = async () => {
  const response = await axios.get(`${API_URL}filter-options`);
  return response.data;
};

const getProductGroups = async ({
  page = 1,
  limit = 10,
  search = "",
  category = [],
  warehouse = [],
  priceRange = [],
} = {}) => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (search) params.append("search", search);
  if (category.length > 0) params.append("category", category.join(","));
  if (warehouse.length > 0) params.append("warehouse", warehouse.join(","));
  if (priceRange.length > 0) params.append("priceRange", priceRange.join(","));

  const response = await axios.get(
    `${API_URL}product-group?${params.toString()}`
  );
  return response.data;
};

// Delete a Product
const deleteProduct = async (id) => {
  const response = await axios.delete(API_URL + id);
  return response.data;
};

// delete product group
const deleteGroup = async (id) => {
  const response = await axios.delete(`${API_URL}group/` + id);
  return response.data;
};

// Get a Product
const getProduct = async (id) => {
  const response = await axios.get(API_URL + id);
  return response.data;
};

// Update Product
const updateProduct = async (id, formData) => {
  // console.log("Closest to it", formData, id)
  const response = await axios.patch(`${API_URL}${id}`, formData);
  return response.data;
};

const updateProductGroup = async (id, formData) => {
  const response = await axios.patch(
    `${API_URL}update-product-group/${id}`,
    formData
  );
  return response.data;
};

const updateGroupListingOptions = async (id, listingOptions) => {
  const response = await axios.patch(`${API_URL}group-listing-options/${id}`, {
    listingOptions,
  });
  return response.data;
};

// Sell a product
const sellProduct = async (id, formData) => {
  const response = await axios.post(`${API_URL}sellproduct/${id}`, formData);
  return response.data;
};

// Get all Sales
const getSales = async (interval, page = 1, limit = 10, search = "") => {
  const params = new URLSearchParams({
    query: interval,
    page: page.toString(),
    limit: limit.toString(),
  });

  if (search) params.append("search", search);

  const response = await axios.get(`${API_URL}getsales?${params.toString()}`);
  return response.data;
};

// Get all Sales
const getSale = async (id) => {
  const response = await axios.get(`${API_URL}getsale/${id}`);
  return response.data;
};

// Get products that are out of stock
const getOutOfStock = async ({
  page = 1,
  limit = 10,
  search = "",
  category = [],
  warehouse = [],
} = {}) => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (search) params.append("search", search);
  if (category.length > 0) params.append("category", category.join(","));
  if (warehouse.length > 0) params.append("warehouse", warehouse.join(","));

  const response = await axios.get(`${API_URL}outofstock?${params.toString()}`);
  return response.data;
};

const getTopProducts = async (page = 1, limit = 5) => {
  const response = await axios.get(
    `${API_URL}top-products?page=${page}&limit=${limit}`
  );
  return response.data;
};

const getLowProducts = async (page = 1, limit = 5) => {
  const response = await axios.get(
    `${API_URL}low-products?page=${page}&limit=${limit}`
  );
  return response.data;
};

const getSalesByYear = async (id) => {
  const response = await axios.get(`${API_URL}sales-by-year/${id}`);
  return response.data;
};

const saveDraft = async (formData) => {
  const response = await axios.post(`${API_URL}save-draft`, formData);
  return response.data;
};

const getDraft = async () => {
  const response = await axios.get(`${API_URL}get-draft`);
  return response.data;
};

// Get dashboard statistics
const getDashboardStats = async () => {
  const response = await axios.get(`${API_URL}dashboard-stats`);
  return response.data;
};

// Batch delete products
const batchDeleteProducts = async (productIds) => {
  const response = await axios.post(`${API_URL}batch-delete`, { productIds });
  return response.data;
};

// Batch delete product groups
const batchDeleteProductGroups = async (groupIds) => {
  const response = await axios.post(`${API_URL}batch-delete-groups`, { groupIds });
  return response.data;
};

// Batch toggle products (on/off)
const batchToggleProducts = async (productIds, listProduct) => {
  const response = await axios.post(`${API_URL}batch-toggle`, { 
    productIds, 
    listProduct 
  });
  return response.data;
};

const productService = {
  createProduct,
  getProducts,
  getProductsBulk,
  getProductsCursor,
  getFilterOptions,
  getProductGroups,
  createMultipleProducts,
  updateProductGroup,
  updateGroupListingOptions,
  getProduct,
  deleteGroup,
  getTopProducts,
  getSalesByYear,
  getLowProducts,
  deleteProduct,
  updateProduct,
  sellProduct,
  getSales,
  getSale,
  getOutOfStock,
  saveDraft,
  getDraft,
  getDashboardStats,
  batchDeleteProducts,
  batchDeleteProductGroups,
  batchToggleProducts,
};

export default productService;
