jest.mock("../../models/productModel", () => ({
  find: jest.fn(),
}));

jest.mock("../../models/productGroupModel", () => ({
  find: jest.fn(),
}));

jest.mock("../../services/marketplace/listingProjectionService", () => ({
  projectSingleListing: jest.fn(),
  projectGroupListing: jest.fn(),
}));

jest.mock("../../services/marketplace/discountResolver", () => ({
  createDiscountResolutionContext: jest.fn().mockResolvedValue({}),
}));

const Product = require("../../models/productModel");
const ProductGroup = require("../../models/productGroupModel");
const {
  projectSingleListing,
  projectGroupListing,
} = require("../../services/marketplace/listingProjectionService");
const {
  buildMarketplaceListingSnapshot,
} = require("../../services/marketplace/listingWebhookPayloadBuilder");

const buildLeanResult = (rows) => ({
  select: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(rows),
  }),
});

const buildSortedLeanResult = (rows) => ({
  select: jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(rows),
    }),
  }),
});

describe("marketplace listing webhook payload builder", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("single listing discount change includes deterministic identity and canonical pricing", async () => {
    Product.find
      .mockReturnValueOnce(buildLeanResult([
        {
          _id: "product_1",
          productIsaGroup: false,
          listProduct: true,
        },
      ]))
      .mockReturnValueOnce(buildSortedLeanResult([]));

    ProductGroup.find.mockReturnValue(buildLeanResult([]));

    projectSingleListing.mockResolvedValue({
      listingId: "product_1",
      listingType: "single",
      identity: {
        deterministicId: "single:product_1",
        listingId: "product_1",
        productId: "product_1",
        listingType: "single",
      },
      listed: true,
      updatedAt: "2026-03-04T09:00:00.000Z",
      stock: { quantity: 9, state: "in_stock" },
      price: {
        base: 5000,
        effective: 4500,
        discount: { id: "d1", amount: 10, valueType: "percentage" },
      },
      pricing: {
        basePrice: 5000,
        effectivePrice: 4500,
        discount: { id: "d1", amount: 10, valueType: "percentage" },
      },
    });

    const listings = await buildMarketplaceListingSnapshot({
      businessId: "biz_1",
      refs: [{ productId: "product_1" }],
      occurredAt: "2026-03-04T09:01:00.000Z",
    });

    expect(listings).toHaveLength(1);
    expect(listings[0]).toEqual(
      expect.objectContaining({
        listingId: "product_1",
        listingType: "single",
        identity: expect.objectContaining({ deterministicId: "single:product_1" }),
        pricing: expect.objectContaining({
          basePrice: 5000,
          effectivePrice: 4500,
          discount: expect.any(Object),
        }),
      }),
    );
  });

  test("group variant discount change includes group listing with variant-level canonical pricing", async () => {
    Product.find
      .mockReturnValueOnce(buildLeanResult([
        {
          _id: "variant_1",
          productIsaGroup: true,
          itemGroup: "group_1",
          listProduct: true,
        },
      ]))
      .mockReturnValueOnce(buildSortedLeanResult([
        {
          _id: "variant_1",
          itemGroup: "group_1",
          productIsaGroup: true,
          listProduct: true,
        },
      ]));

    ProductGroup.find.mockReturnValue(
      buildLeanResult([
        {
          _id: "group_1",
          listGroup: true,
        },
      ]),
    );

    projectGroupListing.mockResolvedValue({
      listingId: "group_1",
      listingType: "group",
      identity: {
        deterministicId: "group:group_1",
        listingId: "group_1",
        groupId: "group_1",
        listingType: "group",
      },
      listed: true,
      updatedAt: "2026-03-04T10:00:00.000Z",
      stock: { totalVariants: 1, hasStock: true, state: "in_stock" },
      variants: [
        {
          variantId: "variant_1",
          listingId: "group_1",
          identity: {
            deterministicId: "group:group_1:variant:variant_1",
            listingId: "group_1",
            groupId: "group_1",
            variantId: "variant_1",
            listingType: "group_variant",
          },
          listed: true,
          stock: { quantity: 5, state: "in_stock" },
          price: {
            base: 1000,
            effective: 800,
            discount: { id: "d2", amount: 200, valueType: "amount" },
          },
          pricing: {
            basePrice: 1000,
            effectivePrice: 800,
            discount: { id: "d2", amount: 200, valueType: "amount" },
          },
        },
      ],
    });

    const listings = await buildMarketplaceListingSnapshot({
      businessId: "biz_1",
      refs: [{ productId: "variant_1" }],
    });

    expect(listings).toHaveLength(1);
    expect(listings[0]).toEqual(
      expect.objectContaining({
        listingId: "group_1",
        listingType: "group",
        identity: expect.objectContaining({ deterministicId: "group:group_1" }),
      }),
    );
    expect(listings[0].variants[0]).toEqual(
      expect.objectContaining({
        variantId: "variant_1",
        identity: expect.objectContaining({
          deterministicId: "group:group_1:variant:variant_1",
        }),
        pricing: expect.objectContaining({
          basePrice: 1000,
          effectivePrice: 800,
          discount: expect.any(Object),
        }),
      }),
    );
  });

  test("group variant stock updates propagate canonical out_of_stock state", async () => {
    Product.find
      .mockReturnValueOnce(buildLeanResult([
        {
          _id: "variant_2",
          productIsaGroup: true,
          itemGroup: "group_2",
          listProduct: true,
        },
      ]))
      .mockReturnValueOnce(buildSortedLeanResult([
        {
          _id: "variant_2",
          itemGroup: "group_2",
          productIsaGroup: true,
          listProduct: true,
        },
      ]));

    ProductGroup.find.mockReturnValue(
      buildLeanResult([
        {
          _id: "group_2",
          listGroup: true,
        },
      ]),
    );

    projectGroupListing.mockResolvedValue({
      listingId: "group_2",
      listingType: "group",
      identity: {
        deterministicId: "group:group_2",
        listingId: "group_2",
        groupId: "group_2",
        listingType: "group",
      },
      listed: true,
      updatedAt: "2026-03-05T10:00:00.000Z",
      stock: { totalVariants: 1, hasStock: false, state: "out_of_stock" },
      variants: [
        {
          variantId: "variant_2",
          listingId: "group_2",
          identity: {
            deterministicId: "group:group_2:variant:variant_2",
            listingId: "group_2",
            groupId: "group_2",
            variantId: "variant_2",
            listingType: "group_variant",
          },
          listed: true,
          stock: { quantity: 0, state: "out_of_stock" },
          price: {
            base: 1200,
            effective: 1200,
            discount: null,
          },
          pricing: {
            basePrice: 1200,
            effectivePrice: 1200,
            discount: null,
          },
        },
      ],
    });

    const listings = await buildMarketplaceListingSnapshot({
      businessId: "biz_1",
      refs: [{ productId: "variant_2" }],
    });

    expect(listings).toHaveLength(1);
    expect(listings[0]).toEqual(
      expect.objectContaining({
        listingId: "group_2",
        stock: expect.objectContaining({ state: "out_of_stock" }),
      }),
    );
    expect(listings[0].variants[0]).toEqual(
      expect.objectContaining({
        variantId: "variant_2",
        stock: expect.objectContaining({ quantity: 0, state: "out_of_stock" }),
      }),
    );
  });

  test("creates removed/de-listed fallback payload when referenced listing no longer exists", async () => {
    Product.find
      .mockReturnValueOnce(buildLeanResult([]))
      .mockReturnValueOnce(buildSortedLeanResult([]));

    ProductGroup.find.mockReturnValue(buildLeanResult([]));

    const listings = await buildMarketplaceListingSnapshot({
      businessId: "biz_1",
      refs: [{ groupId: "group_deleted_1" }, { productId: "product_deleted_1" }],
      occurredAt: "2026-03-05T11:00:00.000Z",
    });

    expect(listings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          listingId: "group_deleted_1",
          listingType: "group",
          removed: true,
          listed: false,
          updatedAt: "2026-03-05T11:00:00.000Z",
        }),
        expect.objectContaining({
          listingId: "product_deleted_1",
          listingType: "single",
          removed: true,
          listed: false,
          updatedAt: "2026-03-05T11:00:00.000Z",
        }),
      ]),
    );
  });
});
