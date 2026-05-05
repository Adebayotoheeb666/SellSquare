const asyncHandler = require("express-async-handler");
const Discount = require("../models/discountModel");
const Product = require("../models/productModel");
const ProductGroup = require("../models/productGroupModel");
const { eventBus, EventTypes } = require("../events");
const logActivity = require("../middleWare/logActivityMiddleware");

const getBusinessId = (business) =>
  business?._id?.toString?.() || business?.id?.toString?.() || null;

const isOwnedByBusiness = (doc, businessId) =>
  Boolean(doc?.business && doc.business.toString() === businessId);

const normalizeIdArray = (values = []) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => value?._id?.toString?.() || value?.toString?.())
        .filter(Boolean),
    ),
  );

const resolveTargetProductIdsFromPayload = async ({
  businessId,
  applyTo,
  appliedProducts,
  appliedProductGroups,
  groupSelection,
  appliedGroupItems,
}) => {
  const targetIds = new Set();
  const directProductIds = normalizeIdArray(appliedProducts);
  const groupIds = normalizeIdArray(appliedProductGroups);
  const groupItemIds = normalizeIdArray(appliedGroupItems);

  if (applyTo === "single_product" || applyTo === "both") {
    directProductIds.forEach((productId) => targetIds.add(productId));
  }

  if (applyTo === "group_product" || applyTo === "both") {
    groupItemIds.forEach((productId) => targetIds.add(productId));

    if (groupSelection !== "selected_items" && groupIds.length > 0) {
      const groupedProducts = await Product.find({
        business: businessId,
        productIsaGroup: true,
        itemGroup: { $in: groupIds },
      })
        .select("_id")
        .lean();

      groupedProducts.forEach((product) => {
        targetIds.add(product._id.toString());
      });
    }
  }

  return Array.from(targetIds);
};

const findDiscountProductConflicts = async ({
  businessId,
  targetProductIds,
  excludeDiscountId,
}) => {
  const normalizedTargetProductIds = normalizeIdArray(targetProductIds);

  if (normalizedTargetProductIds.length === 0) {
    return {
      conflictProductIds: [],
      conflicts: [],
    };
  }

  const targetProducts = await Product.find({
    business: businessId,
    _id: { $in: normalizedTargetProductIds },
  })
    .select("_id itemGroup")
    .lean();

  const targetProductSet = new Set(
    targetProducts.map((product) => product._id.toString()),
  );

  if (targetProductSet.size === 0) {
    return {
      conflictProductIds: [],
      conflicts: [],
    };
  }

  const targetGroupIdSet = new Set(
    targetProducts
      .map((product) => product?.itemGroup?.toString?.())
      .filter(Boolean),
  );

  const candidateQuery = {
    business: businessId,
    $or: [
      { appliedProducts: { $in: Array.from(targetProductSet) } },
      { appliedGroupItems: { $in: Array.from(targetProductSet) } },
    ],
  };

  if (targetGroupIdSet.size > 0) {
    candidateQuery.$or.push({
      appliedProductGroups: { $in: Array.from(targetGroupIdSet) },
      groupSelection: { $ne: "selected_items" },
    });
  }

  if (excludeDiscountId) {
    candidateQuery._id = { $ne: excludeDiscountId };
  }

  const candidateDiscounts = await Discount.find(candidateQuery)
    .select(
      "_id discountName appliedProducts appliedGroupItems appliedProductGroups groupSelection",
    )
    .lean();

  const productToGroupMap = new Map(
    targetProducts.map((product) => [
      product._id.toString(),
      product?.itemGroup?.toString?.() || null,
    ]),
  );

  const conflicts = [];
  const conflictProductIdSet = new Set();

  candidateDiscounts.forEach((discount) => {
    const discountProductSet = new Set();

    normalizeIdArray(discount.appliedProducts).forEach((productId) => {
      discountProductSet.add(productId);
    });

    normalizeIdArray(discount.appliedGroupItems).forEach((productId) => {
      discountProductSet.add(productId);
    });

    const discountGroupSet = new Set(normalizeIdArray(discount.appliedProductGroups));

    const matchedProductIds = Array.from(targetProductSet).filter((productId) => {
      if (discountProductSet.has(productId)) {
        return true;
      }

      if (discount.groupSelection === "selected_items") {
        return false;
      }

      const productGroupId = productToGroupMap.get(productId);
      if (!productGroupId) {
        return false;
      }

      return discountGroupSet.has(productGroupId);
    });

    if (matchedProductIds.length === 0) {
      return;
    }

    matchedProductIds.forEach((productId) => conflictProductIdSet.add(productId));
    conflicts.push({
      discountId: discount._id.toString(),
      discountName: discount.discountName,
      productIds: matchedProductIds,
    });
  });

  return {
    conflictProductIds: Array.from(conflictProductIdSet),
    conflicts,
  };
};

const getUnavailableProductIdSetForBusiness = async ({
  businessId,
  excludeDiscountId,
}) => {
  const discountQuery = { business: businessId };

  if (excludeDiscountId) {
    discountQuery._id = { $ne: excludeDiscountId };
  }

  const discounts = await Discount.find(discountQuery)
    .select("appliedProducts appliedGroupItems appliedProductGroups groupSelection")
    .lean();

  const blockedProductIdSet = new Set();
  const fullGroupIds = new Set();

  discounts.forEach((discount) => {
    normalizeIdArray(discount.appliedProducts).forEach((productId) => {
      blockedProductIdSet.add(productId);
    });

    normalizeIdArray(discount.appliedGroupItems).forEach((productId) => {
      blockedProductIdSet.add(productId);
    });

    if (discount.groupSelection !== "selected_items") {
      normalizeIdArray(discount.appliedProductGroups).forEach((groupId) => {
        fullGroupIds.add(groupId);
      });
    }
  });

  if (fullGroupIds.size > 0) {
    const groupedProducts = await Product.find({
      business: businessId,
      productIsaGroup: true,
      itemGroup: { $in: Array.from(fullGroupIds) },
    })
      .select("_id")
      .lean();

    groupedProducts.forEach((product) => {
      blockedProductIdSet.add(product._id.toString());
    });
  }

  return blockedProductIdSet;
};

// @desc    Create a new discount
// @route   POST /api/discounts
// @access  Private
exports.createDiscount = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.business);

  if (!businessId) {
    return res.status(401).json({
      success: false,
      message: "Business context is missing",
    });
  }

  const {
    discountName,
    discountType,
    discountAmount,
    discountValueType,
    startDate,
    expirationDate,
    applyTo,
    appliedProducts,
    appliedProductGroups,
    groupSelection,
    appliedGroupItems,
    description,
  } = req.body;

  // Validate required fields
  if (!discountName || !discountType || discountAmount === undefined) {
    return res.status(400).json({
      success: false,
      message: "Discount name, type, and amount are required",
    });
  }

  if (!discountValueType || !["amount", "percentage"].includes(discountValueType)) {
    return res.status(400).json({
      success: false,
      message: "Discount value type must be 'amount' or 'percentage'",
    });
  }

  if (!startDate || !expirationDate) {
    return res.status(400).json({
      success: false,
      message: "Start date and expiration date are required",
    });
  }

  if (new Date(startDate) > new Date(expirationDate)) {
    return res.status(400).json({
      success: false,
      message: "Start date must be before expiration date",
    });
  }

  if (!applyTo || !["single_product", "group_product", "both"].includes(applyTo)) {
    return res.status(400).json({
      success: false,
      message: "Apply to must be 'single_product', 'group_product', or 'both'",
    });
  }

  // Validate percentage limits
  if (discountValueType === "percentage" && (discountAmount < 0 || discountAmount > 100)) {
    return res.status(400).json({
      success: false,
      message: "Percentage discount must be between 0 and 100",
    });
  }

  // Validate products/groups based on applyTo
  if (
    (applyTo === "single_product" || applyTo === "both") &&
    (!appliedProducts || appliedProducts.length === 0)
  ) {
    return res.status(400).json({
      success: false,
      message: "At least one product must be selected",
    });
  }

  if (
    (applyTo === "group_product" || applyTo === "both") &&
    (!appliedProductGroups || appliedProductGroups.length === 0)
  ) {
    return res.status(400).json({
      success: false,
      message: "At least one product group must be selected",
    });
  }

  const targetProductIds = await resolveTargetProductIdsFromPayload({
    businessId,
    applyTo,
    appliedProducts,
    appliedProductGroups,
    groupSelection,
    appliedGroupItems,
  });

  const { conflictProductIds, conflicts } = await findDiscountProductConflicts({
    businessId,
    targetProductIds,
  });

  if (conflictProductIds.length > 0) {
    return res.status(409).json({
      success: false,
      message:
        "Some selected products already belong to another discount. Remove them and try again.",
      conflictProductIds,
      conflicts,
    });
  }

  // Create discount
  const discount = new Discount({
    business: businessId,
    discountName,
    discountType,
    discountAmount,
    discountValueType,
    startDate,
    expirationDate,
    applyTo,
    appliedProducts:
      applyTo === "single_product" || applyTo === "both"
        ? appliedProducts
        : [],
    appliedProductGroups:
      applyTo === "group_product" || applyTo === "both"
        ? appliedProductGroups
        : [],
    groupSelection:
      (applyTo === "group_product" || applyTo === "both") && groupSelection
        ? groupSelection
        : "all_items",
    appliedGroupItems:
      (applyTo === "group_product" || applyTo === "both") &&
      groupSelection === "selected_items"
        ? appliedGroupItems
        : [],
    description,
  });

  const createdDiscount = await discount.save();

  eventBus.emitBusinessEvent(
    EventTypes.DISCOUNT_CREATED,
    businessId,
    {
      _id: createdDiscount._id,
      discountName: createdDiscount.discountName,
      appliedProducts: createdDiscount.appliedProducts,
      appliedProductGroups: createdDiscount.appliedProductGroups,
      appliedGroupItems: createdDiscount.appliedGroupItems,
      updatedAt: createdDiscount.updatedAt,
    },
    {
      source: "discount_controller",
    },
  );

  logActivity(`Created discount "${createdDiscount.discountName}"`)(req, res);

  res.status(201).json({
    success: true,
    data: createdDiscount,
  });
});

// @desc    Get all discounts for a business
// @route   GET /api/discounts
// @access  Private
exports.getDiscounts = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.business);
  if (!businessId) {
    return res.status(401).json({
      success: false,
      message: "Business context is missing",
    });
  }

  const { status } = req.query;

  const filter = { business: businessId };
  if (status) {
    filter.status = status;
  }

  const discounts = await Discount.find(filter).sort({ createdAt: -1 }).lean();

  const productIds = (
    await Product.find({ business: businessId }).select("_id").lean()
  ).map((product) => product._id);
  const groupIds = (
    await ProductGroup.find({ business: businessId }).select("_id").lean()
  ).map((group) => group._id);

  let recoveredLegacyDiscounts = [];
  const hasProductLinks = productIds.length > 0;
  const hasGroupLinks = groupIds.length > 0;

  if (hasProductLinks || hasGroupLinks) {
    const legacyOwnershipClauses = [];

    if (hasProductLinks) {
      legacyOwnershipClauses.push(
        { appliedProducts: { $in: productIds } },
        { appliedGroupItems: { $in: productIds } },
      );
    }

    if (hasGroupLinks) {
      legacyOwnershipClauses.push({ appliedProductGroups: { $in: groupIds } });
    }

    recoveredLegacyDiscounts = await Discount.find({
      $and: [
        {
          $or: [{ business: { $exists: false } }, { business: null }],
        },
        {
          $or: legacyOwnershipClauses,
        },
        status ? { status } : {},
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    if (recoveredLegacyDiscounts.length > 0) {
      await Discount.updateMany(
        { _id: { $in: recoveredLegacyDiscounts.map((discount) => discount._id) } },
        { $set: { business: businessId } },
      );
      console.warn(
        `[DiscountController] Backfilled business linkage for ${recoveredLegacyDiscounts.length} legacy discount(s) for business ${businessId}`,
      );
    }
  }

  const mergedById = new Map();
  [...discounts, ...recoveredLegacyDiscounts].forEach((discount) => {
    mergedById.set(discount._id.toString(), discount);
  });

  const scopedDiscounts = Array.from(mergedById.values()).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  res.status(200).json({
    success: true,
    count: scopedDiscounts.length,
    data: scopedDiscounts,
  });
});

// @desc    Get a single discount by ID
// @route   GET /api/discounts/:id
// @access  Private
exports.getDiscount = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.business);
  if (!businessId) {
    return res.status(401).json({
      success: false,
      message: "Business context is missing",
    });
  }

  const discount = await Discount.findById(req.params.id)
    .populate("appliedProducts", "name sku price quantity")
    .populate("appliedProductGroups", "groupName combinations")
    .populate("appliedGroupItems", "name sku price quantity");

  if (!discount) {
    return res.status(404).json({
      success: false,
      message: "Discount not found",
    });
  }

  // Check business ownership
  if (!isOwnedByBusiness(discount, businessId)) {
    return res.status(403).json({
      success: false,
      message: "Not authorized to access this discount",
    });
  }

  res.status(200).json({
    success: true,
    data: discount,
  });
});

// @desc    Update a discount
// @route   PUT /api/discounts/:id
// @access  Private
exports.updateDiscount = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.business);
  if (!businessId) {
    return res.status(401).json({
      success: false,
      message: "Business context is missing",
    });
  }

  const {
    discountName,
    discountType,
    discountAmount,
    discountValueType,
    startDate,
    expirationDate,
    applyTo,
    appliedProducts,
    appliedProductGroups,
    groupSelection,
    appliedGroupItems,
    description,
  } = req.body;

  let discount = await Discount.findById(req.params.id);

  if (!discount) {
    return res.status(404).json({
      success: false,
      message: "Discount not found",
    });
  }

  // Check business ownership
  if (!isOwnedByBusiness(discount, businessId)) {
    return res.status(403).json({
      success: false,
      message: "Not authorized to update this discount",
    });
  }

  // Validate dates if provided
  if (startDate && expirationDate) {
    if (new Date(startDate) > new Date(expirationDate)) {
      return res.status(400).json({
        success: false,
        message: "Start date must be before expiration date",
      });
    }
  }

  // Validate percentage
  if (discountValueType === "percentage" && discountAmount !== undefined) {
    if (discountAmount < 0 || discountAmount > 100) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount must be between 0 and 100",
      });
    }
  }

  if (applyTo && !["single_product", "group_product", "both"].includes(applyTo)) {
    return res.status(400).json({
      success: false,
      message: "Apply to must be 'single_product', 'group_product', or 'both'",
    });
  }

  if (
    applyTo &&
    (applyTo === "single_product" || applyTo === "both") &&
    (!appliedProducts || appliedProducts.length === 0)
  ) {
    return res.status(400).json({
      success: false,
      message: "At least one product must be selected",
    });
  }

  if (
    applyTo &&
    (applyTo === "group_product" || applyTo === "both") &&
    (!appliedProductGroups || appliedProductGroups.length === 0)
  ) {
    return res.status(400).json({
      success: false,
      message: "At least one product group must be selected",
    });
  }

  const resolvedApplyTo = applyTo || discount.applyTo;

  const resolvedAppliedProducts =
    applyTo === "single_product" || applyTo === "both"
      ? appliedProducts || []
      : applyTo === "group_product"
        ? []
        : appliedProducts || discount.appliedProducts || [];

  const resolvedAppliedProductGroups =
    applyTo === "group_product" || applyTo === "both"
      ? appliedProductGroups || []
      : applyTo === "single_product"
        ? []
        : appliedProductGroups || discount.appliedProductGroups || [];

  const resolvedGroupSelection =
    applyTo === "group_product" || applyTo === "both"
      ? groupSelection || "all_items"
      : applyTo === "single_product"
        ? "all_items"
        : groupSelection || discount.groupSelection || "all_items";

  const resolvedAppliedGroupItems =
    applyTo === "group_product" || applyTo === "both"
      ? resolvedGroupSelection === "selected_items"
        ? appliedGroupItems || []
        : []
      : applyTo === "single_product"
        ? []
        : appliedGroupItems || discount.appliedGroupItems || [];

  const targetProductIds = await resolveTargetProductIdsFromPayload({
    businessId,
    applyTo: resolvedApplyTo,
    appliedProducts: resolvedAppliedProducts,
    appliedProductGroups: resolvedAppliedProductGroups,
    groupSelection: resolvedGroupSelection,
    appliedGroupItems: resolvedAppliedGroupItems,
  });

  const { conflictProductIds, conflicts } = await findDiscountProductConflicts({
    businessId,
    targetProductIds,
    excludeDiscountId: discount._id,
  });

  if (conflictProductIds.length > 0) {
    return res.status(409).json({
      success: false,
      message:
        "Some selected products already belong to another discount. Remove them and try again.",
      conflictProductIds,
      conflicts,
    });
  }

  // Update fields
  if (discountName) discount.discountName = discountName;
  if (discountType) discount.discountType = discountType;
  if (discountAmount !== undefined) discount.discountAmount = discountAmount;
  if (discountValueType) discount.discountValueType = discountValueType;
  if (startDate) discount.startDate = startDate;
  if (expirationDate) discount.expirationDate = expirationDate;
  if (applyTo) {
    discount.applyTo = applyTo;
    if (applyTo === "single_product") {
      discount.appliedProducts = appliedProducts || [];
      discount.appliedProductGroups = [];
      discount.appliedGroupItems = [];
    } else if (applyTo === "group_product") {
      discount.appliedProductGroups = appliedProductGroups || [];
      discount.groupSelection = groupSelection || "all_items";
      discount.appliedGroupItems =
        groupSelection === "selected_items" ? appliedGroupItems || [] : [];
      discount.appliedProducts = [];
    } else {
      discount.appliedProducts = appliedProducts || [];
      discount.appliedProductGroups = appliedProductGroups || [];
      discount.groupSelection = groupSelection || "all_items";
      discount.appliedGroupItems =
        groupSelection === "selected_items" ? appliedGroupItems || [] : [];
    }
  } else {
    if (appliedProducts) discount.appliedProducts = appliedProducts;
    if (appliedProductGroups) discount.appliedProductGroups = appliedProductGroups;
    if (groupSelection) discount.groupSelection = groupSelection;
    if (appliedGroupItems) discount.appliedGroupItems = appliedGroupItems;
  }
  if (description !== undefined) discount.description = description;

  const updatedDiscount = await discount.save();

  eventBus.emitBusinessEvent(
    EventTypes.DISCOUNT_UPDATED,
    businessId,
    {
      _id: updatedDiscount._id,
      discountName: updatedDiscount.discountName,
      appliedProducts: updatedDiscount.appliedProducts,
      appliedProductGroups: updatedDiscount.appliedProductGroups,
      appliedGroupItems: updatedDiscount.appliedGroupItems,
      updatedAt: updatedDiscount.updatedAt,
    },
    {
      source: "discount_controller",
    },
  );

  logActivity(`Updated discount "${updatedDiscount.discountName}"`)(req, res);

  res.status(200).json({
    success: true,
    data: updatedDiscount,
  });
});

// @desc    Delete a discount
// @route   DELETE /api/discounts/:id
// @access  Private
exports.deleteDiscount = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.business);
  if (!businessId) {
    return res.status(401).json({
      success: false,
      message: "Business context is missing",
    });
  }

  const discount = await Discount.findById(req.params.id);

  if (!discount) {
    return res.status(404).json({
      success: false,
      message: "Discount not found",
    });
  }

  // Check business ownership
  if (!isOwnedByBusiness(discount, businessId)) {
    return res.status(403).json({
      success: false,
      message: "Not authorized to delete this discount",
    });
  }

  await Discount.findByIdAndDelete(req.params.id);

  eventBus.emitBusinessEvent(
    EventTypes.DISCOUNT_DELETED,
    businessId,
    {
      _id: discount._id,
      discountName: discount.discountName,
      appliedProducts: discount.appliedProducts,
      appliedProductGroups: discount.appliedProductGroups,
      appliedGroupItems: discount.appliedGroupItems,
      updatedAt: new Date(),
    },
    {
      source: "discount_controller",
    },
  );

  logActivity(`Deleted discount "${discount.discountName}"`)(req, res);

  res.status(200).json({
    success: true,
    message: "Discount deleted successfully",
  });
});

// @desc    Get products for discount selection
// @route   GET /api/discounts/products/list
// @access  Private
exports.getProductsForDiscount = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.business);
  if (!businessId) {
    return res.status(401).json({
      success: false,
      message: "Business context is missing",
    });
  }

  const excludeDiscountId = req.query.excludeDiscountId;
  const unavailableProductIdSet = await getUnavailableProductIdSetForBusiness({
    businessId,
    excludeDiscountId,
  });

  const products = await Product.find(
    {
      business: businessId,
      _id: { $nin: Array.from(unavailableProductIdSet) },
    },
    "_id name sku price quantity itemGroup productIsaGroup"
  ).limit(500);

  res.status(200).json({
    success: true,
    count: products.length,
    data: products,
  });
});

// @desc    Get product groups for discount selection
// @route   GET /api/discounts/groups/list
// @access  Private
exports.getGroupsForDiscount = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.business);
  if (!businessId) {
    return res.status(401).json({
      success: false,
      message: "Business context is missing",
    });
  }

  const groups = await ProductGroup.find(
    { business: businessId },
    "_id groupName combinations"
  ).limit(500);

  res.status(200).json({
    success: true,
    count: groups.length,
    data: groups,
  });
});
