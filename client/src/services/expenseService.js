import axios from "axios";

const API_URL = `/api/expenses/`;

// Add expense
const addExpense = async (formData) => {
  const response = await axios.post(API_URL, formData);
  return response.data;
};

// Get all expenses
const getExpenses = async (page = 1, limit = 20, filters = {}) => {
  let url = `${API_URL}?page=${page}&limit=${limit}`;

  if (filters.startDate) {
    url += `&startDate=${filters.startDate}`;
  }
  if (filters.endDate) {
    url += `&endDate=${filters.endDate}`;
  }
  if (filters.category && filters.category !== "All") {
    url += `&category=${filters.category}`;
  }

  const response = await axios.get(url);
  return response.data;
};

// Get single expense
const getExpense = async (id) => {
  const response = await axios.get(`${API_URL}${id}`);
  return response.data;
};

// Update expense
const updateExpense = async (id, formData) => {
  const response = await axios.patch(`${API_URL}${id}`, formData);
  return response.data;
};

// Delete expense
const deleteExpense = async (id) => {
  const response = await axios.delete(`${API_URL}${id}`);
  return response.data;
};

// Get expense statistics
const getExpenseStats = async (filters = {}) => {
  let url = `${API_URL}stats?`;

  if (filters.startDate) {
    url += `startDate=${filters.startDate}&`;
  }
  if (filters.endDate) {
    url += `endDate=${filters.endDate}&`;
  }

  const response = await axios.get(url);
  return response.data;
};

const expenseService = {
  addExpense,
  getExpenses,
  getExpense,
  updateExpense,
  deleteExpense,
  getExpenseStats,
};

export default expenseService;
