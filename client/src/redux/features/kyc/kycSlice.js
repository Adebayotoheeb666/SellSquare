import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../../utils/axiosConfig";

// Thunks for API calls

export const submitKYC = createAsyncThunk(
  "kyc/submitKYC",
  async (kycData, { rejectWithValue }) => {
    try {
      // Intentionally using business/kyc here as this is the internal admin path
      const response = await axios.post("/api/kyc/submit", kycData);
      return response.data?.kyc || response.data?.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to submit KYC"
      );
    }
  }
);

export const fetchKYCStatus = createAsyncThunk(
  "kyc/fetchStatus",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get("/api/kyc/status");
      return response.data?.kyc || response.data?.data || null;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch KYC status"
      );
    }
  }
);

export const fetchAllKYCs = createAsyncThunk(
  "kyc/fetchAll",
  async ({ status = "submitted", page = 1, limit = 20 } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      const backendStatus = status === "pending" ? "submitted" : status;
      if (backendStatus && backendStatus !== "all") params.append("status", backendStatus);
      params.append("page", page);
      params.append("limit", limit);

      const response = await axios.get(`/api/kyc/admin/list?${params}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to load KYC submissions"
      );
    }
  }
);

export const verifyKYC = createAsyncThunk(
  "kyc/verify",
  async ({ kycId, approved, rejectionReason, verificationNotes }, { rejectWithValue }) => {
    try {
      const endpoint = approved
        ? `/api/kyc/admin/business/${kycId}/approve`
        : `/api/kyc/admin/business/${kycId}/reject`;

      const response = await axios.post(endpoint, approved ? { verificationNotes } : { rejectionReason });
      return response.data?.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to verify KYC"
      );
    }
  }
);

// Marketplace KYC Thunks (for internal marketplace)
export const submitMarketplaceKYC = createAsyncThunk(
  "kyc/submitMarketplaceKYC",
  async (kycData, { rejectWithValue }) => {
    try {
      const response = await axios.post("/api/kyc/submit", kycData);
      return response.data?.data || response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to submit marketplace KYC"
      );
    }
  }
);

export const fetchMarketplaceKYCStatus = createAsyncThunk(
  "kyc/fetchMarketplaceStatus",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get("/api/kyc/status");
      return response.data?.data || null;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch marketplace KYC status"
      );
    }
  }
);

export const generateMarketplaceStoreToken = createAsyncThunk(
  "kyc/generateStoreToken",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.post("/api/kyc/generate-store-token");
      return response.data?.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to generate store token"
      );
    }
  }
);

const initialState = {
  kyc: null,
  loading: false,
  error: null,
  allKYCs: [],
  pagination: {
    total: 0,
    page: 1,
    limit: 20,
    pages: 0,
  },
  submitting: false,
  verifying: false,
};

const kycSlice = createSlice({
  name: "kyc",
  initialState,
  reducers: {
    clearKYCError: (state) => {
      state.error = null;
    },
    clearKYCData: (state) => {
      state.kyc = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Submit KYC
    builder
      .addCase(submitKYC.pending, (state) => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(submitKYC.fulfilled, (state, action) => {
        state.submitting = false;
        state.kyc = action.payload;
        state.error = null;
      })
      .addCase(submitKYC.rejected, (state, action) => {
        state.submitting = false;
        state.error = action.payload;
      });

    // Fetch KYC Status
    builder
      .addCase(fetchKYCStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchKYCStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.kyc = action.payload;
        state.error = null;
      })
      .addCase(fetchKYCStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch All KYCs (for admin)
    builder
      .addCase(fetchAllKYCs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllKYCs.fulfilled, (state, action) => {
        state.loading = false;
        state.allKYCs = action.payload.data || action.payload.kycs || [];
        state.pagination = action.payload.pagination || initialState.pagination;
        state.error = null;
      })
      .addCase(fetchAllKYCs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Verify KYC
    builder
      .addCase(verifyKYC.pending, (state) => {
        state.verifying = true;
        state.error = null;
      })
      .addCase(verifyKYC.fulfilled, (state, action) => {
        state.verifying = false;
        // Update the KYC in the list
        const index = state.allKYCs.findIndex((k) => k._id === action.payload._id);
        if (index !== -1) {
          state.allKYCs[index] = action.payload;
        }
        state.error = null;
      })
      .addCase(verifyKYC.rejected, (state, action) => {
        state.verifying = false;
        state.error = action.payload;
      });

    // Submit Marketplace KYC
    builder
      .addCase(submitMarketplaceKYC.pending, (state) => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(submitMarketplaceKYC.fulfilled, (state, action) => {
        state.submitting = false;
        state.kyc = action.payload;
        state.error = null;
      })
      .addCase(submitMarketplaceKYC.rejected, (state, action) => {
        state.submitting = false;
        state.error = action.payload;
      });

    // Fetch Marketplace KYC Status
    builder
      .addCase(fetchMarketplaceKYCStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMarketplaceKYCStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.kyc = action.payload;
        state.error = null;
      })
      .addCase(fetchMarketplaceKYCStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Generate Marketplace Store Token
    builder
      .addCase(generateMarketplaceStoreToken.pending, (state) => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(generateMarketplaceStoreToken.fulfilled, (state, action) => {
        state.submitting = false;
        state.kyc = { ...state.kyc, ...action.payload };
        state.error = null;
      })
      .addCase(generateMarketplaceStoreToken.rejected, (state, action) => {
        state.submitting = false;
        state.error = action.payload;
      });
  },
});

export const { clearKYCError, clearKYCData } = kycSlice.actions;

// Selectors
export const selectKYC = (state) => state.kyc.kyc;
export const selectKYCLoading = (state) => state.kyc.loading;
export const selectKYCError = (state) => state.kyc.error;
export const selectKYCSubmitting = (state) => state.kyc.submitting;
export const selectKYCVerifying = (state) => state.kyc.verifying;
export const selectAllKYCs = (state) => state.kyc.allKYCs;
export const selectKYCPagination = (state) => state.kyc.pagination;

export default kycSlice.reducer;
