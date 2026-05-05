const Product = require("../../models/productModel");
const ProductGroup = require("../../models/productGroupModel");
const Discount = require("../../models/discountModel");
const {
  listPublicListings,
} = require("../../controllers/publicMarketplaceListingController");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const buildFindChain = (result) => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  };
  return chain;
};

const buildListingsEntries = (singleIds = [], groupIds = []) => [
  ...singleIds.map((id, index) => ({
    _id: id,
    listingType: "single",
    updatedAt: new Date(Date.now() - index * 1000),
  })),
  ...groupIds.map((id, index) => ({
    _id: id,
    listingType: "group",
    updatedAt: new Date(Date.now() - (singleIds.length + index) * 1000),
  })),
];

describe("marketplace listings integration", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("returns listing-enabled products and groups with stock status", async () => {
    const singleProducts = [
      {
        _id: "p1",
        name: "Single Product",
        quantity: 0,
        price: 100,
        sku: "SKU-1",
        listProduct: true,
        image: [],
      },
    ];
    const groups = [
      {
        _id: "g1",
        groupName: "Group One",
        hasUniqueVariants: true,
        listingEnabled: true,
        image: [],
      },
    ];
    const groupVariants = [
      {
        _id: "v1",
        name: "Variant",
        itemGroup: "g1",
        quantity: 3,
        price: 40,
        sku: "VSKU-1",
        image: [],
      },
    ];

    jest
      .spyOn(Product, "aggregate")
      .mockResolvedValueOnce(buildListingsEntries(["p1"], ["g1"]));

    jest.spyOn(Product, "find").mockImplementation((query = {}) => {
      if (query?.itemGroup) {
        return buildFindChain(groupVariants);
      }
      return buildFindChain(singleProducts);
    });

    jest.spyOn(ProductGroup, "find").mockImplementation(() => buildFindChain(groups));

    const discountFindSpy = jest
      .spyOn(Discount, "find")
      .mockImplementation(() => buildFindChain([]));

    const req = { business: { _id: "b1" }, query: {} };
    const res = createRes();

    await listPublicListings(req, res, () => {});

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(Array.isArray(payload.listings)).toBe(true);
    expect(payload.listings.length).toBeGreaterThan(0);
    expect(payload.listings.some((item) => item.stock && item.stock.state)).toBe(true);
    expect(discountFindSpy).toHaveBeenCalledTimes(1);
  });

  test("keeps group listed when variant is sold out and does not duplicate variant as top-level listing", async () => {
    const singleProducts = [];
    const groups = [
      {
        _id: "group_soldout",
        groupName: "Sold Out Group",
        listGroup: true,
        image: [],
      },
    ];
    const groupVariants = [
      {
        _id: "variant_soldout",
        name: "Sold Out Variant",
        itemGroup: "group_soldout",
        quantity: 0,
        price: 20,
        sku: "SOLD-1",
        image: [],
      },
    ];

    jest
      .spyOn(Product, "aggregate")
      .mockResolvedValueOnce(buildListingsEntries([], ["group_soldout"]));

    jest.spyOn(Product, "find").mockImplementation((query = {}) => {
      if (query?.itemGroup) {
        return buildFindChain(groupVariants);
      }
      return buildFindChain(singleProducts);
    });

    jest.spyOn(ProductGroup, "find").mockImplementation(() => buildFindChain(groups));

    jest.spyOn(Discount, "find").mockImplementation(() => buildFindChain([]));

    const req = { business: { _id: "b1" }, query: {} };
    const res = createRes();

    await listPublicListings(req, res, () => {});

    const payload = res.json.mock.calls[0][0];
    expect(payload.total).toBe(1);
    expect(payload.listings).toHaveLength(1);
    expect(payload.listings[0]).toMatchObject({
      listingType: "group",
      groupId: "group_soldout",
    });
    expect(payload.listings[0].variants).toHaveLength(1);
    expect(payload.listings[0].variants[0].stock.state).toBe("out_of_stock");
  });

  test("maintains discount correctness with batched active discounts", async () => {
    const singleProducts = [
      {
        _id: "p1",
        name: "Single Product",
        quantity: 5,
        price: 100,
        sku: "SKU-1",
        category: "General",
        listProduct: true,
        image: [],
        images: [],
      },
    ];

    const groups = [
      {
        _id: "g1",
        groupName: "Group One",
        category: "Wearables",
        description: "",
        listGroup: true,
        listingOptions: [],
        image: [],
        images: [],
      },
    ];

    const groupVariants = [
      {
        _id: "v1",
        name: "Variant 1",
        itemGroup: "g1",
        quantity: 2,
        price: 80,
        sku: "VSKU-1",
        listProduct: true,
        image: [],
        images: [],
      },
    ];

    jest
      .spyOn(Product, "aggregate")
      .mockResolvedValueOnce(buildListingsEntries(["p1"], ["g1"]));

    jest
      .spyOn(Product, "find")
      .mockImplementationOnce(() => buildFindChain(singleProducts))
      .mockImplementationOnce(() => buildFindChain(groupVariants));

    jest.spyOn(ProductGroup, "find").mockImplementation(() => buildFindChain(groups));

    const discountFindSpy = jest.spyOn(Discount, "find").mockImplementation(() =>
      buildFindChain([
        {
          _id: "d-selected-variant",
          discountName: "Variant 25%",
          discountAmount: 25,
          discountValueType: "percentage",
          startDate: new Date("2025-01-01T00:00:00.000Z"),
          expirationDate: new Date("2030-01-01T00:00:00.000Z"),
          groupSelection: "selected_items",
          appliedProducts: [],
          appliedProductGroups: ["g1"],
          appliedGroupItems: ["v1"],
          isActive: true,
          status: "active",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
        },
        {
          _id: "d-single",
          discountName: "Single 10%",
          discountAmount: 10,
          discountValueType: "percentage",
          startDate: new Date("2025-01-01T00:00:00.000Z"),
          expirationDate: new Date("2030-01-01T00:00:00.000Z"),
          groupSelection: "all_items",
          appliedProducts: ["p1"],
          appliedProductGroups: [],
          appliedGroupItems: [],
          isActive: true,
          status: "active",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]),
    );

    const req = { business: { _id: "b1" }, query: {} };
    const res = createRes();

    await listPublicListings(req, res, () => {});

    const payload = res.json.mock.calls[0][0];
    const single = payload.listings.find((item) => item.listingType === "single");
    const group = payload.listings.find((item) => item.listingType === "group");

    expect(single.price.effective).toBe(90);
    expect(single.price.discount.id).toBe("d-single");
    expect(group.variants[0].price.effective).toBe(60);
    expect(group.variants[0].price.discount.id).toBe("d-selected-variant");
    expect(discountFindSpy).toHaveBeenCalledTimes(1);
  });

  test("supports backward-compatible cursor pagination with stable ordering", async () => {
    const singleProducts = [
      { _id: "p1", name: "P1", quantity: 1, price: 10, sku: "1", category: "A", listProduct: true },
      { _id: "p2", name: "P2", quantity: 1, price: 20, sku: "2", category: "A", listProduct: true },
      { _id: "p3", name: "P3", quantity: 1, price: 30, sku: "3", category: "A", listProduct: true },
    ];
    const groups = [
      { _id: "g1", groupName: "G1", category: "B", listGroup: true, listingOptions: [] },
      { _id: "g2", groupName: "G2", category: "B", listGroup: true, listingOptions: [] },
    ];
    const groupVariants = [];

    jest
      .spyOn(Product, "aggregate")
      .mockResolvedValueOnce([
        {
          meta: [{ total: 5 }],
          page: buildListingsEntries(["p1", "p2"], []),
        },
      ])
      .mockResolvedValueOnce([
        {
          meta: [{ total: 5 }],
          page: buildListingsEntries(["p3"], ["g1"]),
        },
      ]);

    jest.spyOn(Product, "find").mockImplementation((query = {}) => {
      if (query?.itemGroup) {
        return buildFindChain(groupVariants);
      }

      const ids = Array.isArray(query?._id?.$in) ? query._id.$in : [];
      if (ids.length > 0) {
        const filtered = singleProducts.filter((item) => ids.includes(item._id));
        return buildFindChain(filtered);
      }

      return buildFindChain(singleProducts);
    });

    jest
      .spyOn(ProductGroup, "find")
      .mockImplementationOnce(() => buildFindChain(groups))
      .mockImplementationOnce(() => buildFindChain(groups));

    jest.spyOn(Discount, "find").mockImplementation(() => buildFindChain([]));

    const reqFirst = { business: { _id: "b1" }, query: { limit: "2" } };
    const resFirst = createRes();
    await listPublicListings(reqFirst, resFirst, () => {});

    const firstPayload = resFirst.json.mock.calls[0][0];
    expect(firstPayload.total).toBe(5);
    expect(firstPayload.listings).toHaveLength(2);
    expect(firstPayload.pagination.hasMore).toBe(true);
    expect(firstPayload.pagination.nextCursor).toBeTruthy();

    const reqSecond = {
      business: { _id: "b1" },
      query: { limit: "2", cursor: firstPayload.pagination.nextCursor },
    };
    const resSecond = createRes();
    await listPublicListings(reqSecond, resSecond, () => {});

    const secondPayload = resSecond.json.mock.calls[0][0];
    expect(secondPayload.listings).toHaveLength(2);

    const firstIds = firstPayload.listings.map((item) => item.listingId);
    const secondIds = secondPayload.listings.map((item) => item.listingId);
    expect(secondIds.some((id) => firstIds.includes(id))).toBe(false);
  });

  test("keeps fixed query count profile for larger listing sets", async () => {
    const singleProducts = Array.from({ length: 200 }, (_, index) => ({
      _id: `p-${index + 1}`,
      name: `P-${index + 1}`,
      quantity: 1,
      price: 100,
      sku: `SKU-${index + 1}`,
      category: "Bulk",
      listProduct: true,
    }));

    const groups = [
      { _id: "g-bulk", groupName: "Bulk Group", category: "Bulk", listGroup: true, listingOptions: [] },
    ];

    const groupVariants = Array.from({ length: 120 }, (_, index) => ({
      _id: `v-${index + 1}`,
      itemGroup: "g-bulk",
      name: `V-${index + 1}`,
      quantity: 1,
      price: 70,
      sku: `VSKU-${index + 1}`,
      listProduct: true,
    }));

    const aggregateSpy = jest
      .spyOn(Product, "aggregate")
      .mockResolvedValueOnce(buildListingsEntries(singleProducts.map((item) => item._id), ["g-bulk"]));

    const productFindSpy = jest
      .spyOn(Product, "find")
      .mockImplementationOnce(() => buildFindChain(singleProducts))
      .mockImplementationOnce(() => buildFindChain(groupVariants));

    const groupFindSpy = jest
      .spyOn(ProductGroup, "find")
      .mockImplementationOnce(() => buildFindChain(groups));

    const discountFindSpy = jest
      .spyOn(Discount, "find")
      .mockImplementationOnce(() => buildFindChain([]));

    const req = { business: { _id: "b1" }, query: {} };
    const res = createRes();
    await listPublicListings(req, res, () => {});

    expect(aggregateSpy).toHaveBeenCalledTimes(1);
    expect(productFindSpy).toHaveBeenCalledTimes(2);
    expect(groupFindSpy).toHaveBeenCalledTimes(1);
    expect(discountFindSpy).toHaveBeenCalledTimes(1);
  });
});
