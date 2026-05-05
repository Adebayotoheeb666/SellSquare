const Product = require("../../models/productModel");
const ProductGroup = require("../../models/productGroupModel");
const { createDiscountResolutionContext } = require("./discountResolver");
const {
  projectSingleListing,
  projectGroupListing,
} = require("./listingProjectionService");

const PRODUCT_LISTING_PROJECTION = {
  _id: 1,
  productIsaGroup: 1,
  itemGroup: 1,
  name: 1,
  sku: 1,
  category: 1,
  description: 1,
  quantity: 1,
  price: 1,
  image: 1,
  images: 1,
  listProduct: 1,
  updatedAt: 1,
};

const GROUP_LISTING_PROJECTION = {
  _id: 1,
  groupName: 1,
  category: 1,
  description: 1,
  listingOptions: 1,
  listGroup: 1,
  image: 1,
  images: 1,
  updatedAt: 1,
};

const VARIANT_LISTING_PROJECTION = {
  _id: 1,
  itemGroup: 1,
  name: 1,
  sku: 1,
  quantity: 1,
  price: 1,
  isProductUnique: 1,
  image: 1,
  images: 1,
  listProduct: 1,
  updatedAt: 1,
};

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  if (value.toString) return value.toString();
  return "";
};

const normalizeRefs = (refs = []) => {
  const result = [];

  (Array.isArray(refs) ? refs : []).forEach((entry) => {
    if (!entry) return;

    if (typeof entry === "string") {
      result.push({ productId: entry });
      return;
    }

    if (typeof entry !== "object") return;

    result.push({
      productId: toIdString(entry.productId || entry.variantId || entry._id),
      groupId: toIdString(entry.groupId || entry.listingId),
      listingType: entry.listingType || "",
    });
  });

  return result;
};

const toCanonicalSingleListing = (listing) => ({
  listingId: listing.listingId,
  listingType: "single",
  identity: listing.identity,
  name: listing.name,
  sku: listing.sku,
  category: listing.category,
  description: listing.description,
  listed: Boolean(listing.listed),
  updatedAt: listing.updatedAt,
  stock: listing.stock,
  pricing: listing.pricing || {
    basePrice: Number(listing?.price?.base || 0),
    effectivePrice: Number(listing?.price?.effective || 0),
    discount: listing?.price?.discount || null,
  },
  price: listing.price,
  image: listing.image,
  images: listing.images,
});

const toCanonicalGroupListing = (listing) => ({
  listingId: listing.listingId,
  listingType: "group",
  identity: listing.identity,
  groupName: listing.groupName,
  category: listing.category,
  description: listing.description,
  listed: Boolean(listing.listed),
  updatedAt: listing.updatedAt,
  stock: listing.stock,
  listingOptions: Array.isArray(listing.listingOptions) ? listing.listingOptions : [],
  variants: Array.isArray(listing.variants)
    ? listing.variants.map((variant) => ({
        variantId: variant.variantId,
        listingId: variant.listingId || listing.listingId,
        identity: variant.identity,
        name: variant.name,
        sku: variant.sku,
        listed: Boolean(variant.listed),
        updatedAt: variant.updatedAt,
        stock: variant.stock,
        pricing: variant.pricing || {
          basePrice: Number(variant?.price?.base || 0),
          effectivePrice: Number(variant?.price?.effective || 0),
          discount: variant?.price?.discount || null,
        },
        price: variant.price,
        image: variant.image,
        images: variant.images,
      }))
    : [],
  image: listing.image,
  images: listing.images,
});

const buildMarketplaceListingSnapshot = async ({
  businessId,
  refs = [],
  occurredAt,
}) => {
  const normalizedRefs = normalizeRefs(refs);

  const productIds = new Set();
  const groupIds = new Set();

  normalizedRefs.forEach((ref) => {
    if (ref.productId) {
      productIds.add(ref.productId);
    }

    if (ref.groupId) {
      groupIds.add(ref.groupId);
    }
  });

  const products = productIds.size
    ? await Product.find({
        business: businessId,
        _id: { $in: Array.from(productIds) },
      })
        .select(PRODUCT_LISTING_PROJECTION)
        .lean()
    : [];

  products.forEach((product) => {
    if (product.productIsaGroup && product.itemGroup) {
      groupIds.add(toIdString(product.itemGroup));
    }
  });

  const singleProducts = products.filter(
    (product) => !(product.productIsaGroup && product.itemGroup),
  );

  const groups = groupIds.size
    ? await ProductGroup.find({
        business: businessId,
        _id: { $in: Array.from(groupIds) },
      })
        .select(GROUP_LISTING_PROJECTION)
        .lean()
    : [];

  const variants = groupIds.size
    ? await Product.find({
        business: businessId,
        productIsaGroup: true,
        itemGroup: { $in: Array.from(groupIds) },
      })
        .select(VARIANT_LISTING_PROJECTION)
        .sort({ updatedAt: -1 })
        .lean()
    : [];

  const discountContext = await createDiscountResolutionContext({ businessId });

  const variantsByGroup = variants.reduce((acc, variant) => {
    const key = toIdString(variant.itemGroup);
    if (!key) return acc;

    if (!acc[key]) {
      acc[key] = [];
    }

    acc[key].push(variant);
    return acc;
  }, {});
  const groupedVariantIds = new Set(variants.map((variant) => toIdString(variant._id)));

  const canonicalListings = [];

  const projectedSingles = await Promise.all(
    singleProducts.map((product) =>
      projectSingleListing({
        businessId,
        product,
        discountContext,
      }),
    ),
  );

  projectedSingles.forEach((listing) => {
    canonicalListings.push(toCanonicalSingleListing(listing));
  });

  const projectedGroups = await Promise.all(
    groups.map((group) =>
      projectGroupListing({
        businessId,
        group,
        variants: variantsByGroup[toIdString(group._id)] || [],
        discountContext,
      }),
    ),
  );

  projectedGroups.forEach((listing) => {
    canonicalListings.push(toCanonicalGroupListing(listing));
  });

  const existingListingIds = new Set(canonicalListings.map((listing) => listing.listingId));

  normalizedRefs.forEach((ref) => {
    if (ref.groupId && !existingListingIds.has(ref.groupId)) {
      canonicalListings.push({
        listingId: ref.groupId,
        listingType: "group",
        identity: {
          deterministicId: `group:${ref.groupId}`,
          listingId: ref.groupId,
          groupId: ref.groupId,
          listingType: "group",
        },
        listed: false,
        updatedAt: occurredAt || new Date().toISOString(),
        removed: true,
        variants: [],
      });
      existingListingIds.add(ref.groupId);
      return;
    }

    if (
      ref.productId
      && !existingListingIds.has(ref.productId)
      && !ref.groupId
      && !groupedVariantIds.has(ref.productId)
    ) {
      canonicalListings.push({
        listingId: ref.productId,
        listingType: "single",
        identity: {
          deterministicId: `single:${ref.productId}`,
          listingId: ref.productId,
          productId: ref.productId,
          listingType: "single",
        },
        listed: false,
        updatedAt: occurredAt || new Date().toISOString(),
        removed: true,
      });
      existingListingIds.add(ref.productId);
    }
  });

  return canonicalListings;
};

module.exports = {
  buildMarketplaceListingSnapshot,
  normalizeRefs,
};
