import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getAllBusinesses } from "../../../services/authService";
import { fetchApplications } from "../../../services/applicationService";

const initialState = {
  businesses: [],
  applications: [],
  isLoadingBusinesses: false,
  isLoadingApplications: false,
  error: null,
};

export const fetchAdminBusinesses = createAsyncThunk(
  "admin/fetchBusinesses",
  async (_, thunkAPI) => {
    try {
      const result = await getAllBusinesses();
      return result?.businesses || result || [];
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  },
);

export const fetchAdminApplications = createAsyncThunk(
  "admin/fetchApplications",
  async (_, thunkAPI) => {
    try {
      const result = await fetchApplications();
      return Array.isArray(result) ? result : result?.applications || [];
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  },
);

const adminSlice = createSlice({
  name: "admin",
  initialState,
  reducers: {
    updateBusinessInList: (state, action) => {
      const updatedBusiness = action.payload;
      state.businesses = state.businesses.map((business) =>
        business._id === updatedBusiness._id ? updatedBusiness : business,
      );
    },
    setBusinesses: (state, action) => {
      state.businesses = Array.isArray(action.payload) ? action.payload : [];
    },
    setApplications: (state, action) => {
      state.applications = Array.isArray(action.payload) ? action.payload : [];
    },
    addApplicationToCache: (state, action) => {
      const newApplication = action.payload;
      if (newApplication?._id) {
        // Add new application to the beginning of the list
        state.applications.unshift(newApplication);
      }
    },
    updateApplicationInCache: (state, action) => {
      const updatedApplication = action.payload;
      if (updatedApplication?._id) {
        // Find and update the application in the cache
        const index = state.applications.findIndex(
          (app) => app._id === updatedApplication._id
        );
        if (index !== -1) {
          state.applications[index] = {
            ...state.applications[index],
            ...updatedApplication,
          };
        }
      }
    },
    clearAdminState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminBusinesses.pending, (state) => {
        state.isLoadingBusinesses = true;
        state.error = null;
      })
      .addCase(fetchAdminBusinesses.fulfilled, (state, action) => {
        state.isLoadingBusinesses = false;
        state.businesses = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchAdminBusinesses.rejected, (state, action) => {
        state.isLoadingBusinesses = false;
        state.error = action.payload;
      })
      .addCase(fetchAdminApplications.pending, (state) => {
        state.isLoadingApplications = true;
        state.error = null;
      })
      .addCase(fetchAdminApplications.fulfilled, (state, action) => {
        state.isLoadingApplications = false;
        state.applications = Array.isArray(action.payload)
          ? action.payload
          : [];
      })
      .addCase(fetchAdminApplications.rejected, (state, action) => {
        state.isLoadingApplications = false;
        state.error = action.payload;
      });
  },
});

export const {
  updateBusinessInList,
  setBusinesses,
  setApplications,
  addApplicationToCache,
  updateApplicationInCache,
  clearAdminState,
} = adminSlice.actions;

export const selectAdminBusinesses = (state) => state.admin.businesses;
export const selectAdminApplications = (state) => state.admin.applications;
export const selectAdminLoadingBusinesses = (state) =>
  state.admin.isLoadingBusinesses;
export const selectAdminLoadingApplications = (state) =>
  state.admin.isLoadingApplications;
export const selectAdminError = (state) => state.admin.error;

export default adminSlice.reducer;
