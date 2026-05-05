const { ORDER_STATUS_FLOW } = require("../services/marketplace/constants");

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

const validateOrderCreatePayload = (payload = {}) => {
  const errors = [];

  const isObjectValue = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value);

  if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
    errors.push("Order must include at least one line item");
  } else {
    payload.lines.forEach((line, index) => {
      const hasProductId = isNonEmptyString(line.productId);
      const hasListingId = isNonEmptyString(line.listingId);
      const hasVariantId = isNonEmptyString(line.variantId);

      if (hasProductId && (hasListingId || hasVariantId)) {
        errors.push(
          `lines[${index}] must use either legacy productId or listingId+variantId, not both`,
        );
      } else if (!hasProductId && !hasListingId && !hasVariantId) {
        errors.push(
          `lines[${index}] requires either productId or listingId+variantId`,
        );
      } else if (!hasProductId && hasListingId && !hasVariantId) {
        errors.push(`lines[${index}].variantId is required when listingId is provided`);
      } else if (!hasProductId && !hasListingId && hasVariantId) {
        errors.push(`lines[${index}].listingId is required when variantId is provided`);
      }

      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        errors.push(`lines[${index}].quantity must be greater than 0`);
      }

      if (line.lineMeta !== undefined && !isObjectValue(line.lineMeta)) {
        errors.push(`lines[${index}].lineMeta must be an object when provided`);
      }

      ["variantImage", "groupImage", "selectedImage"].forEach((field) => {
        if (line[field] !== undefined && typeof line[field] !== "string") {
          errors.push(`lines[${index}].${field} must be a string when provided`);
        }
      });
    });
  }

  if (payload.customer && typeof payload.customer !== "object") {
    errors.push("customer must be an object");
  }

  if (payload.shippingAddress !== undefined && !isObjectValue(payload.shippingAddress)) {
    errors.push("shippingAddress must be an object when provided");
  }

  if (payload.fulfillment !== undefined) {
    if (!isObjectValue(payload.fulfillment)) {
      errors.push("fulfillment must be an object when provided");
    } else if (payload.fulfillment.method !== undefined) {
      const method = String(payload.fulfillment.method || "").toLowerCase().trim();
      if (!method || !["pickup", "delivery"].includes(method)) {
        errors.push("fulfillment.method must be pickup or delivery when provided");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validateDomainAllowlistInput = (domains = []) => {
  const errors = [];

  if (!Array.isArray(domains)) {
    return {
      valid: false,
      errors: ["allowlisted domains must be an array"],
    };
  }

  domains.forEach((entry, index) => {
    const candidate = typeof entry === "string" ? entry : entry?.domain;
    if (!isNonEmptyString(candidate)) {
      errors.push(`allowlistedDomains[${index}] must be a non-empty domain string`);
      return;
    }

    if (!/^[a-z0-9.-]+$/.test(candidate.trim().toLowerCase())) {
      errors.push(`allowlistedDomains[${index}] has invalid domain format`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validateOrderStatusTransitionPayload = ({ from, to }) => {
  const errors = [];

  if (!isNonEmptyString(from) || !isNonEmptyString(to)) {
    errors.push("from and to status are required");
  } else {
    const allowed = ORDER_STATUS_FLOW[from] || [];
    if (!allowed.includes(to)) {
      errors.push(`Invalid transition from ${from} to ${to}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

module.exports = {
  validateOrderCreatePayload,
  validateDomainAllowlistInput,
  validateOrderStatusTransitionPayload,
};
