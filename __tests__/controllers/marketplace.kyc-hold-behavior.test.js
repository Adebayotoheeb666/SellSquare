jest.mock("../../models/productModel", () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock("../../models/inventoryHoldModel", () => ({
  find: jest.fn(),
  updateMany: jest.fn(),
}));

jest.mock("../../models/businessKycModel", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));

const Product = require("../../models/productModel");
const InventoryHold = require("../../models/inventoryHoldModel");
const BusinessKyc = require("../../models/businessKycModel");
const {
  getListings,
  getCartHolds,
} = require("../../controllers/buyerMarketplaceController");
const { mockRequest, mockResponse } = require("../helpers/testHelpers");

describe("Marketplace KYC gating and hold expiry behavior", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("getListings returns only KYC-approved business products", async () => {
    BusinessKyc.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { business: "biz_approved_1" },
          { business: "biz_approved_2" },
        ]),
      }),
    });

    Product.countDocuments.mockResolvedValue(2);
    Product.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              sort: jest.fn().mockResolvedValue([
                {
                  _id: "prod_1",
                  name: "Approved Product",
                  price: 1000,
                  image: "img",
                  category: "cat",
                  rating: 4.5,
                  reviews: 10,
                  quantity: 8,
                  activeMarketplaceHoldQty: 3,
                  business: { _id: "biz_approved_1", businessName: "Approved Biz" },
                },
                {
                  _id: "prod_2",
                  name: "Out of Stock but Listed",
                  price: 500,
                  image: "img2",
                  category: "cat",
                  rating: 0,
                  reviews: 0,
                  quantity: 0,
                  activeMarketplaceHoldQty: 0,
                  business: { _id: "biz_approved_2", businessName: "Approved Biz 2" },
                },
              ]),
            }),
          }),
        }),
      }),
    });

    const req = mockRequest({}, {}, { page: "1", limit: "20" });
    const res = mockResponse();

    await getListings(req, res);

    expect(BusinessKyc.find).toHaveBeenCalledWith({ status: "approved" });
    expect(Product.find).toHaveBeenCalledWith(
      expect.objectContaining({
        business: { $in: ["biz_approved_1", "biz_approved_2"] },
        listProduct: true,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.data).toHaveLength(2);
    expect(payload.data[0]).toEqual(
      expect.objectContaining({
        businessId: "biz_approved_1",
        availableQty: 5,
      }),
    );
    expect(payload.data[1]).toEqual(
      expect.objectContaining({
        businessId: "biz_approved_2",
        availableQty: 0,
      }),
    );
  });

  test("getCartHolds expires stale holds and returns only active holds", async () => {
    const now = Date.now();
    const expiredHold = {
      _id: "hold_expired",
      product: "prod_1",
      quantity: 2,
    };
    const activeHold = {
      _id: "hold_active",
      product: {
        _id: "prod_2",
        name: "Active Product",
        price: 2000,
        image: "img",
        business: { businessName: "Active Biz" },
      },
      quantity: 1,
      expiresAt: new Date(now + 2 * 60 * 1000),
    };

    InventoryHold.find
      .mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue([expiredHold]),
      })
      .mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([activeHold]),
        }),
      });

    Product.findByIdAndUpdate.mockResolvedValue(true);
    InventoryHold.updateMany.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });

    const req = mockRequest();
    req.buyer = { _id: "buyer_1" };
    const res = mockResponse();

    await getCartHolds(req, res);

    expect(Product.findByIdAndUpdate).toHaveBeenCalledWith("prod_1", {
      $inc: { activeMarketplaceHoldQty: -2 },
    });
    expect(InventoryHold.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ["hold_expired"] } },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "expired",
          releaseReason: "hold_timeout",
        }),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]).toEqual(
      expect.objectContaining({
        holdId: "hold_active",
        productName: "Active Product",
        businessName: "Active Biz",
        isExpired: false,
      }),
    );
  });
});
