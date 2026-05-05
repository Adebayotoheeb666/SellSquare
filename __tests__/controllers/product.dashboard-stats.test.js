const Product = require("../../models/productModel");
const ProductGroup = require("../../models/productGroupModel");
const Expense = require("../../models/expenseModel");
const { getDashboardStats } = require("../../controllers/productController");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("getDashboardStats", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("uses aggregation pipelines and returns computed totals", async () => {
    jest.spyOn(Product, "aggregate").mockResolvedValueOnce([
      {
        summary: [
          {
            totalProducts: 10,
            outOfStockSingleProducts: 2,
            totalStoreValueByPrice: 1000,
            totalStoreValueByCost: 700,
          },
        ],
        categories: [{ totalCategories: 3 }],
      },
    ]);

    jest.spyOn(ProductGroup, "aggregate").mockResolvedValueOnce([
      {
        totalProductGroups: 4,
        outOfStockGroupProducts: 1,
      },
    ]);

    jest.spyOn(Expense, "aggregate").mockResolvedValueOnce([{ total: 250 }]);

    const findSpy = jest.spyOn(Product, "find");
    const req = { business: { id: "65f1b5f31f7a2f0012a34567" } };
    const res = createRes();

    await getDashboardStats(req, res, () => {});

    expect(findSpy).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      totalProducts: 10,
      totalCategories: 3,
      outOfStock: {
        singleProducts: 2,
        groupProducts: 1,
        total: 3,
      },
      storeValue: {
        byPrice: 1000,
        byCost: 700,
      },
      totalExpenses: 250,
    });
  });
});
