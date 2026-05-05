import { createSlice } from "@reduxjs/toolkit";
import { clearAccessToken, hasAccessToken } from "../../../utils/authSession";

const getCompactBusinessSnapshot = (business) => {
  if (!business || typeof business !== "object") {
    return {
      businessName: "",
      businessEmail: "",
      businessAddress: "",
      photo: "https://i.ibb.co/4pDNDk1/avatar.png",
      ownerFirstName: "",
      ownerLastName: "",
      ownerEmail: "",
    };
  }

  return {
    _id: business._id,
    businessName: business.businessName || "",
    businessEmail: business.businessEmail || "",
    businessAddress: business.businessAddress || "",
    businessPhone: business.businessPhone || "",
    industry: business.industry || "",
    country: business.country || "",
    photo: business.photo || "https://i.ibb.co/4pDNDk1/avatar.png",
    ownerFirstName: business.ownerFirstName || "",
    ownerLastName: business.ownerLastName || "",
    ownerEmail: business.ownerEmail || "",
    subscription: business.subscription || null,
  };
};

const persistBusinessInfo = (business) => {
  const compactSnapshot = getCompactBusinessSnapshot(business);

  try {
    localStorage.setItem("BusinessInfo", JSON.stringify(compactSnapshot));
    localStorage.setItem(
      "businessAddress",
      JSON.stringify(compactSnapshot.businessAddress || "")
    );
  } catch (error) {
    console.warn("Failed to persist full business snapshot, falling back:", error);
    try {
      const minimalFallback = {
        _id: compactSnapshot._id,
        businessName: compactSnapshot.businessName,
        businessEmail: compactSnapshot.businessEmail,
        businessAddress: compactSnapshot.businessAddress,
        photo: compactSnapshot.photo,
      };
      localStorage.removeItem("BusinessInfo");
      localStorage.setItem("BusinessInfo", JSON.stringify(minimalFallback));
      localStorage.setItem(
        "businessAddress",
        JSON.stringify(minimalFallback.businessAddress || "")
      );
    } catch (fallbackError) {
      console.warn("Failed to persist fallback business snapshot:", fallbackError);
      localStorage.removeItem("BusinessInfo");
      localStorage.removeItem("businessAddress");
    }
  }
};

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

const businessName = safeJSONParse("businessName", null);
const user = safeJSONParse("user", null);
const businessInfo = safeJSONParse("BusinessInfo", null);
const businessAddress = safeJSONParse("businessAddress", null);
const admin = safeJSONParse("admin", false);

const initialState = {
  isLoggedIn: hasAccessToken(),
  businessName: businessName || "",
  businessOwnerLoggedIn: admin,
  connectedStores: [],
  currentBusiness: null,
  user: user || {
    name: "",
    email: "",
  },
  business: businessInfo || {
    businessName: "",
    businessEmail: "",
    businessAddress: businessAddress || "",
    photo: "https://i.ibb.co/4pDNDk1/avatar.png",
    ownerFirstName: "",
    ownerLastName: "",
    ownerEmail: "",
    sales: [],
  },
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    SET_LOGIN(state, action) {
      state.isLoggedIn = action.payload;
    },
    SET_NAME(state, action) {
      localStorage.setItem("businessName", JSON.stringify(action.payload));
      state.businessName = action.payload;
    },
    SET_USER(state, action) {
      const profile = action.payload;
      localStorage.setItem(
        "admin",
        JSON.stringify(profile.businessOwnerLoggedIn)
      );
      // Strip connectedStores before persisting — they contain populated
      // business objects with photos that easily exceed localStorage quota.
      const { connectedStores: _cs, ...profileToStore } = profile;
      localStorage.setItem("user", JSON.stringify(profileToStore));

      state.user = profile;
      state.businessOwnerLoggedIn = profile.businessOwnerLoggedIn;
    },
    SET_BUSINESS(state, action) {
      const business = action.payload;
      const currentUser =
        state.user && typeof state.user === "object"
          ? state.user
          : { name: "", email: "" };

      persistBusinessInfo(business);
      state.business = action.payload;

      if (currentUser.salesLoggedIn) {
        const salesList = Array.isArray(business?.sales) ? business.sales : [];
        currentUser.permissions = salesList.find(
          (sale) => sale?.email === currentUser.email
        )?.permissions;
      }

      currentUser.subscription = business?.subscription;
      state.user = currentUser;
    },
    UPDATE_BUSINESS(state, action) {
      const business = action.payload;
      state.user = action.payload;
    },
    UPDATE_PERMISSIONS(state, action) {
      const payload = action.payload || {};

      const directPermissions = payload?.permissions;
      const userPermissions = payload?.user?.permissions;
      const businessSalesPermissions = Array.isArray(payload?.sales)
        ? payload.sales.find((sale) => sale?.email === state.user?.email)
            ?.permissions
        : undefined;

      const nextPermissions =
        directPermissions ?? userPermissions ?? businessSalesPermissions;

      if (nextPermissions !== undefined) {
        state.user = {
          ...state.user,
          permissions: nextPermissions,
        };
      }
    },
    ACCOUNT_SUSPENDED(state, action) {
      const payload = action.payload || {};
      state.user = {
        ...state.user,
        suspended: true,
        suspensionReason: payload?.reason || payload?.message || "",
      };
    },
    SET_CONNECTED_STORES(state, action) {
      const stores = Array.isArray(action.payload) ? action.payload : [];
      state.connectedStores = stores;
    },
    SET_CURRENT_BUSINESS(state, action) {
      state.currentBusiness = action.payload || null;
    },
    LOGOUT(state) {
      // Clear all localStorage items
      localStorage.removeItem("businessName");
      localStorage.removeItem("user");
      localStorage.removeItem("BusinessInfo");
      localStorage.removeItem("businessAddress");
      localStorage.removeItem("admin");
      localStorage.removeItem("cartItems");
      clearAccessToken();

      // Reset state to initial values
      state.isLoggedIn = false;
      state.businessName = "";
      state.businessOwnerLoggedIn = false;
      state.connectedStores = [];
      state.user = {
        name: "",
        email: "",
      };
      state.business = {
        businessName: "",
        businessEmail: "",
        businessAddress: "",
        photo: "https://i.ibb.co/4pDNDk1/avatar.png",
        ownerFirstName: "",
        ownerLastName: "",
        ownerEmail: "",
        sales: [],
      };
    },
  },
});

export const {
  SET_LOGIN,
  SET_NAME,
  SET_USER,
  SET_BUSINESS,
  UPDATE_BUSINESS,
  UPDATE_PERMISSIONS,
  ACCOUNT_SUSPENDED,
  SET_CONNECTED_STORES,
  SET_CURRENT_BUSINESS,
  LOGOUT,
} = authSlice.actions;

export const selectIsLoggedIn = (state) => state.auth.isLoggedIn;
export const selectName = (state) => state.auth.businessName;
export const selectUser = (state) => state.auth.user;
export const selectLoggedInBusinessOwner = (state) =>
  state.auth.businessOwnerLoggedIn;
export const selectBusiness = (state) => state.auth.business;
export const selectBusinessAddress = (state) =>
  state.auth.business?.businessAddress;
export const selectConnectedStores = (state) => state.auth.connectedStores || [];
export const selectCurrentBusiness = (state) => state.auth.currentBusiness;

export default authSlice.reducer;
