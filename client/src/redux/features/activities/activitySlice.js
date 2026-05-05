import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import activitiesService from "./activityService";
import { toast } from "sonner";

/**
 * Safely extract array from any backend payload.
 * CRITICAL: This ensures Redux state ALWAYS contains arrays, never objects.
 */
const ensureArray = (payload, ...fieldNames) => {
  if (Array.isArray(payload)) return payload;
  if (payload == null) return [];
  if (typeof payload !== "object") return [];

  for (const field of fieldNames) {
    if (Array.isArray(payload[field])) return payload[field];
  }

  const commonFields = ["items", "data", "results", "records"];
  for (const field of commonFields) {
    if (Array.isArray(payload[field])) return payload[field];
  }

  return [];
};

const initialState = {
  activities: [],
  isActivityLoading: false,
  isSuccess: false,
  isError: false,
  message: "",
  // Pagination metadata
  activitiesPagination: {
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10,
    hasMore: false,
  },
};

// Get all activities
export const getActivities = createAsyncThunk(
  "activities/getAllActivities",
  async ({ page = 1, limit = 10 } = {}, thunkAPI) => {
    try {
      return await activitiesService.getAllActivities(page, limit);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  }
);

const activitiesSlice = createSlice({
  name: "activities",
  initialState,
  reducers: {
    CALC_STORE_VALUE_BY_PRICE(state, action) {
      const products = action.payload;
      const array = [];
      products.map((item) => {
        const { price, quantity } = item;
        const productValue = price * quantity;
        return array.push(productValue);
      });
      const totalValue = array.reduce((a, b) => {
        return a + b;
      }, 0);
      state.totalStoreValueByPrice = totalValue;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getActivities.pending, (state) => {
        state.isActivityLoading = true;
      })
      .addCase(getActivities.fulfilled, (state, action) => {
        state.isActivityLoading = false;
        state.isSuccess = true;
        state.isError = false;

        // CRITICAL: Always extract array from response
        const activitiesArray = ensureArray(
          action.payload,
          "activities",
          "data"
        );
        state.activities = activitiesArray;

        // Handle pagination metadata if present
        if (
          action.payload &&
          typeof action.payload === "object" &&
          !Array.isArray(action.payload)
        ) {
          const pagination = action.payload.pagination || action.payload;
          state.activitiesPagination = {
            currentPage: pagination.currentPage || 1,
            totalPages:
              pagination.totalPages || Math.ceil(activitiesArray.length / 10),
            totalCount:
              pagination.totalCount ||
              pagination.total ||
              activitiesArray.length,
            limit: pagination.limit || 10,
            hasMore: pagination.hasMore || false,
          };
        } else {
          state.activitiesPagination = {
            currentPage: 1,
            totalPages: Math.ceil(activitiesArray.length / 10),
            totalCount: activitiesArray.length,
            limit: 10,
            hasMore: false,
          };
        }
      })
      .addCase(getActivities.rejected, (state, action) => {
        state.isActivityLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      });
  },
});

export const { CALC_STORE_VALUE_BY_PRICE } = activitiesSlice.actions;

export const selectIsLoading = (state) => state.activities.isLoading;
export const selectActivities = (state) => state.activities.activities;

export default activitiesSlice.reducer;
