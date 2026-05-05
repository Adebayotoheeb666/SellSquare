import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../../utils/axiosConfig";

// Async thunks for buyer auth
export const registerBuyer = createAsyncThunk(
  "buyerAuth/register",
  async ({ firstName, lastName, email, password }, { rejectWithValue }) => {
    try {
      const response = await axios.post("/api/buyer/auth/register", {
        firstName,
        lastName,
        email,
        password,
        confirmPassword: password,
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Registration failed"
      );
    }
  }
);

export const loginBuyer = createAsyncThunk(
  "buyerAuth/login",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await axios.post("/api/buyer/auth/login", {
        email,
        password,
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Login failed");
    }
  }
);

export const logoutBuyer = createAsyncThunk(
  "buyerAuth/logout",
  async (_, { rejectWithValue }) => {
    try {
      await axios.post("/api/buyer/auth/logout");
      return null;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Logout failed");
    }
  }
);

export const restoreBuyerSession = createAsyncThunk(
  "buyerAuth/restore",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get("/api/buyer/auth/me");
      return response.data.data;
    } catch (error) {
      // Not logged in is not an error for this case
      return rejectWithValue("No session");
    }
  }
);

// Safe JSON parse helper
const safeJSONParse = (item, fallback) => {
  try {
    const value = localStorage.getItem(item);
    if (!value || value === "undefined" || value === "null") {
      return fallback;
    }
    return JSON.parse(value);
  } catch (error) {
    console.error(`Error parsing ${item} from localStorage:`, error);
    return fallback;
  }
};

const initialBuyerState = safeJSONParse("buyer", null);

const initialState = {
  buyer: initialBuyerState,
  isLoading: false,
  isAuthenticated: !!initialBuyerState,
  error: null,
};

const buyerAuthSlice = createSlice({
  name: "buyerAuth",
  initialState,
  reducers: {
    clearBuyerError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Register
    builder
      .addCase(registerBuyer.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerBuyer.fulfilled, (state, action) => {
        state.isLoading = false;
        state.buyer = action.payload;
        state.isAuthenticated = true;
        state.error = null;
        localStorage.setItem("buyer", JSON.stringify(action.payload));
      })
      .addCase(registerBuyer.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
      });

    // Login
    builder
      .addCase(loginBuyer.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginBuyer.fulfilled, (state, action) => {
        state.isLoading = false;
        state.buyer = action.payload;
        state.isAuthenticated = true;
        state.error = null;
        localStorage.setItem("buyer", JSON.stringify(action.payload));
      })
      .addCase(loginBuyer.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
      });

    // Logout
    builder
      .addCase(logoutBuyer.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logoutBuyer.fulfilled, (state) => {
        state.isLoading = false;
        state.buyer = null;
        state.isAuthenticated = false;
        state.error = null;
        localStorage.removeItem("buyer");
      })
      .addCase(logoutBuyer.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Restore session
    builder
      .addCase(restoreBuyerSession.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(restoreBuyerSession.fulfilled, (state, action) => {
        state.isLoading = false;
        state.buyer = action.payload;
        state.isAuthenticated = true;
        state.error = null;
        localStorage.setItem("buyer", JSON.stringify(action.payload));
      })
      .addCase(restoreBuyerSession.rejected, (state) => {
        state.isLoading = false;
        state.buyer = null;
        state.isAuthenticated = false;
        localStorage.removeItem("buyer");
      });
  },
});

export const { clearBuyerError } = buyerAuthSlice.actions;

// Selectors
export const selectBuyer = (state) => state.buyerAuth.buyer;
export const selectIsBuyerAuthenticated = (state) =>
  state.buyerAuth.isAuthenticated;
export const selectBuyerLoading = (state) => state.buyerAuth.isLoading;
export const selectBuyerError = (state) => state.buyerAuth.error;

export default buyerAuthSlice.reducer;
