const asyncHandler = require("express-async-handler");

/**
 * Middleware to verify that the requesting user is the super admin.
 * The super admin is identified by a business ID stored in SUPERADMIN_BUSINESS_ID env var.
 * This is for platform-level features like automations and integrations.
 */
const requireSuperAdmin = asyncHandler(async (req, res, next) => {
  const superAdminId = process.env.SUPERADMIN_BUSINESS_ID;

  if (!superAdminId) {
    res.status(500);
    throw new Error(
      "Super admin not configured. Set SUPERADMIN_BUSINESS_ID environment variable."
    );
  }

  if (req.business._id.toString() !== superAdminId) {
    res.status(403);
    throw new Error(
      "This feature is only available to platform super admin. Access denied."
    );
  }

  next();
});

module.exports = requireSuperAdmin;
