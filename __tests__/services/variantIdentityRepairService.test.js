jest.mock("../../models/productModel", () => ({
  find: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock("../../models/productGroupModel", () => ({
  find: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock("../../models/discountModel", () => ({
  find: jest.fn(),
}));

jest.mock("../../models/migrationStateModel", () => ({
  findOne: jest.fn(),
  updateOne: jest.fn(),
}));

const Product = require("../../models/productModel");
const ProductGroup = require("../../models/productGroupModel");
const Discount = require("../../models/discountModel");
const {
  runVariantBackfillForBusiness,
  runDiscountRepairForBusiness,
} = require("../../services/variantIdentityRepairService");

describe("variantIdentityRepairService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("backfills missing variant keys and updates group variantMap", async () => {
    ProductGroup.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: "group_1",
            combinations: ["Red / S", "Blue / M"],
            variantMap: [],
          },
        ]),
      }),
    });

    Product.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: "variant_1",
            name: "Red / S",
            sku: "RS-1",
            variantKey: "",
            variantLabel: "",
          },
          {
            _id: "variant_2",
            name: "Blue / M",
            sku: "BM-1",
            variantKey: "existing-key",
            variantLabel: "Old label",
          },
        ]),
      }),
    });

    Product.updateOne.mockResolvedValue({ acknowledged: true });
    ProductGroup.updateOne.mockResolvedValue({ acknowledged: true });

    const metrics = await runVariantBackfillForBusiness("business_1");

    expect(metrics.groupsScanned).toBe(1);
    expect(metrics.variantsScanned).toBe(2);
    expect(metrics.variantKeysBackfilled).toBeGreaterThanOrEqual(1);
    expect(metrics.groupVariantMapsUpdated).toBe(1);
    expect(Product.updateOne).toHaveBeenCalled();
    expect(ProductGroup.updateOne).toHaveBeenCalledWith(
      { _id: "group_1" },
      expect.objectContaining({
        $set: expect.objectContaining({
          variantMap: expect.any(Array),
        }),
      }),
    );
  });

  test("detaches invalid discount references and drafts emptied discounts", async () => {
    Product.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ _id: "valid_product" }]),
      }),
    });

    ProductGroup.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ _id: "valid_group" }]),
      }),
    });

    const discountDoc = {
      appliedProducts: ["missing_product"],
      appliedGroupItems: ["missing_group_item"],
      appliedProductGroups: ["missing_group"],
      groupSelection: "selected_items",
      status: "active",
      isActive: true,
      save: jest.fn().mockResolvedValue(true),
    };

    Discount.find.mockResolvedValue([discountDoc]);

    const metrics = await runDiscountRepairForBusiness("business_1");

    expect(metrics.discountsScanned).toBe(1);
    expect(metrics.detachedAppliedProducts).toBe(1);
    expect(metrics.detachedAppliedGroupItems).toBe(1);
    expect(metrics.detachedAppliedProductGroups).toBe(1);
    expect(metrics.discountsUpdated).toBe(1);
    expect(metrics.discountsDrafted).toBe(1);
    expect(discountDoc.status).toBe("draft");
    expect(discountDoc.isActive).toBe(false);
    expect(discountDoc.save).toHaveBeenCalledTimes(1);
  });
});
