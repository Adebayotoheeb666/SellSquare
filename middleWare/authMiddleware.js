const asyncHandler = require("express-async-handler");
const BusinessRegistration = require("../models/businessRegistration");
const jwt = require("jsonwebtoken");

const getAuthToken = (req) => {
  const authHeader =
    (typeof req.get === "function" && req.get("authorization")) ||
    req.headers?.authorization ||
    req.headers?.Authorization ||
    "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return req.cookies?.token;
};

const protect = asyncHandler(async (req, res, next) => {
  try {
    const token = getAuthToken(req);
    if (!token) {
      res.status(401);
      throw new Error("Not authorized, please login");
    }

    // Verify Token
    const verified = jwt.verify(token, process.env.JWT_SECRET);

    const business = await BusinessRegistration.findById(verified.id).select(
      "+password"
    );

    if (!business) {
      res.status(401);
      throw new Error("Business not found");
    }

    const loggedInUser = req.cookies.loggedInUser;

    req.business = business;
    req.loggedInUser = loggedInUser || "";

    // Also parse and set req.user for convenience
    if (loggedInUser) {
      try {
        req.user = JSON.parse(loggedInUser);
        // CRITICAL: Validate that loggedInUser belongs to this business
        // This prevents cart/data mixing when cookies get misaligned
        if (req.user._id !== business._id.toString()) {
          res.status(401);
          throw new Error("User session mismatch with business. Please login again.");
        }
      } catch (error) {
        if (error.message && error.message.includes("mismatch")) {
          throw error;
        }
        // If parsing fails, loggedInUser might be corrupted
        console.warn("[Auth] Failed to parse loggedInUser cookie:", error.message);
        req.user = null;
      }
    } else {
      // No loggedInUser cookie - this is suspicious in a multi-user scenario
      console.warn("[Auth] Missing loggedInUser cookie for authenticated request");
      req.user = {
        _id: business._id.toString(),
        name: verified.name || `${business.businessOwner.firstName} ${business.businessOwner.lastName}`,
        email: verified.email || business.businessOwner.email,
        permissions: verified.permissions || business.businessOwner.permissions,
        businessOwnerLoggedIn: Boolean(verified.businessOwnerLoggedIn),
        salesLoggedIn: Boolean(verified.salesLoggedIn),
      };
      req.loggedInUser = JSON.stringify(req.user);
    }

    next();
  } catch (error) {
    res.status(401);
    throw new Error("Not authorized, please login");
  }
});

module.exports = protect;
