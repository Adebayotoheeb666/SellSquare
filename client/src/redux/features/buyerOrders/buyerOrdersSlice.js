import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../../utils/axiosConfig";

// Async thunk to fetch buyer orders
export const fetchBuyerOrders = createAsyncThunk(
  "buyerOrders/fetchBuyerOrders",
  async ({ page = 1, limit = 20, status = null } = {}, { rejectWithValue }) => {
    try {
      const params = { page, limit };
      if (status) params.status = status;

      const response = await axios.get(
        "/api/buyer/marketplace/orders",
        { params }
      );

      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch orders"
      );
    }
  }
);

// Async thunk to fetch single order detail
export const fetchBuyerOrderDetail = createAsyncThunk(
  "buyerOrders/fetchBuyerOrderDetail",
  async (orderId, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `/api/buyer/marketplace/orders/${orderId}`
      );
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch order detail"
      );
    }
  }
);

// Async thunk to checkout
export const checkoutOrders = createAsyncThunk(
  "buyerOrders/checkoutOrders",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await axios.post("/api/buyer/marketplace/orders/checkout", payload);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Checkout failed"
      );
    }
  }
);

// Async thunk to confirm receipt
export const confirmOrderReceipt = createAsyncThunk(
  "buyerOrders/confirmOrderReceipt",
  async (orderId, { rejectWithValue, dispatch }) => {
    try {
      const response = await axios.post(`/api/buyer/marketplace/orders/${orderId}/received`);
      // Refresh orders after confirmation
      dispatch(fetchBuyerOrders());
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to confirm receipt"
      );
    }
  }
);

const initialState = {
  orders: [],
  selectedOrder: null,
  loading: false,
  detailLoading: false,
  checkoutLoading: false,
  error: null,
  checkoutError: null,
  checkoutData: null,
  pagination: {
    total: 0,
    page: 1,
    limit: 20,
    pages: 0,
  },
};

const buyerOrdersSlice = createSlice({
  name: "buyerOrders",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCheckoutError: (state) => {
      state.checkoutError = null;
    },
    clearSelectedOrder: (state) => {
      state.selectedOrder = null;
    },
    clearCheckoutData: (state) => {
      state.checkoutData = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch buyer orders
    builder
      .addCase(fetchBuyerOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBuyerOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.orders = action.payload?.data || [];
        if (action.payload?.pagination) {
          state.pagination = action.payload.pagination;
        }
      })
      .addCase(fetchBuyerOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch order detail
    builder
      .addCase(fetchBuyerOrderDetail.pending, (state) => {
        state.detailLoading = true;
        state.error = null;
      })
      .addCase(fetchBuyerOrderDetail.fulfilled, (state, action) => {
        state.detailLoading = false;
        state.selectedOrder = action.payload;
      })
      .addCase(fetchBuyerOrderDetail.rejected, (state, action) => {
        state.detailLoading = false;
        state.error = action.payload;
      });

    // Checkout
    builder
      .addCase(checkoutOrders.pending, (state) => {
        state.checkoutLoading = true;
        state.checkoutError = null;
      })
      .addCase(checkoutOrders.fulfilled, (state, action) => {
        state.checkoutLoading = false;
        state.checkoutData = action.payload;
        state.checkoutError = null;
      })
      .addCase(checkoutOrders.rejected, (state, action) => {
        state.checkoutLoading = false;
        state.checkoutError = action.payload;
      });
  },
});

// Selectors
export const selectBuyerOrders = (state) => state.buyerOrders.orders;
export const selectBuyerOrdersLoading = (state) => state.buyerOrders.loading;
export const selectBuyerOrdersError = (state) => state.buyerOrders.error;
export const selectSelectedOrder = (state) => state.buyerOrders.selectedOrder;
export const selectOrderDetailLoading = (state) => state.buyerOrders.detailLoading;
export const selectBuyerOrdersPagination = (state) => state.buyerOrders.pagination;
export const selectCheckoutLoading = (state) => state.buyerOrders.checkoutLoading;
export const selectCheckoutError = (state) => state.buyerOrders.checkoutError;
export const selectCheckoutData = (state) => state.buyerOrders.checkoutData;

export const { clearError, clearSelectedOrder, clearCheckoutError, clearCheckoutData } = buyerOrdersSlice.actions;

export default buyerOrdersSlice.reducer;
