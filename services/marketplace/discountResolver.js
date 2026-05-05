const Discount = require("../../models/discountModel");

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  if (value.toString) return value.toString();
  return "";
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getDiscountedPrice = (basePrice, discount) => {
  const safeBasePrice = Math.max(0, toNumber(basePrice));
  const amount = Math.max(0, toNumber(discount.discountAmount));

  if (discount.discountValueType === "percentage") {
    const capped = Math.min(amount, 100);
    return Math.max(0, safeBasePrice - (safeBasePrice * capped) / 100);
  }

  return Math.max(0, safeBasePrice - amount);
};

const ACTIVE_DISCOUNT_PROJECTION = {
  _id: 1,
  discountName: 1,
  discountAmount: 1,
  discountValueType: 1,
  startDate: 1,
  expirationDate: 1,
  applyTo: 1,
  appliedProducts: 1,
  appliedProductGroups: 1,
  groupSelection: 1,
  appliedGroupItems: 1,
  isActive: 1,
  status: 1,
  createdAt: 1,
};

const isDiscountCurrentlyActive = (discount, atDate = new Date()) => {
  const now = atDate instanceof Date ? atDate : new Date(atDate);
  const start = new Date(discount.startDate);
  const expiration = new Date(discount.expirationDate);

  return (
    discount.isActive === true &&
    discount.status === "active" &&
    start <= now &&
    expiration >= now
  );
};

const fetchActiveDiscountsForBusiness = async ({
  businessId,
  atDate = new Date(),
  projection = ACTIVE_DISCOUNT_PROJECTION,
  discountTypes = null,
}) => {
  const normalizedBusinessId = toIdString(businessId);
  if (!normalizedBusinessId) {
    return [];
  }

  const normalizedDiscountTypes = Array.isArray(discountTypes)
    ? discountTypes.map((value) => String(value || "").trim()).filter(Boolean)
    : [];

  const query = {
    business: normalizedBusinessId,
    isActive: true,
    status: "active",
    startDate: { $lte: atDate },
    expirationDate: { $gte: atDate },
  };

  if (normalizedDiscountTypes.length > 0) {
    query.discountType = { $in: normalizedDiscountTypes };
  }

  try {
    return await Discount.find(query)
      .select(projection)
      .sort({ createdAt: -1 })
      .lean();
  } catch (error) {
    if (error?.name === "CastError" && error?.path === "business") {
      return [];
    }
    throw error;
  }
};

const createDiscountResolutionContext = async ({
  businessId,
  atDate = new Date(),
  discountTypes = null,
}) => {
  const candidateDiscounts = await fetchActiveDiscountsForBusiness({
    businessId,
    atDate,
    discountTypes,
  });

  return {
    atDate,
    candidateDiscounts,
  };
};

const discountAppliesToContext = ({ discount, productId, groupId, variantProductId }) => {
  const targetProductId = toIdString(variantProductId || productId);
  const targetGroupId = toIdString(groupId);

  const appliedProducts = new Set((discount.appliedProducts || []).map(toIdString));
  const appliedGroupItems = new Set((discount.appliedGroupItems || []).map(toIdString));
  const appliedProductGroups = new Set(
    (discount.appliedProductGroups || []).map(toIdString),
  );

  if (appliedProducts.has(targetProductId) || appliedGroupItems.has(targetProductId)) {
    return true;
  }

  if (!targetGroupId || !appliedProductGroups.has(targetGroupId)) {
    return false;
  }

  if (discount.groupSelection === "selected_items") {
    return appliedGroupItems.has(targetProductId);
  }

  return true;
};

const resolveEffectiveDiscount = async ({
  businessId,
  productId,
  basePrice,
  groupId = null,
  variantProductId = null,
  atDate = new Date(),
  discountContext = null,
  candidateDiscounts = null,
  discountTypes = null,
}) => {
  const normalizedBusinessId = toIdString(businessId);
  const normalizedProductId = toIdString(productId);

  if (!normalizedBusinessId || !normalizedProductId) {
    return {
      applied: false,
      basePrice: toNumber(basePrice),
      effectivePrice: toNumber(basePrice),
      discount: null,
    };
  }

  const resolvedAtDate = discountContext?.atDate || atDate;

  const resolvedCandidateDiscounts = Array.isArray(candidateDiscounts)
    ? candidateDiscounts
    : Array.isArray(discountContext?.candidateDiscounts)
      ? discountContext.candidateDiscounts
      : await fetchActiveDiscountsForBusiness({
          businessId: normalizedBusinessId,
          atDate: resolvedAtDate,
          discountTypes,
        });

  const effectiveDiscount = resolvedCandidateDiscounts.find((discount) => {
    if (!isDiscountCurrentlyActive(discount, resolvedAtDate)) {
      return false;
    }

    return discountAppliesToContext({
      discount,
      productId: normalizedProductId,
      groupId,
      variantProductId,
    });
  });

  if (!effectiveDiscount) {
    return {
      applied: false,
      basePrice: toNumber(basePrice),
      effectivePrice: toNumber(basePrice),
      discount: null,
    };
  }

  const effectivePrice = getDiscountedPrice(basePrice, effectiveDiscount);

  return {
    applied: true,
    basePrice: toNumber(basePrice),
    effectivePrice,
    discount: {
      id: toIdString(effectiveDiscount._id),
      name: effectiveDiscount.discountName,
      valueType: effectiveDiscount.discountValueType,
      amount: toNumber(effectiveDiscount.discountAmount),
      createdAt: effectiveDiscount.createdAt,
    },
  };
};

module.exports = {
  resolveEffectiveDiscount,
  discountAppliesToContext,
  getDiscountedPrice,
  fetchActiveDiscountsForBusiness,
  createDiscountResolutionContext,
  ACTIVE_DISCOUNT_PROJECTION,
  isDiscountCurrentlyActive,
};
