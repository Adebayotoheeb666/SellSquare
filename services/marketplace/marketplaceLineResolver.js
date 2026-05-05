const Product = require("../../models/productModel");
const ProductGroup = require("../../models/productGroupModel");

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.toString) return value.toString();
  return "";
};

const readTrimmed = (value) => (typeof value === "string" ? value.trim() : "");

const createResolverError = (message, code = "INVALID_LISTING_PRODUCT") => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
};

const resolveLegacyProductLine = async ({ businessId, productId }) => {
  const resolvedProduct = await Product.findOne({
    _id: productId,
    business: businessId,
    listProduct: true,
  }).lean();

  if (!resolvedProduct) {
    throw createResolverError(`Product not found or not listed: ${productId}`);
  }

  let resolvedGroupId = resolvedProduct.itemGroup || null;
  let canonicalListingId = toIdString(resolvedProduct._id);

  if (resolvedProduct.itemGroup) {
    const listedGroup = await ProductGroup.findOne({
      _id: resolvedProduct.itemGroup,
      business: businessId,
      listGroup: true,
    })
      .select("_id")
      .lean();

    if (listedGroup) {
      resolvedGroupId = listedGroup._id;
      canonicalListingId = toIdString(listedGroup._id);
    }
  }

  return {
    resolvedProduct,
    resolvedGroupId,
    isGroupVariant: Boolean(resolvedProduct.productIsaGroup),
    canonicalListingId,
    canonicalVariantId: toIdString(resolvedProduct._id),
  };
};

const resolveGroupListingLine = async ({ businessId, groupId, variantId }) => {
  const groupListing = await ProductGroup.findOne({
    _id: groupId,
    business: businessId,
    listGroup: true,
  })
    .select("_id")
    .lean();

  if (!groupListing) return null;

  const resolvedVariant = await Product.findOne({
    _id: variantId,
    business: businessId,
    itemGroup: groupListing._id,
    productIsaGroup: true,
    listProduct: true,
  }).lean();

  if (!resolvedVariant) {
    throw createResolverError(
      `Variant ${variantId} does not belong to listed group ${groupId}`,
      "LISTING_VARIANT_MISMATCH",
    );
  }

  return {
    resolvedProduct: resolvedVariant,
    resolvedGroupId: groupListing._id,
    isGroupVariant: true,
    canonicalListingId: toIdString(groupListing._id),
    canonicalVariantId: toIdString(resolvedVariant._id),
  };
};

const resolveListingAndVariantLine = async ({ businessId, listingId, variantId }) => {
  const resolvedGroup = await resolveGroupListingLine({
    businessId,
    groupId: listingId,
    variantId,
  });

  if (resolvedGroup) {
    return resolvedGroup;
  }

  const listingProduct = await Product.findOne({
    _id: listingId,
    business: businessId,
    listProduct: true,
  }).lean();

  if (!listingProduct) {
    throw createResolverError(`Listing not found or not listed: ${listingId}`);
  }

  if (listingProduct.productIsaGroup && listingProduct.itemGroup) {
    const parentGroup = await ProductGroup.findOne({
      _id: listingProduct.itemGroup,
      business: businessId,
      listGroup: true,
    })
      .select("_id")
      .lean();

    if (parentGroup) {
      const resolvedVariant = await Product.findOne({
        _id: variantId,
        business: businessId,
        itemGroup: parentGroup._id,
        productIsaGroup: true,
        listProduct: true,
      }).lean();

      if (!resolvedVariant) {
        throw createResolverError(
          `Variant ${variantId} does not belong to listed group ${toIdString(parentGroup._id)}`,
          "LISTING_VARIANT_MISMATCH",
        );
      }

      return {
        resolvedProduct: resolvedVariant,
        resolvedGroupId: parentGroup._id,
        isGroupVariant: true,
        canonicalListingId: toIdString(parentGroup._id),
        canonicalVariantId: toIdString(resolvedVariant._id),
      };
    }
  }

  if (toIdString(listingProduct._id) !== variantId) {
    throw createResolverError(
      `Variant ${variantId} does not match listing ${listingId}`,
      "LISTING_VARIANT_MISMATCH",
    );
  }

  return {
    resolvedProduct: listingProduct,
    resolvedGroupId: listingProduct.itemGroup || null,
    isGroupVariant: Boolean(listingProduct.productIsaGroup),
    canonicalListingId: toIdString(listingProduct._id),
    canonicalVariantId: toIdString(listingProduct._id),
  };
};

const resolveMarketplaceLineIdentity = async ({ businessId, lineInput = {} }) => {
  const productId = readTrimmed(lineInput.productId);
  const listingId = readTrimmed(lineInput.listingId);
  const variantId = readTrimmed(lineInput.variantId);

  if (productId) {
    return resolveLegacyProductLine({ businessId, productId });
  }

  if (listingId && variantId) {
    return resolveListingAndVariantLine({ businessId, listingId, variantId });
  }

  throw createResolverError(
    "Line must include either productId or listingId+variantId",
    "INVALID_LINE_IDENTITY",
  );
};

module.exports = {
  resolveMarketplaceLineIdentity,
};
