/**
 * Optimized Auth Service
 *
 * Reduces authentication-related server calls by:
 * - Caching login status with weekly expiry (Monday-to-Monday)
 * - Using localStorage for session persistence
 * - Silent background token refresh
 * - Integration with realtime events for auth changes
 */

import axios from "axios";
import {
  clearAccessToken,
  hasAccessToken,
} from "../utils/authSession";

const BACKEND_URL = "";
const AUTH_CACHE_KEY = "authCache";
const TOKEN_REFRESH_KEY = "lastTokenRefresh";

/**
 * Get milliseconds until next Monday midnight
 */
const getMillisecondsUntilNextMonday = () => {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

  let daysUntilMonday;
  if (currentDay === 0) {
    daysUntilMonday = 1;
  } else if (currentDay === 1) {
    daysUntilMonday = 7;
  } else {
    daysUntilMonday = 8 - currentDay;
  }

  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);

  return nextMonday.getTime() - now.getTime();
};

/**
 * Get current week identifier (year + week number)
 */
const getCurrentWeekId = () => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${weekNumber}`;
};

/**
 * Auth cache structure
 */
const createAuthCache = (isLoggedIn, user = null, expiresAt = null) => {
  return {
    isLoggedIn,
    user,
    weekId: getCurrentWeekId(),
    expiresAt: expiresAt || Date.now() + getMillisecondsUntilNextMonday(),
    cachedAt: Date.now(),
  };
};

/**
 * Save auth cache to localStorage
 */
const saveAuthCache = (cache) => {
  try {
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error("[AuthServiceOptimized] Error saving cache:", error);
  }
};

/**
 * Load auth cache from localStorage
 */
const loadAuthCache = () => {
  try {
    const cached = localStorage.getItem(AUTH_CACHE_KEY);
    if (!cached) return null;

    const cache = JSON.parse(cached);

    // Check if cache is still valid
    const now = Date.now();
    if (cache.expiresAt && now > cache.expiresAt) {
      // Cache expired
      clearAuthCache();
      return null;
    }

    // Check if we're in the same week
    if (cache.weekId !== getCurrentWeekId()) {
      // Week changed, invalidate cache
      clearAuthCache();
      return null;
    }

    return cache;
  } catch (error) {
    console.error("[AuthServiceOptimized] Error loading cache:", error);
    clearAuthCache();
    return null;
  }
};

/**
 * Clear auth cache
 */
const clearAuthCache = () => {
  try {
    localStorage.removeItem(AUTH_CACHE_KEY);
    localStorage.removeItem(TOKEN_REFRESH_KEY);
  } catch (error) {
    console.error("[AuthServiceOptimized] Error clearing cache:", error);
  }
};

/**
 * Get login status - cached version
 * Only makes server call once per week or when cache is invalid
 */
export const getLoginStatusOptimized = async (forceRefresh = false) => {
  // Token presence is the source of truth for client-side auth state.
  // Expiration is enforced by API 401 responses handled globally.
  if (!forceRefresh) {
    const cached = loadAuthCache();
    if (cached && cached.isLoggedIn !== undefined) {
      return cached.isLoggedIn;
    }
  }

  const isLoggedIn = hasAccessToken();
  saveAuthCache(createAuthCache(isLoggedIn));
  return isLoggedIn;
};

/**
 * Should refresh auth - check if we need to re-validate
 * Returns true only if:
 * - No cache exists
 * - Cache is from a different week
 * - User explicitly requested refresh
 */
export const shouldRefreshAuth = () => {
  return !hasAccessToken();
};

/**
 * Silent token refresh in background
 * Called when server indicates token refresh is needed
 */
export const silentTokenRefresh = async () => {
  const lastRefresh = localStorage.getItem(TOKEN_REFRESH_KEY);
  const now = Date.now();

  // Don't refresh more than once per hour
  if (lastRefresh && now - parseInt(lastRefresh, 10) < 60 * 60 * 1000) {
    return false;
  }

  // Access-token-only flow does not use silent refresh.
  // Session expiry is handled via 401 redirect/logout.
  localStorage.setItem(TOKEN_REFRESH_KEY, now.toString());
  return false;
};

/**
 * Handle logout - clears cache
 */
export const logoutOptimized = async () => {
  try {
    await axios.get(`${BACKEND_URL}/api/business/logout`);
  } catch (error) {
    console.error("[AuthServiceOptimized] Logout error:", error.message);
  } finally {
    clearAccessToken();
    clearAuthCache();
  }
};

/**
 * Handle auth events from realtime system
 */
export const handleAuthEvent = (eventType, data) => {
  switch (eventType) {
    case "auth.session_expired":
    case "auth.user_logged_out":
    case "auth.account_suspended":
      clearAuthCache();
      break;

    case "auth.permissions_updated":
    case "auth.role_changed":
      // Invalidate cache to force re-fetch on next check
      clearAuthCache();
      break;

    default:
      break;
  }
};

/**
 * Axios interceptor to handle auth refresh headers
 */
export const setupAuthInterceptor = () => {
  axios.interceptors.response.use(
    (response) => {
      // Check if server indicates token refresh is needed
      if (response.headers["x-token-refresh-needed"] === "true") {
        // Trigger silent refresh in background
        silentTokenRefresh().catch(() => {});
      }
      return response;
    },
    (error) => {
      // Handle 401 errors
      if (error.response?.status === 401) {
        clearAccessToken();
        clearAuthCache();
      }
      return Promise.reject(error);
    }
  );
};

/**
 * Initialize auth service
 * Call this at app startup
 */
export const initAuthService = () => {
  setupAuthInterceptor();

  // Check if we need to refresh on startup
  if (shouldRefreshAuth()) {
    console.log(
      "[AuthServiceOptimized] Cache expired, will refresh on first protected route"
    );
  } else {
    console.log("[AuthServiceOptimized] Using cached auth state");
  }
};

export default {
  getLoginStatusOptimized,
  shouldRefreshAuth,
  silentTokenRefresh,
  logoutOptimized,
  handleAuthEvent,
  clearAuthCache,
  initAuthService,
};
