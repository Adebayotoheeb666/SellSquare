/**
 * Event Emitter Middleware
 *
 * Express middleware that integrates with the event system to emit events
 * when data changes occur through API endpoints.
 *
 * This middleware wraps response methods to detect successful mutations
 * and automatically emit corresponding events.
 */

const { eventBus, EventTypes } = require("./EventEmitter");

const extractPrimaryEntityId = (eventData) => {
  if (!eventData) return "";

  if (typeof eventData === "string" || typeof eventData === "number") {
    return String(eventData);
  }

  if (Array.isArray(eventData)) {
    return String(eventData[0]?._id || eventData[0]?.id || "");
  }

  return String(
    eventData._id
      || eventData.id
      || eventData.productId
      || eventData.cartId
      || eventData.orderId
      || eventData.groupId
      || "",
  );
};

/**
 * Create event emission middleware for specific resource types
 */
const createEventMiddleware = (resourceType) => {
  return (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json to intercept responses
    res.json = (data) => {
      // Only emit events for successful mutations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const method = req.method.toUpperCase();
        let businessId = req.business?.id || req.business?._id;
        // Normalize businessId to string for consistent Map lookups
        if (businessId) {
          businessId = businessId.toString
            ? businessId.toString()
            : String(businessId);
        }

        if (businessId && method !== "GET") {
          try {
            emitEventForResource(resourceType, method, data, businessId, req);
          } catch (error) {
            console.error("[EventMiddleware] Error emitting event:", error);
          }
        }
      }

      return originalJson(data);
    };

    next();
  };
};

/**
 * Emit appropriate event based on resource type and HTTP method
 */
const emitEventForResource = (resourceType, method, data, businessId, req) => {
  let eventType;
  let eventData = data;

  switch (resourceType) {
    case "product":
      eventType = getProductEventType(method, req);
      eventData = formatProductEventData(data, method, req);
      break;

    case "productGroup":
      eventType = getProductGroupEventType(method, req);
      eventData = formatProductGroupEventData(data, method, req);
      break;

    case "cart":
      eventType = getCartEventType(method, req);
      eventData = formatCartEventData(data, method, req);
      break;

    case "sale":
      eventType = getSaleEventType(method, req);
      eventData = formatSaleEventData(data, method, req);
      break;

    case "expense":
      eventType = getExpenseEventType(method);
      eventData = formatExpenseEventData(data, method, req);
      break;

    case "auth":
      eventType = getAuthEventType(req);
      eventData = formatAuthEventData(data, req);
      break;

    case "business":
      eventType = EventTypes.BUSINESS_UPDATED;
      eventData = formatBusinessEventData(data);
      break;

    case "application":
      eventType = getApplicationEventType(method, req);
      eventData = formatApplicationEventData(data, method, req);
      break;
    case "kyc":
      eventType = getKYCEventType(method, req);
      eventData = formatKYCEventData(data, method, req);
      break;



    default:
      return; // Unknown resource type, don't emit
  }

  if (eventType) {
    const primaryEntityId = extractPrimaryEntityId(eventData);

    const metadata = {
      source: "event_middleware",
      userId: req.user?.id || req.user?.email,
      userAgent: req.get("User-Agent"),
      ip: req.ip,
      path: req.path,
      method,
      dedupeKey: primaryEntityId ? `${eventType}:${primaryEntityId}` : "",
    };

    eventBus.emitBusinessEvent(eventType, businessId, eventData, metadata);
  }
};

// Product event type mapping
const getProductEventType = (method, req) => {
  const path = req.path.toLowerCase();

  if (path.includes("sellproduct")) {
    return EventTypes.PRODUCT_SOLD;
  }

  if (path.includes("batch-delete")) {
    return EventTypes.PRODUCT_DELETED;
  }

  if (path.includes("batch-toggle")) {
    return EventTypes.PRODUCT_UPDATED;
  }

  switch (method) {
    case "POST":
      return EventTypes.PRODUCT_CREATED;
    case "PATCH":
    case "PUT":
      return EventTypes.PRODUCT_UPDATED;
    case "DELETE":
      return EventTypes.PRODUCT_DELETED;
    default:
      return null;
  }
};

// Format product data for events
const formatProductEventData = (data, method, req) => {
  const path = req.path.toLowerCase();

  // Handle batch operations
  if (path.includes("batch-delete")) {
    return {
      deletedCount: data.deletedCount || 0,
      message: data.message,
      operation: 'batch-delete',
      productIds: data.productIds || [], // Include product IDs for cache removal
    };
  }

  if (path.includes("batch-toggle")) {
    return {
      updatedCount: data.updatedCount || 0,
      message: data.message,
      operation: 'batch-toggle',
      productIds: data.productIds || [], // Include product IDs for cache update
      listProduct: data.listProduct,
    };
  }

  // Handle array of products (multiple create)
  if (Array.isArray(data)) {
    return {
      products: data.map((p) => ({
        _id: p._id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        quantity: p.quantity,
        price: p.price,
        cost: p.cost,
        warehouse: p.warehouse,
        description: p.description,
        image: p.image,
        images: p.images,
        productIsaGroup: p.productIsaGroup,
        isProductUnique: p.isProductUnique,
        itemGroup: p.itemGroup,
        variantKey: p.variantKey,
        variantLabel: p.variantLabel,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      count: data.length,
    };
  }

  // For sell operations, include sale info
  if (req.path.includes("sellproduct")) {
    return {
      productId: data._id,
      name: data.name,
      soldQuantity: req.body.quantity,
      remainingQuantity: data.quantity,
      salePrice: data.price,
      customer: req.body.customer,
    };
  }

  // Single product
  return {
    _id: data._id,
    name: data.name,
    sku: data.sku,
    category: data.category,
    quantity: data.quantity,
    price: data.price,
    cost: data.cost,
    warehouse: data.warehouse,
    description: data.description,
    image: data.image,
    images: data.images,
    productIsaGroup: data.productIsaGroup,
    isProductUnique: data.isProductUnique,
    itemGroup: data.itemGroup,
    variantKey: data.variantKey,
    variantLabel: data.variantLabel,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};

// Product Group event type mapping
const getProductGroupEventType = (method, req) => {
  const path = req?.path?.toLowerCase() || "";

  if (path.includes("batch-delete-groups")) {
    return EventTypes.PRODUCT_GROUP_BULK_DELETED;
  }

  switch (method) {
    case "POST":
      return EventTypes.PRODUCT_GROUP_CREATED;
    case "PATCH":
    case "PUT":
      return EventTypes.PRODUCT_GROUP_UPDATED;
    case "DELETE":
      return EventTypes.PRODUCT_GROUP_DELETED;
    default:
      return null;
  }
};

// Format product group data for events
const formatProductGroupEventData = (data, method, req) => {
  const path = req?.path?.toLowerCase() || "";

  // Handle batch delete groups
  if (path.includes("batch-delete-groups")) {
    return {
      deletedGroupIds: data.deletedGroupIds || [],
      deletedVariantIds: data.deletedVariantIds || [],
      groupCount: data.groupCount || 0,
      variantCount: data.variantCount || 0,
      message: data.message,
      operation: "batch-delete-groups",
    };
  }

  const payload =
    data?.data && typeof data.data === "object" ? data.data : data;

  return {
    _id: payload?._id,
    business: payload?.business,
    groupName: payload?.groupName,
    category: payload?.category,
    description: payload?.description,
    isProductUnique: payload?.isProductUnique,
    cost: payload?.cost,
    price: payload?.price,
    sku: payload?.sku,
    warehouse: payload?.warehouse,
    quantity: payload?.quantity,
    attributes: payload?.attributes,
    options: payload?.options,
    listingOptions: payload?.listingOptions,
    combinations: payload?.combinations,
    variantMap: payload?.variantMap,
    combinationImages: payload?.combinationImages,
    image: payload?.image,
    images: payload?.images,
    listGroup: payload?.listGroup,
    variantCount: payload?.combinations?.length || 0,
    totalQuantity: Array.isArray(payload?.quantity)
      ? payload.quantity.reduce((sum, q) => sum + (parseInt(q) || 0), 0)
      : 0,
    createdAt: payload?.createdAt,
    updatedAt: payload?.updatedAt,
  };
};

// Cart event type mapping
const getCartEventType = (method, req) => {
  const path = req.path.toLowerCase();

  if (path.includes("clear")) {
    return EventTypes.CART_CLEARED;
  }

  switch (method) {
    case "POST":
      return EventTypes.CART_ITEM_ADDED;
    case "DELETE":
      return EventTypes.CART_ITEM_REMOVED;
    case "PATCH":
    case "PUT":
      return EventTypes.CART_UPDATED;
    default:
      return EventTypes.CART_UPDATED;
  }
};

// Format cart data for events
const formatCartEventData = (data, method, req) => {
  if (!data || typeof data !== "object") {
    return {
      userId: req.user?.email,
      items: [],
    };
  }

  return {
    ...data,
    userId: data?.user?.email || req.user?.email,
  };
};

// Sale event type mapping
const getSaleEventType = (method, req) => {
  const path = req?.path?.toLowerCase() || "";

  // Checkout and returned-goods controllers emit canonical realtime events directly.
  // Skip middleware emission to avoid duplicate/conflicting payloads.
  if (path.includes("checkout") || path.includes("returned-goods")) {
    return null;
  }

  switch (method) {
    case "POST":
      return EventTypes.SALE_COMPLETED;
    case "PATCH":
    case "PUT":
      return EventTypes.CHECKOUT_COMPLETED;
    case "DELETE":
      return EventTypes.SALE_REFUNDED;
    default:
      return null;
  }
};

// Format sale data for events
const formatSaleEventData = (data, method, req) => {
  const checkout = data?.checkOut || data?.checkout || data?.sale || data;

  return {
    _id: checkout?._id,
    saleId: checkout?._id,
    checkout: checkout,
    sale: checkout,
    items: checkout?.items?.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    })),
    total: checkout?.total || checkout?.totalOrderCost,
    customer: checkout?.customer,
    createdAt: checkout?.createdAt,
  };
};

// Expense event type mapping
const getExpenseEventType = (method) => {
  switch (method) {
    case "POST":
      return EventTypes.EXPENSE_CREATED;
    case "PATCH":
    case "PUT":
      return EventTypes.EXPENSE_UPDATED;
    case "DELETE":
      return EventTypes.EXPENSE_DELETED;
    default:
      return null;
  }
};

// Format expense data for events
const formatExpenseEventData = (data, method, req) => {
  const expenseId = data?._id || req?.params?.id || req?.body?.id;
  return {
    _id: expenseId,
    description:
      data?.description || data?.title || req?.body?.description || "",
    amount: data?.amount ?? req?.body?.amount,
    category: data?.category || req?.body?.category || "General",
    date: data?.date || req?.body?.date,
    createdAt: data?.createdAt,
    updatedAt: data?.updatedAt,
  };
};

// Auth event type mapping
const getAuthEventType = (req) => {
  const path = req.path.toLowerCase();

  if (path.includes("logout")) {
    return EventTypes.USER_LOGGED_OUT;
  }
  if (path.includes("update-sales-rep") || path.includes("add-sales")) {
    return EventTypes.PERMISSIONS_UPDATED;
  }
  if (path.includes("delete-sales")) {
    return EventTypes.PERMISSIONS_UPDATED;
  }

  return null;
};

// Format auth data for events
const formatAuthEventData = (data, req) => {
  const path = req.path.toLowerCase();

  if (path.includes("logout")) {
    return {
      userId: req.user?.email,
      reason: "user_initiated",
    };
  }

  return {
    userId: req.user?.email,
    action: path,
    timestamp: Date.now(),
  };
};

// Format business data for events
const sanitizeBusinessPayload = (data = {}) => {
  const rawOwner = data?.businessOwner?.toObject
    ? data.businessOwner.toObject()
    : data.businessOwner || {};
  const { password: ownerPassword, ...sanitizedOwner } = rawOwner;

  const sanitizedSales = (data?.sales || data?.salesRep || []).map((rep) => {
    const rawRep = rep?.toObject ? rep.toObject() : rep || {};
    const { password, ...rest } = rawRep;
    return rest;
  });

  return {
    _id: data._id,
    businessName: data.businessName,
    businessEmail: data.businessEmail,
    businessAddress: data.businessAddress,
    businessPhone: data.businessPhone,
    industry: data.industry,
    country: data.country,
    photo: data.photo,
    ownerFirstName: sanitizedOwner.firstName || data.ownerFirstName,
    ownerLastName: sanitizedOwner.lastName || data.ownerLastName,
    ownerEmail: sanitizedOwner.email || data.ownerEmail,
    businessOwner: sanitizedOwner,
    sales: sanitizedSales,
    subscription: data.subscription,
    verified: data.verified,
    updatedAt: data.updatedAt,
  };
};

const formatBusinessEventData = (data) => {
  return sanitizeBusinessPayload(data);
};

// Application event type mapping
const getApplicationEventType = (method, req) => {
  const path = req.path.toLowerCase();

  if (path.includes("status")) {
    return EventTypes.APPLICATION_STATUS_CHANGED;
  }

  if (path.includes("brief") && path.includes("submit")) {
    return EventTypes.APPLICATION_BRIEF_SUBMITTED;
  }

  if (path.includes("brief")) {
    return EventTypes.APPLICATION_BRIEF_SENT;
  }

  if (path.includes("email")) {
    return EventTypes.APPLICATION_EMAIL_SENT;
  }

  switch (method) {
    case "POST":
      return EventTypes.APPLICATION_SUBMITTED;
    default:
      return null;
  }
};

// Format application data for events
const formatApplicationEventData = (data, method, req) => {
  const path = req.path.toLowerCase();

  // Base application data
  const baseData = {
    _id: data._id || req.params?.id,
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    position: data.position,
    portfolioUrl: data.portfolioUrl,
    status: data.status,
    appliedAt: data.appliedAt || data.createdAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };

  // Handle brief-specific events
  if (path.includes("brief")) {
    return {
      ...baseData,
      briefId: data._id || data.briefId,
      briefStatus: data.status,
      dueDate: data.dueDate,
      submittedAt: data.submittedAt,
      hasResponses: !!data.responses,
    };
  }

  // Handle email event
  if (path.includes("email")) {
    return {
      ...baseData,
      subject: req.body?.subject,
      attachmentCount: (req.files?.attachments || []).length,
    };
  }

  // Default application data
  return baseData;
};

// KYC event middleware
const kycEventMiddleware = (req, res, next) => {
  // Placeholder for KYC event logic
  next();
};

/**
 * Middleware factory for different resource types
 */
const productEventMiddleware = createEventMiddleware("product");
const productGroupEventMiddleware = createEventMiddleware("productGroup");
const cartEventMiddleware = createEventMiddleware("cart");
const saleEventMiddleware = createEventMiddleware("sale");
const expenseEventMiddleware = createEventMiddleware("expense");
const authEventMiddleware = createEventMiddleware("auth");
const businessEventMiddleware = createEventMiddleware("business");
const applicationEventMiddleware = createEventMiddleware("application");

module.exports = {
  createEventMiddleware,
  productEventMiddleware,
  productGroupEventMiddleware,
  cartEventMiddleware,
  saleEventMiddleware,
  expenseEventMiddleware,
  authEventMiddleware,
  businessEventMiddleware,
  applicationEventMiddleware,
  kycEventMiddleware, // Export the new middleware
};
