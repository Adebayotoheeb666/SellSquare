jest.mock("../../models/productModel", () => ({
  findOne: jest.fn(),
}));

jest.mock("../../models/productGroupModel", () => ({
  findOne: jest.fn(),
}));

const Product = require("../../models/productModel");
const ProductGroup = require("../../models/productGroupModel");
const {
  resolveMarketplaceLineIdentity,
} = require("../../services/marketplace/marketplaceLineResolver");

const mockLean = (value) => ({
  lean: jest.fn().mockResolvedValue(value),
  select: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(value),
  }),
});

describe("marketplace line resolver", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("resolves listingId + variantId for listed group variant", async () => {
    ProductGroup.findOne.mockImplementationOnce(() => mockLean({ _id: "group_1" }));
    Product.findOne.mockImplementationOnce(() => mockLean({
      _id: "variant_1",
      business: "biz_1",
      itemGroup: "group_1",
      productIsaGroup: true,
      listProduct: true,
      name: "Variant A",
    }));

    const result = await resolveMarketplaceLineIdentity({
      businessId: "biz_1",
      lineInput: {
        listingId: "group_1",
        variantId: "variant_1",
        quantity: 2,
      },
    });

    expect(result.canonicalListingId).toBe("group_1");
    expect(result.canonicalVariantId).toBe("variant_1");
    expect(result.isGroupVariant).toBe(true);
    expect(result.resolvedGroupId).toBe("group_1");
  });

  test("rejects when variant does not belong to listing group", async () => {
    ProductGroup.findOne.mockImplementationOnce(() => mockLean({ _id: "group_1" }));
    Product.findOne.mockImplementationOnce(() => mockLean(null));

    await expect(
      resolveMarketplaceLineIdentity({
        businessId: "biz_1",
        lineInput: {
          listingId: "group_1",
          variantId: "variant_other",
          quantity: 1,
        },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "LISTING_VARIANT_MISMATCH",
    });
  });

  test("resolves legacy productId format unchanged", async () => {
    Product.findOne.mockImplementationOnce(() => mockLean({
      _id: "product_legacy",
      business: "biz_1",
      itemGroup: null,
      productIsaGroup: false,
      listProduct: true,
      name: "Legacy Product",
    }));

    const result = await resolveMarketplaceLineIdentity({
      businessId: "biz_1",
      lineInput: {
        productId: "product_legacy",
        quantity: 1,
      },
    });

    expect(result.resolvedProduct._id).toBe("product_legacy");
    expect(result.canonicalListingId).toBe("product_legacy");
    expect(result.canonicalVariantId).toBe("product_legacy");
    expect(result.isGroupVariant).toBe(false);
  });
});
