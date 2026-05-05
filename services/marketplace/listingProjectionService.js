const { resolveEffectiveDiscount } = require("./discountResolver");

const MARKETPLACE_DISCOUNT_TYPES = ["marketplace_sales"];

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

const stockStateFromQty = (qty) => (toNumber(qty) > 0 ? "in_stock" : "out_of_stock");

const variantMatchesListingOptions = (variantName = "", listingOptions = []) => {
  if (!Array.isArray(listingOptions) || listingOptions.length === 0) {
    return true;
  }

  const normalizedName = String(variantName).toLowerCase();

  return listingOptions.every((entry) => {
    const opts = Array.isArray(entry?.options) ? entry.options : [];
    if (opts.length === 0) return true;

    return opts.some((opt) => normalizedName.includes(String(opt).toLowerCase()));
  });
};

const projectSingleListing = async ({ businessId, product, discountContext = null }) => {
  const discountResult = await resolveEffectiveDiscount({
    businessId,
    productId: product._id,
    basePrice: product.price,
    discountContext,
    discountTypes: MARKETPLACE_DISCOUNT_TYPES,
  });

  const productId = toIdString(product._id);

  return {
    listingType: "single",
    listingId: productId,
    productId,
    identity: {
      deterministicId: `single:${productId}`,
      listingId: productId,
      productId,
      listingType: "single",
    },
    name: product.name,
    sku: product.sku,
    category: product.category,
    description: product.description || "",
    stock: {
      quantity: toNumber(product.quantity),
      state: stockStateFromQty(product.quantity),
    },
    price: {
      base: toNumber(product.price),
      effective: toNumber(discountResult.effectivePrice),
      discount: discountResult.discount,
    },
    pricing: {
      basePrice: toNumber(product.price),
      effectivePrice: toNumber(discountResult.effectivePrice),
      discount: discountResult.discount,
    },
    image: product.image || {},
    images: Array.isArray(product.images) ? product.images : [],
    listed: Boolean(product.listProduct),
    updatedAt: product.updatedAt,
    businessId: toIdString(product.business?._id || product.business),
    businessName: product.business?.businessName || "",
  };
};

const projectGroupListing = async ({
  businessId,
  group,
  variants,
  discountContext = null,
}) => {
  const listingOptions = Array.isArray(group.listingOptions) ? group.listingOptions : [];

  const projectedVariants = await Promise.all(
    (Array.isArray(variants) ? variants : [])
      .filter((variant) => variantMatchesListingOptions(variant.name, listingOptions))
      .map(async (variant) => {
        const discountResult = await resolveEffectiveDiscount({
          businessId,
          productId: variant._id,
          variantProductId: variant._id,
          basePrice: variant.price,
          groupId: group._id,
          discountContext,
          discountTypes: MARKETPLACE_DISCOUNT_TYPES,
        });

        const variantId = toIdString(variant._id);
        const groupId = toIdString(group._id);

        return {
          variantId,
          listingId: groupId,
          identity: {
            deterministicId: `group:${groupId}:variant:${variantId}`,
            listingId: groupId,
            groupId,
            variantId,
            listingType: "group_variant",
          },
          name: variant.name,
          sku: variant.sku,
          stock: {
            quantity: toNumber(variant.quantity),
            state: stockStateFromQty(variant.quantity),
          },
          price: {
            base: toNumber(variant.price),
            effective: toNumber(discountResult.effectivePrice),
            discount: discountResult.discount,
          },
          pricing: {
            basePrice: toNumber(variant.price),
            effectivePrice: toNumber(discountResult.effectivePrice),
            discount: discountResult.discount,
          },
          isUnique: Boolean(variant.isProductUnique),
          image: variant.image || {},
          images: Array.isArray(variant.images) ? variant.images : [],
          listed: Boolean(variant.listProduct),
          updatedAt: variant.updatedAt,
        };
      }),
  );

  const groupId = toIdString(group._id);

  return {
    listingType: "group",
    listingId: groupId,
    groupId,
    identity: {
      deterministicId: `group:${groupId}`,
      listingId: groupId,
      groupId,
      listingType: "group",
    },
    groupName: group.groupName,
    category: group.category,
    description: group.description || "",
    listingOptions,
    listed: Boolean(group.listGroup),
    stock: {
      totalVariants: projectedVariants.length,
      hasStock: projectedVariants.some((variant) => variant.stock.quantity > 0),
      state: projectedVariants.some((variant) => variant.stock.quantity > 0)
        ? "in_stock"
        : "out_of_stock",
    },
    variants: projectedVariants,
    image: group.image || {},
    images: Array.isArray(group.images) ? group.images : [],
    updatedAt: group.updatedAt,
    businessId: toIdString(group.business?._id || group.business),
    businessName: group.business?.businessName || "",
  };
};

module.exports = {
  projectSingleListing,
  projectGroupListing,
  stockStateFromQty,
};
