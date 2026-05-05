const crypto = require("crypto");
const mongoose = require("mongoose");
const Product = require("../models/productModel");
const ProductGroup = require("../models/productGroupModel");
const Discount = require("../models/discountModel");
const MigrationState = require("../models/migrationStateModel");

const MIGRATION_KEY = "variant_key_discount_repair_v1";

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  if (value.toString) return value.toString();
  return "";
};

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const generateVariantKey = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : new mongoose.Types.ObjectId().toString();

const shouldDraftDiscountAfterDetach = (discount) => {
  const productsCount = Array.isArray(discount?.appliedProducts)
    ? discount.appliedProducts.length
    : 0;
  const groupsCount = Array.isArray(discount?.appliedProductGroups)
    ? discount.appliedProductGroups.length
    : 0;
  const groupItemsCount = Array.isArray(discount?.appliedGroupItems)
    ? discount.appliedGroupItems.length
    : 0;

  const hasSingleTargets = productsCount > 0;
  const hasGroupAllTargets =
    groupsCount > 0 && discount?.groupSelection !== "selected_items";
  const hasGroupSelectedTargets = groupItemsCount > 0;

  return !hasSingleTargets && !hasGroupAllTargets && !hasGroupSelectedTargets;
};

const mapsEqual = (left, right) => {
  const normalize = (list = []) =>
    (Array.isArray(list) ? list : []).map((entry) => ({
      variantKey: String(entry?.variantKey || ""),
      combination: String(entry?.combination || ""),
      sku: String(entry?.sku || ""),
      indexHint: Number(entry?.indexHint ?? -1),
      lastKnownProductId: toIdString(entry?.lastKnownProductId || ""),
    }));

  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
};

const buildVariantMap = ({ group, variants }) => {
  const normalizedCombinations = Array.isArray(group?.combinations)
    ? group.combinations.map((value) => String(value || ""))
    : [];

  const indexQueueByName = new Map();
  normalizedCombinations.forEach((combination, index) => {
    const normalized = normalizeText(combination);
    if (!normalized) return;
    if (!indexQueueByName.has(normalized)) {
      indexQueueByName.set(normalized, []);
    }
    indexQueueByName.get(normalized).push(index);
  });

  return variants.map((variant, fallbackIndex) => {
    const normalizedName = normalizeText(variant.name);
    const indexQueue = indexQueueByName.get(normalizedName) || [];
    const indexHint =
      indexQueue.length > 0 ? indexQueue.shift() : Number(fallbackIndex || 0);

    return {
      variantKey: String(variant.variantKey || ""),
      combination:
        normalizedCombinations[indexHint] || String(variant.name || ""),
      sku: String(variant.sku || ""),
      indexHint,
      lastKnownProductId: variant._id,
    };
  });
};

const runVariantBackfillForBusiness = async (businessId) => {
  const metrics = {
    groupsScanned: 0,
    variantsScanned: 0,
    variantKeysBackfilled: 0,
    variantLabelsBackfilled: 0,
    groupVariantMapsUpdated: 0,
  };

  const groups = await ProductGroup.find({ business: businessId })
    .select("_id combinations variantMap")
    .lean();

  metrics.groupsScanned = groups.length;

  for (const group of groups) {
    const variants = await Product.find({
      business: businessId,
      itemGroup: group._id,
      productIsaGroup: true,
    })
      .select("_id name sku variantKey variantLabel")
      .lean();

    metrics.variantsScanned += variants.length;

    const seenKeys = new Set();
    const normalizedVariants = variants.map((variant) => {
      let variantKey = String(variant.variantKey || "").trim();
      if (!variantKey || seenKeys.has(variantKey)) {
        variantKey = generateVariantKey();
      }
      seenKeys.add(variantKey);

      return {
        ...variant,
        variantKey,
      };
    });

    for (const variant of normalizedVariants) {
      const nextVariantLabel = String(variant.name || "");
      const previousVariantKey = String(
        variants.find((entry) => toIdString(entry._id) === toIdString(variant._id))
          ?.variantKey || "",
      ).trim();
      const previousVariantLabel = String(
        variants.find((entry) => toIdString(entry._id) === toIdString(variant._id))
          ?.variantLabel || "",
      );

      const requiresKeyUpdate = previousVariantKey !== variant.variantKey;
      const requiresLabelUpdate = previousVariantLabel !== nextVariantLabel;

      if (!requiresKeyUpdate && !requiresLabelUpdate) {
        continue;
      }

      await Product.updateOne(
        { _id: variant._id },
        {
          $set: {
            variantKey: variant.variantKey,
            variantLabel: nextVariantLabel,
          },
        },
      );

      if (requiresKeyUpdate) metrics.variantKeysBackfilled += 1;
      if (requiresLabelUpdate) metrics.variantLabelsBackfilled += 1;
    }

    const nextVariantMap = buildVariantMap({
      group,
      variants: normalizedVariants,
    });

    if (!mapsEqual(group.variantMap, nextVariantMap)) {
      await ProductGroup.updateOne(
        { _id: group._id },
        {
          $set: {
            variantMap: nextVariantMap,
          },
        },
      );

      metrics.groupVariantMapsUpdated += 1;
    }
  }

  return metrics;
};

const runDiscountRepairForBusiness = async (businessId) => {
  const metrics = {
    discountsScanned: 0,
    discountsUpdated: 0,
    detachedAppliedProducts: 0,
    detachedAppliedGroupItems: 0,
    detachedAppliedProductGroups: 0,
    discountsDrafted: 0,
  };

  const [products, groups, discounts] = await Promise.all([
    Product.find({ business: businessId }).select("_id").lean(),
    ProductGroup.find({ business: businessId }).select("_id").lean(),
    Discount.find({ business: businessId }),
  ]);

  const validProductIds = new Set(products.map((entry) => toIdString(entry._id)));
  const validGroupIds = new Set(groups.map((entry) => toIdString(entry._id)));

  metrics.discountsScanned = discounts.length;

  for (const discount of discounts) {
    const originalAppliedProducts = Array.isArray(discount.appliedProducts)
      ? discount.appliedProducts
      : [];
    const originalAppliedGroupItems = Array.isArray(discount.appliedGroupItems)
      ? discount.appliedGroupItems
      : [];
    const originalAppliedProductGroups = Array.isArray(discount.appliedProductGroups)
      ? discount.appliedProductGroups
      : [];

    const nextAppliedProducts = originalAppliedProducts.filter((entry) =>
      validProductIds.has(toIdString(entry)),
    );
    const nextAppliedGroupItems = originalAppliedGroupItems.filter((entry) =>
      validProductIds.has(toIdString(entry)),
    );
    const nextAppliedProductGroups = originalAppliedProductGroups.filter((entry) =>
      validGroupIds.has(toIdString(entry)),
    );

    const detachedProductsCount =
      originalAppliedProducts.length - nextAppliedProducts.length;
    const detachedGroupItemsCount =
      originalAppliedGroupItems.length - nextAppliedGroupItems.length;
    const detachedGroupsCount =
      originalAppliedProductGroups.length - nextAppliedProductGroups.length;

    let changed = false;

    if (detachedProductsCount > 0) {
      discount.appliedProducts = nextAppliedProducts;
      metrics.detachedAppliedProducts += detachedProductsCount;
      changed = true;
    }

    if (detachedGroupItemsCount > 0) {
      discount.appliedGroupItems = nextAppliedGroupItems;
      metrics.detachedAppliedGroupItems += detachedGroupItemsCount;
      changed = true;
    }

    if (detachedGroupsCount > 0) {
      discount.appliedProductGroups = nextAppliedProductGroups;
      metrics.detachedAppliedProductGroups += detachedGroupsCount;
      changed = true;
    }

    if (shouldDraftDiscountAfterDetach(discount)) {
      if (discount.status !== "draft" || discount.isActive !== false) {
        discount.status = "draft";
        discount.isActive = false;
        metrics.discountsDrafted += 1;
        changed = true;
      }
    }

    if (changed) {
      await discount.save();
      metrics.discountsUpdated += 1;
    }
  }

  return metrics;
};

const runVariantIdentityRepairForBusiness = async (businessId, options = {}) => {
  const normalizedBusinessId = toIdString(businessId);
  if (!normalizedBusinessId) {
    return {
      skipped: true,
      reason: "missing_business_id",
    };
  }

  const force = Boolean(options.force);
  const migrationState = await MigrationState.findOne({
    business: normalizedBusinessId,
    key: MIGRATION_KEY,
  }).lean();

  if (!force && migrationState?.status === "completed") {
    return {
      skipped: true,
      reason: "already_completed",
      metrics: migrationState.metrics || {},
    };
  }

  await MigrationState.updateOne(
    {
      business: normalizedBusinessId,
      key: MIGRATION_KEY,
    },
    {
      $set: {
        status: "running",
        error: "",
        lastRunAt: new Date(),
      },
      $setOnInsert: {
        business: normalizedBusinessId,
        key: MIGRATION_KEY,
      },
    },
    { upsert: true },
  );

  try {
    const [backfillMetrics, discountMetrics] = await Promise.all([
      runVariantBackfillForBusiness(normalizedBusinessId),
      runDiscountRepairForBusiness(normalizedBusinessId),
    ]);

    const metrics = {
      ...backfillMetrics,
      ...discountMetrics,
    };

    await MigrationState.updateOne(
      {
        business: normalizedBusinessId,
        key: MIGRATION_KEY,
      },
      {
        $set: {
          status: "completed",
          completedAt: new Date(),
          lastRunAt: new Date(),
          error: "",
          metrics,
        },
      },
      { upsert: true },
    );

    return {
      skipped: false,
      metrics,
    };
  } catch (error) {
    await MigrationState.updateOne(
      {
        business: normalizedBusinessId,
        key: MIGRATION_KEY,
      },
      {
        $set: {
          status: "failed",
          lastRunAt: new Date(),
          error: String(error?.message || "Variant identity repair failed"),
        },
      },
      { upsert: true },
    );

    throw error;
  }
};

const runVariantIdentityRepairSweep = async (options = {}) => {
  const [groupBusinesses, discountBusinesses] = await Promise.all([
    ProductGroup.distinct("business"),
    Discount.distinct("business"),
  ]);

  const businessIds = Array.from(
    new Set(
      [...groupBusinesses, ...discountBusinesses]
        .map((entry) => toIdString(entry))
        .filter(Boolean),
    ),
  );

  const summary = {
    businessesScanned: businessIds.length,
    businessesCompleted: 0,
    businessesSkipped: 0,
    businessesFailed: 0,
  };

  for (const businessId of businessIds) {
    try {
      const result = await runVariantIdentityRepairForBusiness(businessId, options);
      if (result?.skipped) {
        summary.businessesSkipped += 1;
      } else {
        summary.businessesCompleted += 1;
      }
    } catch (error) {
      summary.businessesFailed += 1;
    }
  }

  return summary;
};

module.exports = {
  MIGRATION_KEY,
  runVariantBackfillForBusiness,
  runDiscountRepairForBusiness,
  runVariantIdentityRepairForBusiness,
  runVariantIdentityRepairSweep,
};
