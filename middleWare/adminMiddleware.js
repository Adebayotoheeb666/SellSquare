const asyncHandler = require("express-async-handler");

/**
 * Admin Middleware
 * Checks if the authenticated business user is in the admin emails list
 * Must be used AFTER the protect middleware which sets req.business
 */
const adminMiddleware = asyncHandler(async (req, res, next) => {
  // Verify that protect middleware has set req.business
  if (!req.business) {
    res.status(401);
    throw new Error("Authentication required");
  }

  // The specific Super Admin ID from environment
  const superAdminId = process.env.SUPERADMIN_BUSINESS_ID;

  // Check if this is the super admin by ID
  const isSuperAdminById = superAdminId && req.business._id && req.business._id.toString() === superAdminId;

  if (!isSuperAdminById) {
    // Fallback: Check if current business email is in admin list
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email);

    const businessEmail = req.business.businessEmail || req.business.email;

    if (!adminEmails.includes(businessEmail)) {
      res.status(403);
      throw new Error("Admin access required. Only authorized administrators can access this resource.");
    }
  }

  // Store admin flag on request for later use
  req.isAdmin = true;
  next();
});

module.exports = adminMiddleware;
