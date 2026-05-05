import axios from "../utils/axiosConfig";

const BUSINESS_WALLET_BASE = "/api/marketplace/wallet";

const getBalance = () => axios.get(`${BUSINESS_WALLET_BASE}/balance`);

const getTransactions = (params = {}) =>
  axios.get(`${BUSINESS_WALLET_BASE}/transactions`, { params });

const requestWithdrawal = (data) =>
  axios.post(`${BUSINESS_WALLET_BASE}/withdraw`, data);

const businessWalletService = {
  getBalance,
  getTransactions,
  requestWithdrawal,
};

export default businessWalletService;
