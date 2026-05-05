import axios from "axios";
import { saveAs } from "file-saver";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const API_URL = `/api/cart/`;

// Get all products
const getCart = async (email) => {
  const response = await axios.get(`${API_URL}getcart/${email}`);
  return response.data;
};

// Add product to cart
const addToCart = async (id, formData) => {
  const response = await axios.post(`${API_URL}add-to-cart/${id}`, formData);
  return response.data;
};

const setPrice = async (id, cartId, price, email) => {
  const response = await axios.post(`${API_URL}set-price`, {
    id,
    cartId,
    price,
    email,
  });
  return response.data;
};

const setCartQuantity = async (id, cartId, quantity) => {
  const response = await axios.post(`${API_URL}set-quantity`, {
    id,
    cartId,
    quantity,
  });
  return response.data;
};

// increase cart items
const increaseCartItems = async (formData) => {
  const response = await axios.post(`${API_URL}increase`, formData);
  return response.data;
};

// decrease cart items
const decreaseCartItems = async (formData) => {
  const response = await axios.post(`${API_URL}decrease`, formData);
  return response.data;
};

// Delete a Cart Item
const deleteCartItem = async (id, email) => {
  const response = await axios.delete(
    `${API_URL}delete-cart-item/${id}?email=${email}`
  );
  return response.data;
};

// check out cart
const checkoutCart = async (formData) => {
  const response = await axios.post(`${API_URL}checkout`, formData);
  return response.data;
};

// get checkouts
const getCheckouts = async (
  start,
  end,
  page = 1,
  limit = 10,
  search = "",
  filters = {}
) => {
  let url = `${API_URL}getcheckouts?start=${start}&end=${end}&page=${page}&limit=${limit}&search=${search}`;

  // Add filter parameters
  if (filters.category && filters.category.length > 0) {
    url += `&category=${encodeURIComponent(JSON.stringify(filters.category))}`;
  }
  if (filters.warehouse && filters.warehouse.length > 0) {
    url += `&warehouse=${encodeURIComponent(
      JSON.stringify(filters.warehouse)
    )}`;
  }
  if (filters.priceRange && filters.priceRange.length > 0) {
    url += `&priceRange=${encodeURIComponent(
      JSON.stringify(filters.priceRange)
    )}`;
  }

  const response = await axios.get(url);
  return response.data;
};

const getAllCheckouts = async (page = 1, limit = 10, search = "") => {
  const response = await axios.get(
    `${API_URL}getallcheckouts?page=${page}&limit=${limit}&search=${search}`
  );
  return response.data;
};

// Get unique checkout years
const getCheckoutYears = async () => {
  const response = await axios.get(`${API_URL}checkout-years`);
  return response.data;
};

// generate receipt
const generateReceipt = async (id) => {
  const response = await axios.get(`${API_URL}download-receipt/${id}`, {
    responseType: "blob",
  });
  return response.data;
};

// send receipt to whatsapp
const sendReceipt = async (id) => {
  const response = await axios.post(`${API_URL}send-receipt/${id}`);
  return response.data;
};

// send receipt to printer
const printReceipt = async (id) => {
  const response = await axios.get(`${API_URL}print-receipt/${id}`);
  return response.data;
};

const returnedGoods = async (id, formData) => {
  const response = await axios.post(`${API_URL}returned-goods/${id}`, formData);
  return response.data;
};

const getCustomers = async () => {
  const response = await axios.get(`${API_URL}get-customers`);
  return response.data;
};

const getIncompletePayments = async (params) => {
  const queryParams = new URLSearchParams();

  if (params?.page) queryParams.append("page", params.page);
  if (params?.limit) queryParams.append("limit", params.limit);
  if (params?.search) queryParams.append("search", params.search);
  if (params?.status) queryParams.append("status", params.status);
  if (params?.category?.length > 0)
    queryParams.append("category", params.category.join(","));
  if (params?.warehouse?.length > 0)
    queryParams.append("warehouse", params.warehouse.join(","));
  if (params?.priceRange?.length > 0)
    queryParams.append("priceRange", params.priceRange.join(","));

  const response = await axios.get(
    `${API_URL}get-incomplete-payments?${queryParams.toString()}`
  );
  return response.data;
};

const updatePayment = async (formData) => {
  const response = await axios.post(
    `${API_URL}update-incomplete-payment`,
    formData
  );
  return response.data;
};

const updateDeliveryStatus = async (formData) => {
  const response = await axios.post(
    `${API_URL}update-delivery-status`,
    formData
  );
  return response.data;
};

const cartService = {
  getCart,
  setPrice,
  setCartQuantity,
  increaseCartItems,
  decreaseCartItems,
  checkoutCart,
  getCheckouts,
  getAllCheckouts,
  getCheckoutYears,
  generateReceipt,
  deleteCartItem,
  addToCart,
  printReceipt,
  sendReceipt,
  returnedGoods,
  getCustomers,
  getIncompletePayments,
  updatePayment,
  updateDeliveryStatus,
};

export default cartService;
