const asyncHandler = require("express-async-handler");
const Product = require("../models/productModel");
const ProductGroup = require("../models/productGroupModel");
const { createDiscountResolutionContext } = require("../services/marketplace/discountResolver");
const { recordListingsRequestMetrics } = require("../services/marketplace/listingsMetrics");
const {
  projectSingleListing,
  projectGroupListing,
} = require("../services/marketplace/listingProjectionService");

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 200;

const PRODUCT_LISTING_PROJECTION = {
  _id: 1,
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
  if (value.toString) return value.toString();
  return "";
};

const msSince = (startNs) => Number(process.hrtime.bigint() - startNs) / 1e6;

const parseLimit = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_PAGE_LIMIT;
  return Math.min(parsed, MAX_PAGE_LIMIT);
};

const encodeCursor = (offset) => Buffer.from(JSON.stringify({ offset })).toString("base64");

const decodeCursor = (cursor) => {
  if (!cursor) return 0;
  try {
    const decoded = JSON.parse(Buffer.from(String(cursor), "base64").toString("utf8"));
    const offset = Number(decoded?.offset);
    if (!Number.isFinite(offset) || offset < 0) return 0;
    return Math.floor(offset);
  } catch (error) {
    return 0;
  }
};

const listPublicListings = asyncHandler(async (req, res) => {
  const requestStartedAt = process.hrtime.bigint();
  const businessId = req.business._id;
  const search = String(req.query.search || "").trim();
  const parsedLimit = parseLimit(req.query.limit);
  const paginationRequested = parsedLimit !== null || Boolean(req.query.cursor);
  const pageLimit = parsedLimit || DEFAULT_PAGE_LIMIT;
  const cursorOffset = decodeCursor(req.query.cursor);

  const queryCounts = {
    products: 0,
    groups: 0,
    variants: 0,
    discounts: 0,
  };

  const phaseTimings = {
    dbFetchMs: 0,
    discountResolutionMs: 0,
    projectionMs: 0,
    serializationMs: 0,
  };

  const productFilter = {
    business: businessId,
    listProduct: true,
    productIsaGroup: false,
  };

  const groupFilter = {
    business: businessId,
    listGroup: true,
  };

  if (search) {
    const rx = new RegExp(search, "i");
    productFilter.$or = [{ name: rx }, { sku: rx }, { category: rx }];
    groupFilter.$or = [{ groupName: rx }, { category: rx }, { description: rx }];
  }

  const dbFetchStartedAt = process.hrtime.bigint();
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

  let pageEntries = [];
  let total = 0;

  if (paginationRequested) {
    const aggregateResult = await Product.aggregate([
      ...unionPipeline,
      {
        $facet: {
          meta: [{ $count: "total" }],
          page: [{ $skip: cursorOffset }, { $limit: pageLimit }],
        },
      },
    ]);

    queryCounts.products += 1;
    queryCounts.groups += 1;

    const firstResult = aggregateResult?.[0] || {};
    pageEntries = Array.isArray(firstResult.page) ? firstResult.page : [];
    total = Number(firstResult.meta?.[0]?.total || 0);
  } else {
    pageEntries = await Product.aggregate(unionPipeline);
    queryCounts.products += 1;
    queryCounts.groups += 1;
    total = pageEntries.length;
  }

  const singleIds = pageEntries
    .filter((entry) => entry.listingType === "single")
    .map((entry) => entry._id);
  const groupIds = pageEntries
    .filter((entry) => entry.listingType === "group")
    .map((entry) => entry._id);

  const [singleProducts, groups] = await Promise.all([
    singleIds.length > 0
      ? Product.find({ _id: { $in: singleIds }, business: businessId })
          .select(PRODUCT_LISTING_PROJECTION)
          .lean()
      : [],
    groupIds.length > 0
      ? ProductGroup.find({ _id: { $in: groupIds }, business: businessId })
          .select(GROUP_LISTING_PROJECTION)
          .lean()
      : [],
  ]);

  const groupVariants =
    groupIds.length > 0
      ? await Product.find({
          business: businessId,
          productIsaGroup: true,
          itemGroup: { $in: groupIds },
          listProduct: true,
        })
          .select(VARIANT_LISTING_PROJECTION)
          .sort({ updatedAt: -1 })
          .lean()
      : [];

  if (groupIds.length > 0) queryCounts.variants += 1;
  phaseTimings.dbFetchMs = msSince(dbFetchStartedAt);

  const discountResolutionStartedAt = process.hrtime.bigint();
  const discountContext = await createDiscountResolutionContext({ businessId });
  queryCounts.discounts += 1;
  phaseTimings.discountResolutionMs = msSince(discountResolutionStartedAt);

  const variantsByGroup = groupVariants.reduce((acc, variant) => {
    const key = toIdString(variant.itemGroup);
    if (!acc[key]) acc[key] = [];
    acc[key].push(variant);
    return acc;
  }, {});

  const projectionStartedAt = process.hrtime.bigint();
  const [singlePayloadById, groupPayloadById] = await Promise.all([
    Promise.all(
      singleProducts.map((product) =>
        projectSingleListing({
          businessId,
          product,
          discountContext,
        }).then((payload) => [toIdString(product._id), payload]),
      ),
    ),
    Promise.all(
      groups.map((group) =>
        projectGroupListing({
          businessId,
          group,
          variants: variantsByGroup[toIdString(group._id)] || [],
          discountContext,
        }).then((payload) => [toIdString(group._id), payload]),
      ),
    ),
  ]);
  phaseTimings.projectionMs = msSince(projectionStartedAt);

  const serializationStartedAt = process.hrtime.bigint();
  const singlePayload = Object.fromEntries(singlePayloadById);
  const groupPayload = Object.fromEntries(groupPayloadById);

  const listings = pageEntries
    .map((entry) => {
      const id = toIdString(entry._id);
      if (entry.listingType === "single") {
        return singlePayload[id] || null;
      }
      return groupPayload[id] || null;
    })
    .filter(Boolean);

  let responseListings = listings;
  let pagination = null;

  if (paginationRequested) {
    const start = Math.min(cursorOffset, total);
    const end = Math.min(start + pageLimit, total);
    const hasMore = end < total;

    pagination = {
      limit: pageLimit,
      cursor: req.query.cursor || null,
      nextCursor: hasMore ? encodeCursor(end) : null,
      hasMore,
    };
  }

  phaseTimings.serializationMs = msSince(serializationStartedAt);

  const totalDurationMs = msSince(requestStartedAt);
  const requestId = req?.id || req?.headers?.["x-request-id"] || null;

  recordListingsRequestMetrics({
    durationMs: totalDurationMs,
    queryCounts,
  });

  console.info("[PublicMarketplaceListings] request_timing", {
    businessId: toIdString(businessId),
    requestId,
    searchApplied: Boolean(search),
    total,
    returned: responseListings.length,
    paginationRequested,
    queryCounts,
    phaseTimings,
    totalDurationMs: Number(totalDurationMs.toFixed(2)),
  });

  const payload = {
    listings: responseListings,
    total,
  };

  if (pagination) {
    payload.pagination = pagination;
  }

  return res.status(200).json(payload);
});

const getPublicListingDetails = asyncHandler(async (req, res) => {
  const businessId = req.business._id;
  const { listingId } = req.params;
  const discountContext = await createDiscountResolutionContext({ businessId });

  const single = await Product.findOne({
    _id: listingId,
    business: businessId,
    listProduct: true,
    productIsaGroup: false,
  })
    .select(PRODUCT_LISTING_PROJECTION)
    .lean();

  if (single) {
    const payload = await projectSingleListing({
      businessId,
      product: single,
      discountContext,
    });
    return res.status(200).json(payload);
  }

  const group = await ProductGroup.findOne({
    _id: listingId,
    business: businessId,
    listGroup: true,
  })
    .select(GROUP_LISTING_PROJECTION)
    .lean();

  if (group) {
    const variants = await Product.find({
      business: businessId,
      productIsaGroup: true,
      itemGroup: group._id,
      listProduct: true,
    })
      .select(VARIANT_LISTING_PROJECTION)
      .sort({ updatedAt: -1 })
      .lean();

    const payload = await projectGroupListing({
      businessId,
      group,
      variants,
      discountContext,
    });
    return res.status(200).json(payload);
  }

  return res.status(404).json({ message: "Listing not found" });
});

module.exports = {
  listPublicListings,
  getPublicListingDetails,
};
