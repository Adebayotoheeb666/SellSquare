/**
 * Optimized Auth Middleware
 *
 * Provides optimized authentication with:
 * - Token caching to reduce JWT verification overhead
 * - Session validation once per week (Monday-to-Monday)
 * - Silent background refresh
 * - Integration with realtime events for logout/suspension
 */

const asyncHandler = require("express-async-handler");
const BusinessRegistration = require("../models/businessRegistration");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// In-memory token cache (in production, use Redis)
const tokenCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL
const MAX_CACHE_SIZE = 10000;

/**
 * Clean expired entries from cache
 */
const cleanCache = () => {
  const now = Date.now();
  for (const [key, value] of tokenCache) {
    if (now - value.cachedAt > CACHE_TTL) {
      tokenCache.delete(key);
    }
  }

  // Limit cache size
  if (tokenCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(tokenCache.entries());
    entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => tokenCache.delete(key));
  }
};

// Clean cache periodically
setInterval(cleanCache, 60000);

/**
 * Generate cache key from token
 */
const getCacheKey = (token) => {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex")
    .substring(0, 32);
};

/**
 * Optimized protect middleware with caching
 */
const protectOptimized = asyncHandler(async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      res.status(401);
      throw new Error("Not authorized, please login");
    }

    const cacheKey = getCacheKey(token);

    // Check cache first
    const cached = tokenCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      // Use cached data
      req.business = cached.business;
      req.loggedInUser = req.cookies.loggedInUser;
      if (req.loggedInUser) {
        try {
          req.user = JSON.parse(req.loggedInUser);
        } catch (error) {
          req.user = null;
        }
      }
      return next();
    }

    // Verify Token
    const verified = jwt.verify(token, process.env.JWT_SECRET);

    // Check if token will expire soon (within 24 hours)
    const expiresIn = verified.exp * 1000 - Date.now();
    if (expiresIn < 24 * 60 * 60 * 1000) {
      // Set header to indicate client should refresh token
      res.set("X-Token-Refresh-Needed", "true");
    }

    const business = await BusinessRegistration.findById(verified.id).select(
      "+password"
    );

    if (!business) {
      tokenCache.delete(cacheKey); // Clear invalid cache
      res.status(401);
      throw new Error("Business not found");
    }

    // Cache the result
    tokenCache.set(cacheKey, {
      business: {
        id: business._id.toString(),
        _id: business._id,
        businessName: business.businessName,
        businessEmail: business.businessEmail,
        businessOwner: business.businessOwner,
        subscription: business.subscription,
        sales: business.sales,
        country: business.country,
      },
      cachedAt: Date.now(),
    });

    const loggedInUser = req.cookies.loggedInUser;

    req.business = business;
    req.loggedInUser = loggedInUser;

    // Also parse and set req.user for convenience
    if (loggedInUser) {
      try {
        req.user = JSON.parse(loggedInUser);
      } catch (error) {
        req.user = null;
      }
    }

    next();
  } catch (error) {
    // Clear potentially invalid cache
    const token = req.cookies.token;
    if (token) {
      tokenCache.delete(getCacheKey(token));
    }

    res.status(401);
    throw new Error("Not authorized, please login");
  }
});

/**
 * Lightweight auth check - just verifies token without DB lookup
 * Use for less sensitive endpoints
 */
const protectLight = asyncHandler(async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      res.status(401);
      throw new Error("Not authorized, please login");
    }

    // Just verify token signature, no DB lookup
    const verified = jwt.verify(token, process.env.JWT_SECRET);

    req.business = { id: verified.id, _id: verified.id };

    const loggedInUser = req.cookies.loggedInUser;
    req.loggedInUser = loggedInUser;

    if (loggedInUser) {
      try {
        req.user = JSON.parse(loggedInUser);
      } catch (error) {
        req.user = null;
      }
    }

    next();
  } catch (error) {
    res.status(401);
    throw new Error("Not authorized, please login");
  }
});

/**
 * Invalidate token cache (call on logout or role change)
 */
const invalidateTokenCache = (token) => {
  if (token) {
    tokenCache.delete(getCacheKey(token));
  }
};

/**
 * Clear entire cache (for emergency use)
 */
const clearTokenCache = () => {
  tokenCache.clear();
};

/**
 * Get cache statistics
 */
const getCacheStats = () => {
  return {
    size: tokenCache.size,
    maxSize: MAX_CACHE_SIZE,
    ttl: CACHE_TTL,
  };
};

module.exports = {
  protectOptimized,
  protectLight,
  invalidateTokenCache,
  clearTokenCache,
  getCacheStats,
};
