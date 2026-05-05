const asyncHandler = require("express-async-handler");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const Product = require("../models/productModel");
const ProductGroup = require("../models/productGroupModel");
const InventoryHold = require("../models/inventoryHoldModel");
const Business = require("../models/businessRegistration");
const BusinessKyc = require("../models/businessKycModel");
const InternalMarketplaceOrder = require("../models/internalMarketplaceOrderModel");
const EscrowEntry = require("../models/escrowEntryModel");
const BuyerWallet = require("../models/buyerWalletModel");
const BusinessWallet = require("../models/businessWalletModel");
const CheckOut = require("../models/checkOutSalesModel");
const { CART_HOLD_DURATION_MINUTES } = require("../services/marketplace/constants");
const { consumeOrderHolds, finalizeAcceptedOrderHolds } = require("../services/marketplace/inventoryHoldService");
const {
  projectSingleListing,
  projectGroupListing,
} = require("../services/marketplace/listingProjectionService");
const { createDiscountResolutionContext } = require("../services/marketplace/discountResolver");


const { eventBus } = require("../events/EventEmitter");

/**
 * Create or Update Cart Hold
 * [requires `protectBuyer`]
 * Creates a 5-minute hold on a product for a buyer
 */
const createOrUpdateCartHold = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  const { buyer, buyerSession } = getBuyerOrSession(req);

  // Validation
  if (!productId || !quantity || quantity <= 0) {
    res.status(400);
    throw new Error("Product ID and positive quantity are required");
  }

  // Find product
  const product = await Product.findById(productId).populate("business");
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  // Verify business is KYC approved
  const businessKyc = await BusinessKyc.findOne({
    business: product.business._id,
    status: "approved",
  });

  if (!businessKyc) {
    res.status(400);
    throw new Error("This product's seller is not yet approved for marketplace");
  }

  // Check availability (including product must be listed for marketplace)
  if (!product.listProduct) {
    res.status(400);
    throw new Error("This product is not available in the marketplace");
  }

  // Check for existing active cart hold for this product + buyer or session
  const holdQuery = {
    product: productId,
    source: "buyer_cart",
    status: "active",
  };
  if (buyer) holdQuery.buyer = buyer;
  else holdQuery.buyerSession = buyerSession;
  const existingHold = await InventoryHold.findOne(holdQuery);

  const availableQty = product.quantity - (product.activeMarketplaceHoldQty || 0);
  const effectiveAvailableQty = availableQty + (existingHold?.quantity || 0);
  if (quantity > effectiveAvailableQty) {
    res.status(400);
    throw new Error(`Insufficient stock. Only ${Math.max(0, effectiveAvailableQty)} available`);
  }

  let holdRecord;

  if (existingHold) {
    // Calculate quantity change
    const quantityChange = quantity - existingHold.quantity;

    if (quantityChange > 0) {
      // Need to hold more - check availability
      if (quantityChange > effectiveAvailableQty - existingHold.quantity) {
        res.status(400);
        throw new Error(`Cannot hold ${quantity} items. Only ${Math.max(0, effectiveAvailableQty)} available`);
      }
      // Update product hold quantity
      await Product.findByIdAndUpdate(productId, {
        $inc: { activeMarketplaceHoldQty: quantityChange },
      });
    } else if (quantityChange < 0) {
      // Release some quantity
      await Product.findByIdAndUpdate(productId, {
        $inc: { activeMarketplaceHoldQty: quantityChange },
      });
    }

    // Update hold expiry time and quantity
    existingHold.quantity = quantity;
    existingHold.expiresAt = new Date(Date.now() + CART_HOLD_DURATION_MINUTES * 60 * 1000);
    holdRecord = await existingHold.save();
  } else {
    // Create new hold
    // Reserve quantity on product
    const updated = await Product.findByIdAndUpdate(
      productId,
      { $inc: { activeMarketplaceHoldQty: quantity } },
      { new: true }
    );

    if (!updated) {
      res.status(400);
      throw new Error("Failed to reserve inventory");
    }

    // Required fields for InventoryHold
    const business = product.business._id;
    // Generate a fake ObjectId for order (since required, but not used for cart holds)
    const order = new (require('mongoose').Types.ObjectId)();
    const lineId = `${(buyerSession || buyer || "guest")}_${productId}`;

    holdRecord = await InventoryHold.create({
      product: productId,
      business,
      order,
      lineId,
      quantity,
      source: "buyer_cart",
      status: "active",
      expiresAt: new Date(Date.now() + CART_HOLD_DURATION_MINUTES * 60 * 1000),
      ...(buyer ? { buyer } : { buyerSession }),
    });
  }

  // Emit inventory event to business
  const refreshedProduct = await Product.findById(productId).select("quantity activeMarketplaceHoldQty");
  const refreshedAvailableQty = Math.max(
    0,
    Number(refreshedProduct?.quantity || 0) - Number(refreshedProduct?.activeMarketplaceHoldQty || 0),
  );

  eventBus.emitBusinessEvent("inventory.hold_updated", product.business._id.toString(), {
    productId: product._id.toString(),
    holdType: "buyer_cart",
    availableQty: refreshedAvailableQty,
  });

  res.status(200).json({
    message: "Cart hold created/updated successfully",
    data: {
      hold: holdRecord,
      availableQty: refreshedAvailableQty,
    },
  });
});

/**
 * Release Cart Hold
 * [requires `protectBuyer`]
 * Removes a product from buyer's cart
 */
const releaseCartHold = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { buyer, buyerSession } = getBuyerOrSession(req);
  const holdQuery = {
    product: productId,
    source: "buyer_cart",
    status: "active",
  };
  if (buyer) holdQuery.buyer = buyer;
  else holdQuery.buyerSession = buyerSession;
  const hold = await InventoryHold.findOne(holdQuery);

  if (!hold) {
    res.status(404);
    throw new Error("Cart hold not found");
  }

  // Release quantity from product
  await Product.findByIdAndUpdate(productId, {
    $inc: { activeMarketplaceHoldQty: -hold.quantity },
  });

  // Mark hold as released
  hold.status = "released";
  hold.releaseReason = "buyer_removed_from_cart";
  hold.releasedAt = new Date();
  await hold.save();

  // Emit inventory event
  const product = await Product.findById(productId).populate("business");
  if (product) {
    const availableQty = Math.max(
      0,
      Number(product.quantity || 0) - Number(product.activeMarketplaceHoldQty || 0),
    );
    eventBus.emitBusinessEvent("inventory.hold_updated", product.business._id.toString(), {
      productId: productId,
      holdType: "buyer_cart",
      action: "released",
      availableQty,
    });
  }

  res.status(200).json({
    message: "Cart hold released successfully",
  });
});

/**
 * Get Cart Holds
 * [requires `protectBuyer`]
 * Returns all active cart holds for the buyer
 */
const getCartHolds = asyncHandler(async (req, res) => {
  const { buyer, buyerSession } = getBuyerOrSession(req);
  const now = new Date();

  const expiredHolds = await InventoryHold.find({
    source: "buyer_cart",
    status: "active",
    expiresAt: { $lte: now },
    ...(buyer ? { buyer } : { buyerSession }),
  }).lean();

  if (expiredHolds.length > 0) {
    for (const hold of expiredHolds) {
      await Product.findByIdAndUpdate(hold.product, {
        $inc: { activeMarketplaceHoldQty: -Number(hold.quantity || 0) },
      });
    }

    await InventoryHold.updateMany(
      { _id: { $in: expiredHolds.map((h) => h._id) } },
      {
        $set: {
          status: "expired",
          releaseReason: "hold_timeout",
          releasedAt: now,
        },
      },
    );
  }

  const holds = await InventoryHold.find({
    source: "buyer_cart",
    status: "active",
    expiresAt: { $gt: now },
    ...(buyer ? { buyer } : { buyerSession }),
  })
    .populate({
      path: "product",
      select: "name price image quantity listProduct business",
      populate: {
        path: "business",
        select: "businessName",
      },
    })
    .sort({ createdAt: -1 });

  const holdsWithMetadata = holds.map((hold) => {
    const timeRemaining = Math.max(0, hold.expiresAt - now);
    const minutesRemaining = Math.floor(timeRemaining / (1000 * 60));
    const secondsRemaining = Math.floor((timeRemaining % (1000 * 60)) / 1000);

    return {
      holdId: hold._id,
      productId: hold.product._id,
      productName: hold.product.name,
      productPrice: hold.product.price,
      productImage: hold.product.image?.filePath || "",
      businessName: hold.product.business?.businessName || "",
      quantity: hold.quantity,
      expiresAt: hold.expiresAt,
      timeRemaining: `${minutesRemaining}:${secondsRemaining.toString().padStart(2, "0")}`,
      minutesRemaining,
      isExpired: timeRemaining <= 0,
    };
  });

  res.status(200).json({
    message: "Cart holds retrieved successfully",
    data: holdsWithMetadata,
  });
});

/**
 * Refresh Cart Hold TTL (Heartbeat)
 * [requires `protectBuyer`]
 * Extends active cart holds while buyer remains on the page.
 */
const refreshCartHolds = asyncHandler(async (req, res) => {
  const { buyer, buyerSession } = getBuyerOrSession(req);
  const now = new Date();
  const nextExpiry = new Date(Date.now() + CART_HOLD_DURATION_MINUTES * 60 * 1000);

  const updateResult = await InventoryHold.updateMany(
    {
      source: "buyer_cart",
      status: "active",
      expiresAt: { $gt: now },
      ...(buyer ? { buyer } : { buyerSession }),
    },
    {
      $set: {
        expiresAt: nextExpiry,
      },
    },
  );

  res.status(200).json({
    message: "Cart hold heartbeat recorded",
    data: {
      updatedCount: updateResult.modifiedCount || 0,
      expiresAt: nextExpiry,
    },
  });
});

/**
 * Get Marketplace Listings
 * [no auth required]
 * Returns a list of products available in the internal marketplace.
 * Correctly handles group products by showing only the group header.
 */
const getListings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, category, search, minPrice, maxPrice, storeToken, ids } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  let businessIds = [];

  if (storeToken) {
    const businessKyc = await BusinessKyc.findOne({
      storeToken: storeToken.trim(),
      status: "approved",
    });
    if (!businessKyc) {
      return res.status(404).json({
        message: "Store not found or not yet approved",
        data: [],
        pagination: { total: 0, page: 1, limit: 20, pages: 0 },
      });
    }
    businessIds = [businessKyc.business];
  } else {
    const approvedBusinesses = await BusinessKyc.find({
      status: "approved",
    })
      .select("business")
      .lean();

    businessIds = approvedBusinesses.map((kyc) => kyc.business);
  }

  // Base filters
  const productFilter = {
    business: { $in: businessIds },
    listProduct: true,
    productIsaGroup: false,
  };

  const groupFilter = {
    business: { $in: businessIds },
    listGroup: true,
  };

  // Category filter
  if (category && category.trim()) {
    productFilter.category = category.trim();
    groupFilter.category = category.trim();
  }

  // Search filter
  if (search && search.trim()) {
    const rx = new RegExp(search, "i");
    productFilter.$or = [{ name: rx }, { description: rx }];
    groupFilter.$or = [{ groupName: rx }, { description: rx }];
  }

  // Price range filter
  if (minPrice || maxPrice) {
    productFilter.price = {};
    if (minPrice) productFilter.price.$gte = parseFloat(minPrice);
    if (maxPrice) productFilter.price.$lte = parseFloat(maxPrice);
  }

  // Aggregation for combined results
  const unionPipeline = [
    { $match: productFilter },
    {
      $project: {
        _id: 1,
        updatedAt: 1,
        listingType: { $literal: "single" },
      },
    },
    {
      $unionWith: {
        coll: ProductGroup.collection.name,
        pipeline: [
          { $match: groupFilter },
          {
            $project: {
              _id: 1,
              updatedAt: 1,
              listingType: { $literal: "group" },
            },
          },
        ],
      },
    },
    { $sort: { updatedAt: -1, _id: 1 } },
  ];

  const aggregateResult = await Product.aggregate([
    ...unionPipeline,
    {
      $facet: {
        meta: [{ $count: "total" }],
        page: [{ $skip: skip }, { $limit: parseInt(limit) }],
      },
    },
  ]);

  const firstResult = aggregateResult?.[0] || {};
  const pageEntries = Array.isArray(firstResult.page) ? firstResult.page : [];
  const total = Number(firstResult.meta?.[0]?.total || 0);

  const singleIds = pageEntries
    .filter((entry) => entry.listingType === "single")
    .map((entry) => entry._id);
  const groupIds = pageEntries
    .filter((entry) => entry.listingType === "group")
    .map((entry) => entry._id);

  const [singleProducts, groups] = await Promise.all([
    singleIds.length > 0
      ? Product.find({ _id: { $in: singleIds } })
          .populate("business", "businessName")
          .lean()
      : [],
    groupIds.length > 0
      ? ProductGroup.find({ _id: { $in: groupIds } })
          .populate("business", "businessName")
          .lean()
      : [],
  ]);

  const groupVariants =
    groupIds.length > 0
      ? await Product.find({
          productIsaGroup: true,
          itemGroup: { $in: groupIds },
          listProduct: true,
        }).lean()
      : [];

  const discountContext = await createDiscountResolutionContext({ businessIds });

  const variantsByGroup = groupVariants.reduce((acc, variant) => {
    const key = variant.itemGroup.toString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(variant);
    return acc;
  }, {});

  const projectedListings = await Promise.all(
    pageEntries.map(async (entry) => {
      const id = entry._id.toString();
      if (entry.listingType === "single") {
        const product = singleProducts.find((p) => p._id.toString() === id);
        if (!product) return null;
        return projectSingleListing({
          businessId: product.business._id,
          product,
          discountContext,
        });
      } else {
        const group = groups.find((g) => g._id.toString() === id);
        if (!group) return null;
        return projectGroupListing({
          businessId: group.business._id,
          group,
          variants: variantsByGroup[id] || [],
          discountContext,
        });
      }
    })
  );

  res.status(200).json({
    message: "Listings retrieved successfully",
    data: projectedListings.filter(Boolean),
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

/**
 * Stream Marketplace Inventory Updates (SSE)
 * [no auth required]
 * Streams live inventory hold updates for marketplace listings.
 */
const streamMarketplaceInventory = async (req, res) => {
  const { storeToken } = req.query;
  let scopedBusinessId = null;

  if (storeToken) {
    const businessKyc = await BusinessKyc.findOne({
      storeToken: String(storeToken).trim(),
      status: "approved",
    }).select("business");

    if (!businessKyc) {
      return res.status(404).json({
        message: "Store not found or not yet approved",
      });
    }

    scopedBusinessId = businessKyc.business?.toString();
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const sendEvent = (eventType, payload) => {
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  sendEvent("connected", {
    message: "Marketplace inventory stream connected",
    timestamp: Date.now(),
  });

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 15000);

  const listener = (businessId, payload) => {
    if (!payload || payload.type !== "inventory.hold_updated") return;
    const normalizedBusinessId = businessId?.toString ? businessId.toString() : String(businessId);
    if (scopedBusinessId && normalizedBusinessId !== scopedBusinessId) return;

    sendEvent("inventory.hold_updated", {
      ...payload.data,
      businessId: normalizedBusinessId,
      timestamp: payload.timestamp,
      eventId: payload.id,
    });
  };

  eventBus.on("business_event", listener);

  req.on("close", () => {
    clearInterval(heartbeat);
    eventBus.off("business_event", listener);
    res.end();
  });
};

/**
 * Get Product Detail
 * [no auth required]
 * Returns full details for a product or group listing.
 */
const getProductDetail = asyncHandler(async (req, res) => {
  const { productId: listingId } = req.params;

  // 1. Try finding as a single product
  const single = await Product.findOne({
    _id: listingId,
    listProduct: true,
    productIsaGroup: false,
  })
    .populate("business", "businessName businessEmail industry address logo")
    .lean();

  if (single) {
    const discountContext = await createDiscountResolutionContext({ businessId: single.business._id });
    const payload = await projectSingleListing({
      businessId: single.business._id,
      product: single,
      discountContext,
    });
    return res.status(200).json({
      message: "Product detail retrieved successfully",
      data: payload,
    });
  }

  // 2. Try finding as a group
  const group = await ProductGroup.findOne({
    _id: listingId,
    listGroup: true,
  })
    .populate("business", "businessName businessEmail industry address logo")
    .lean();

  if (group) {
    const variants = await Product.find({
      productIsaGroup: true,
      itemGroup: group._id,
      listProduct: true,
    }).lean();

    const discountContext = await createDiscountResolutionContext({ businessId: group.business._id });
    const payload = await projectGroupListing({
      businessId: group.business._id,
      group,
      variants,
      discountContext,
    });
    return res.status(200).json({
      message: "Group detail retrieved successfully",
      data: payload,
    });
  }

  res.status(404);
  throw new Error("Listing not found");
});

/**
 * Get Store Info
 * [no auth required]
 * Returns information about a specific store
 */
const getStoreInfo = asyncHandler(async (req, res) => {
  const storeToken = req.params.storeToken || req.query.storeToken;

  if (!storeToken) {
    res.status(400);
    throw new Error("Store token is required");
  }

  const businessKyc = await BusinessKyc.findOne({
    storeToken: storeToken.trim(),
    status: "approved",
  }).populate("business", "businessName businessEmail address industry logo");

  if (!businessKyc) {
    res.status(404);
    throw new Error("Store not found or not yet approved");
  }

  res.status(200).json({
    message: "Store info retrieved successfully",
    data: {
      storeToken: businessKyc.storeToken,
      storeName: businessKyc.business.businessName,
      email: businessKyc.business.businessEmail,
      address: businessKyc.business.address,
      industry: businessKyc.business.industry,
      logo: businessKyc.business.logo,
      approvedAt: businessKyc.approvedAt,
    },
  });
});

/**
 * Checkout
 * [requires `protectBuyer`]
 * Creates orders grouped by business and escrow entries for each business.
 * Verifies payment with external payment provider (e.g., Paystack)
 */
const checkout = asyncHandler(async (req, res) => {
  const buyer = req.buyer;
  const { paymentReference, shippingAddress } = req.body;

  // Validation
  if (!paymentReference) {
    res.status(400);
    throw new Error("Payment reference is required");
  }

  if (!shippingAddress) {
    res.status(400);
    throw new Error("Shipping address is required");
  }

  // Cart holds are created via public routes (no buyer auth), so they are
  // stored by buyerSession rather than buyer._id. We look for holds by either
  // field so checkout works regardless of when the user logged in.
  const sessionId = req.cookies.buyer_session;
  const holdFilter = {
    source: "buyer_cart",
    status: "active",
    $or: [{ buyer: buyer._id }],
  };
  if (sessionId) holdFilter.$or.push({ buyerSession: sessionId });

  const cartHolds = await InventoryHold.find(holdFilter).populate("product");

  if (!cartHolds || cartHolds.length === 0) {
    res.status(400);
    throw new Error("Cart is empty");
  }

  // Associate session-based holds with the authenticated buyer so future
  // lookups (e.g. order history) can find them by buyer ID.
  const sessionHoldIds = cartHolds
    .filter((h) => !h.buyer)
    .map((h) => h._id);
  if (sessionHoldIds.length > 0) {
    await InventoryHold.updateMany(
      { _id: { $in: sessionHoldIds } },
      { $set: { buyer: buyer._id } }
    );
  }

  // Group holds by business
  const holdsByBusiness = {};
  let subtotal = 0;

  for (const hold of cartHolds) {
    const businessId = hold.product.business.toString();
    if (!holdsByBusiness[businessId]) {
      holdsByBusiness[businessId] = [];
    }
    holdsByBusiness[businessId].push(hold);
    subtotal += hold.product.price * hold.quantity;
  }

  // Mirror the 7.5% VAT the frontend adds before passing amount to Flutterwave
  const totalAmount = subtotal * 1.075;

  // Verify payment with Flutterwave
  let verifyResponse;
  try {
    verifyResponse = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${paymentReference}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );
  } catch (error) {
    res.status(400);
    throw new Error(
      `Payment verification failed: ${error.response?.data?.message || error.message}`
    );
  }

  const transactionData = verifyResponse.data.data;

  if (transactionData.status !== "successful") {
    res.status(400);
    throw new Error("Payment verification failed: transaction not successful");
  }

  // Flutterwave returns amounts in NGN (not kobo). Allow ±1 NGN tolerance for
  // floating-point rounding differences between frontend and backend totals.
  if (Math.abs(transactionData.amount - totalAmount) > 1) {
    res.status(400);
    throw new Error("Payment verification failed: amount mismatch");
  }

  // Generate checkout session reference
  const checkoutSessionRef = uuidv4();
  const createdOrders = [];
  const escrowEntries = [];

  // Create orders and escrow entries for each business
  for (const [businessId, holds] of Object.entries(holdsByBusiness)) {
    // Calculate subtotal for this business
    let subtotal = 0;
    const lines = [];

    for (const hold of holds) {
      const lineTotal = hold.product.price * hold.quantity;
      subtotal += lineTotal;

      lines.push({
        product: hold.product._id,
        name: hold.product.name,
        sku: hold.product.sku,
        cost: hold.product.cost,
        image: hold.product.image,
        requestedQty: hold.quantity,
        unitPrice: hold.product.price,
        lineTotal,
        holdId: hold._id,
      });
    }

    // Create InternalMarketplaceOrder
    const order = await InternalMarketplaceOrder.create({
      business: businessId,
      buyer: buyer._id,
      checkoutSessionRef,
      lines,
      subtotal,
      status: "payment_confirmed",
      shippingAddress,
    });

    // Create EscrowEntry
    const escrowEntry = await EscrowEntry.create({
      buyer: buyer._id,
      business: businessId,
      order: order._id,
      checkoutSessionRef,
      amount: subtotal,
      status: "held",
      paymentReference,
      paidAt: new Date(),
    });

    // Attach escrow entry to order
    order.escrowEntryId = escrowEntry._id;
    await order.save();

    createdOrders.push(order);
    escrowEntries.push(escrowEntry);

    // Update Business Wallet Escrow Balance
    await BusinessWallet.findOneAndUpdate(
      { business: businessId },
      { $inc: { escrowBalance: subtotal } },
      { upsert: true, new: true }
    );

    // Create a CheckOut record for the business dashboard/sales history
    await CheckOut.create({
      business: businessId,
      items: lines.map(line => ({
        id: line.product.toString(),
        name: line.name,
        quantity: line.requestedQty,
        price: line.unitPrice,
        cost: line.cost,
        sku: line.sku,
        subTotal: (line.requestedQty * line.unitPrice).toString(),
      })),
      customer: {
        name: req.buyer ? `${req.buyer.firstName} ${req.buyer.lastName}` : "Guest Buyer",
        email: req.buyer ? req.buyer.email : "guest@sellsquare.com",
      },
      payment: {
        paymentType: "escrow",
        paymentStatus: "completed",
        paymentDetails: {
          amountPaid: subtotal,
          balance: 0,
        },
      },
      deliveryStatus: {
        status: "pending",
        date: new Date(),
      },
      orderId: order.orderNumber,
      totalOrderCost: subtotal,
    });

    // Finalize holds (actually reduce stock quantity in Product model)
    await finalizeAcceptedOrderHolds({
      orderId: order._id,
      reason: "marketplace_checkout_completed",
    });

    // Emit event: business receives notification of new order
    const businessPopulated = await Business.findById(businessId).select("businessName");
    const buyerPopulated = await buyer.constructor.findById(buyer._id).select("firstName lastName email");

    eventBus.emitBusinessEvent("marketplace.internal_order.placed", businessId, {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      checkoutSessionRef,
      buyerName: `${buyerPopulated.firstName} ${buyerPopulated.lastName}`,
      buyerEmail: buyerPopulated.email,
      amount: subtotal,
      itemCount: lines.length,
    });
  }

  // Update Buyer Wallet Escrow Balance
  const totalEscrowAmount = createdOrders.reduce((sum, order) => sum + order.subtotal, 0);
  await BuyerWallet.findOneAndUpdate(
    { buyer: buyer._id },
    { $inc: { escrowBalance: totalEscrowAmount } },
    { upsert: true, new: true }
  );

  res.status(201).json({
    message: "Checkout completed successfully",
    data: {
      orders: createdOrders,
      checkoutSessionRef,
      totalAmount,
      escrowEntries: escrowEntries.map((e) => ({
        _id: e._id,
        amount: e.amount,
        status: e.status,
      })),
    },
  });
});

// Migrate guest cart holds to buyer after login/signup
const migrateGuestCartHoldsToBuyer = asyncHandler(async (req, res) => {
  const { buyerSession } = req.body;
  if (!buyerSession || !req.buyer) {
    return res.status(400).json({ message: "buyerSession and authenticated buyer required" });
  }
  // Find all active holds for this session
  const holds = await InventoryHold.find({
    buyerSession,
    source: "buyer_cart",
    status: "active",
  });
  let migrated = 0;
  for (const hold of holds) {
    // Only migrate if buyer doesn't already have a hold for this product
    const existing = await InventoryHold.findOne({
      buyer: req.buyer._id,
      product: hold.product,
      source: "buyer_cart",
      status: "active",
    });
    if (!existing) {
      hold.buyer = req.buyer._id;
      hold.buyerSession = undefined;
      await hold.save();
      migrated++;
    } else {
      // Optionally merge quantities or just remove the guest hold
      await InventoryHold.findByIdAndUpdate(hold._id, { status: "released", releaseReason: "migrated_to_buyer", releasedAt: new Date() });
    }
  }
  res.status(200).json({ message: `Migrated ${migrated} guest cart holds to buyer` });
});

// Helper to get buyer or guest session
function getBuyerOrSession(req) {
  if (req.buyer) return { buyer: req.buyer._id };
  // Use a session ID from cookie or header, or generate one if not present
  let buyerSession = req.cookies.buyer_session || req.headers["x-buyer-session"];
  if (!buyerSession) {
    buyerSession = require("uuid").v4();
    // Optionally set cookie for future requests
    if (req.res) req.res.cookie("buyer_session", buyerSession, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  }
  return { buyerSession };
}

module.exports = {
  createOrUpdateCartHold,
  releaseCartHold,
  getCartHolds,
  refreshCartHolds,
  getListings,
  streamMarketplaceInventory,
  getProductDetail,
  getStoreInfo,
  checkout,
  migrateGuestCartHoldsToBuyer,
};
