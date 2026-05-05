const express = require("express");
const protect = require("../middleWare/authMiddleware");
const {
  createApiCredential,
  listApiCredentials,
  updateApiCredentialSettings,
  rotateApiCredentialSecret,
  revokeApiCredential,
  issuePartnerToken,
  refreshPartnerToken,
  revokePartnerToken,
} = require("../controllers/publicMarketplaceAuthController");
const {
  listPublicListings,
  getPublicListingDetails,
} = require("../controllers/publicMarketplaceListingController");
const {
  createMarketplaceOrder,
  confirmMarketplacePayment,
  applyMarketplaceLineDecisions,
  updateMarketplaceOrderStatus,
  getMarketplaceOrder,
  listMarketplaceOrders,
  runMarketplaceHoldExpirySweep,
} = require("../controllers/publicMarketplaceOrderController");
const {
  listWebhookEndpoints,
  createWebhookEndpoint,
  updateWebhookEndpoint,
  upsertProviderWebhookEndpoint,
  rotateWebhookEndpointSecret,
  listWebhookDeliveries,
  retryWebhookDelivery,
} = require("../controllers/marketplaceWebhookAdminController");
const publicIdempotencyMiddleware = require("../middleWare/publicIdempotencyMiddleware");
const {
  requirePartnerAuth,
  resolvePartnerCredentialFromApiKey,
} = require("../middleWare/publicPartnerAuthMiddleware");
const publicDomainAllowlistMiddleware = require("../middleWare/publicDomainAllowlistMiddleware");
const publicRequestSigningMiddleware = require("../middleWare/publicRequestSigningMiddleware");
const publicRateLimitMiddleware = require("../middleWare/publicRateLimitMiddleware");
const publicAuditMiddleware = require("../middleWare/publicAuditMiddleware");
const requireBusinessOwner = require("../middleWare/requireBusinessOwner");

const router = express.Router();

router.post("/auth/keys", protect, requireBusinessOwner, createApiCredential);
router.get("/auth/keys", protect, requireBusinessOwner, listApiCredentials);
router.patch(
  "/auth/keys/:keyId",
  protect,
  requireBusinessOwner,
  updateApiCredentialSettings,
);
router.post(
  "/auth/keys/:keyId/rotate",
  protect,
  requireBusinessOwner,
  rotateApiCredentialSecret,
);
router.post(
  "/auth/keys/:keyId/revoke",
  protect,
  requireBusinessOwner,
  revokeApiCredential,
);

router.post(
  "/auth/token",
  resolvePartnerCredentialFromApiKey,
  publicDomainAllowlistMiddleware,
  publicRequestSigningMiddleware({ required: true }),
  publicRateLimitMiddleware,
  publicAuditMiddleware("token_issue"),
  issuePartnerToken,
);

router.post(
  "/auth/token/refresh",
  publicRateLimitMiddleware,
  publicAuditMiddleware("token_refresh"),
  refreshPartnerToken,
);

router.post(
  "/auth/token/revoke",
  publicRateLimitMiddleware,
  publicAuditMiddleware("token_revoke"),
  revokePartnerToken,
);

router.get(
  "/auth/me",
  requirePartnerAuth(["listings:read"]),
  publicDomainAllowlistMiddleware,
  publicRateLimitMiddleware,
  (req, res) => {
    res.status(200).json({
      businessId: req.partnerAuth.businessId,
      keyId: req.partnerAuth.keyId,
      scopes: req.partnerAuth.scopes,
      credentialStatus: req.partnerCredential.status,
    });
  },
);

router.get(
  "/listings",
  requirePartnerAuth(["listings:read"]),
  publicDomainAllowlistMiddleware,
  publicRateLimitMiddleware,
  publicAuditMiddleware("listings_list"),
  listPublicListings,
);

router.get(
  "/listings/:listingId",
  requirePartnerAuth(["listings:read"]),
  publicDomainAllowlistMiddleware,
  publicRateLimitMiddleware,
  publicAuditMiddleware("listing_detail"),
  getPublicListingDetails,
);

router.post(
  "/orders",
  requirePartnerAuth(["orders:write"]),
  publicDomainAllowlistMiddleware,
  publicRateLimitMiddleware,
  publicAuditMiddleware("order_create"),
  publicIdempotencyMiddleware(),
  createMarketplaceOrder,
);

router.post(
  "/orders/:orderId/payment-confirm",
  requirePartnerAuth(["orders:write"]),
  publicDomainAllowlistMiddleware,
  publicRateLimitMiddleware,
  publicAuditMiddleware("order_payment_confirm"),
  confirmMarketplacePayment,
);

router.post(
  "/orders/:orderId/lines/decision",
  requirePartnerAuth(["orders:write"]),
  publicDomainAllowlistMiddleware,
  publicRateLimitMiddleware,
  publicAuditMiddleware("order_line_decision"),
  applyMarketplaceLineDecisions,
);

router.post(
  "/orders/:orderId/status",
  requirePartnerAuth(["orders:write"]),
  publicDomainAllowlistMiddleware,
  publicRateLimitMiddleware,
  publicAuditMiddleware("order_status_update"),
  updateMarketplaceOrderStatus,
);

router.get(
  "/orders/:orderId",
  requirePartnerAuth(["orders:read"]),
  publicDomainAllowlistMiddleware,
  publicRateLimitMiddleware,
  publicAuditMiddleware("order_detail"),
  getMarketplaceOrder,
);

router.get(
  "/orders",
  requirePartnerAuth(["orders:read"]),
  publicDomainAllowlistMiddleware,
  publicRateLimitMiddleware,
  publicAuditMiddleware("order_list"),
  listMarketplaceOrders,
);

router.get("/internal/orders", protect, listMarketplaceOrders);
router.get("/internal/orders/:orderId", protect, getMarketplaceOrder);
router.post(
  "/internal/orders/:orderId/lines/decision",
  protect,
  applyMarketplaceLineDecisions,
);
router.post(
  "/internal/orders/:orderId/payment-confirm",
  protect,
  confirmMarketplacePayment,
);
router.post("/internal/orders/:orderId/status", protect, updateMarketplaceOrderStatus);

router.post(
  "/orders/ops/hold-expiry-sweep",
  protect,
  runMarketplaceHoldExpirySweep,
);

router.get("/webhooks/endpoints", protect, listWebhookEndpoints);
router.post("/webhooks/endpoints", protect, createWebhookEndpoint);
router.patch("/webhooks/endpoints/:endpointId", protect, updateWebhookEndpoint);
router.put(
  "/webhooks/provider-endpoint",
  requirePartnerAuth(["orders:write"]),
  publicDomainAllowlistMiddleware,
  publicRateLimitMiddleware,
  publicAuditMiddleware("webhook_endpoint_upsert"),
  upsertProviderWebhookEndpoint,
);
router.post(
  "/webhooks/provider-endpoint/:providerEndpointId/rotate-secret",
  requirePartnerAuth(["orders:write"]),
  publicDomainAllowlistMiddleware,
  publicRateLimitMiddleware,
  publicAuditMiddleware("webhook_secret_rotate"),
  rotateWebhookEndpointSecret,
);
router.get("/webhooks/deliveries", protect, listWebhookDeliveries);
router.post("/webhooks/deliveries/:deliveryId/retry", protect, retryWebhookDelivery);

module.exports = router;
