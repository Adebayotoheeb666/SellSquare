import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../../utils/axiosConfig";

// Async thunk to fetch buyer wallet balance
export const fetchBuyerWalletBalance = createAsyncThunk(
  "buyerWallet/fetchBuyerWalletBalance",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get("/api/buyer/marketplace/wallet/balance");
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch wallet balance"
      );
    }
  }
);

// Async thunk to fetch wallet transactions
export const fetchBuyerWalletTransactions = createAsyncThunk(
  "buyerWallet/fetchBuyerWalletTransactions",
  async ({ page = 1, limit = 20 } = {}, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        "/api/buyer/marketplace/wallet/transactions",
        { params: { page, limit } }
      );
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch transactions"
      );
    }
  }
);

// Async thunk to withdraw from wallet
export const withdrawFromWallet = createAsyncThunk(
  "buyerWallet/withdrawFromWallet",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        "/api/buyer/marketplace/wallet/withdraw",
        payload
      );
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to process withdrawal"
      );
    }
  }
);

const initialState = {
  balance: 0,
  currency: "NGN",
  transactions: [],
  loading: false,
  transactionsLoading: false,
  withdrawLoading: false,
  error: null,
  withdrawError: null,
  pagination: {
    total: 0,
    page: 1,
    limit: 20,
    pages: 0,
  },
};

const buyerWalletSlice = createSlice({
  name: "buyerWallet",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearWithdrawError: (state) => {
      state.withdrawError = null;
    },
    updateBalance: (state, action) => {
      state.balance = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Fetch wallet balance
    builder
      .addCase(fetchBuyerWalletBalance.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBuyerWalletBalance.fulfilled, (state, action) => {
        state.loading = false;
        state.balance = action.payload?.balance || 0;
        state.currency = action.payload?.currency || "NGN";
      })
      .addCase(fetchBuyerWalletBalance.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch transactions
    builder
      .addCase(fetchBuyerWalletTransactions.pending, (state) => {
        state.transactionsLoading = true;
        state.error = null;
      })
      .addCase(fetchBuyerWalletTransactions.fulfilled, (state, action) => {
        state.transactionsLoading = false;
        state.transactions = action.payload?.transactions || [];
        if (action.payload?.pagination) {
          state.pagination = action.payload.pagination;
        }
      })
      .addCase(fetchBuyerWalletTransactions.rejected, (state, action) => {
        state.transactionsLoading = false;
        state.error = action.payload;
      });

    // Withdraw from wallet
    builder
      .addCase(withdrawFromWallet.pending, (state) => {
        state.withdrawLoading = true;
        state.withdrawError = null;
      })
      .addCase(withdrawFromWallet.fulfilled, (state, action) => {
        state.withdrawLoading = false;
        state.balance = action.payload?.balance || state.balance;
      })
      .addCase(withdrawFromWallet.rejected, (state, action) => {
        state.withdrawLoading = false;
        state.withdrawError = action.payload;
      });
  },
});

// Selectors
export const selectBuyerWalletBalance = (state) => state.buyerWallet.balance;
export const selectBuyerWalletCurrency = (state) => state.buyerWallet.currency;
export const selectBuyerWalletLoading = (state) => state.buyerWallet.loading;
export const selectBuyerWalletError = (state) => state.buyerWallet.error;
export const selectBuyerWalletTransactions = (state) => state.buyerWallet.transactions;
export const selectBuyerWalletTransactionsLoading = (state) =>
  state.buyerWallet.transactionsLoading;
export const selectBuyerWalletWithdrawLoading = (state) =>
  state.buyerWallet.withdrawLoading;
export const selectBuyerWalletWithdrawError = (state) =>
  state.buyerWallet.withdrawError;
export const selectBuyerWalletPagination = (state) => state.buyerWallet.pagination;

export const { clearError, clearWithdrawError, updateBalance } =
  buyerWalletSlice.actions;

export default buyerWalletSlice.reducer;
