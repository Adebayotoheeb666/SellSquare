import productReducer, {
  forceClearProductLoading,
} from "../redux/features/product/productSlice";
import cartReducer, {
  forceClearCartLoading,
} from "../redux/features/cart/cartSlice";
import bulkDataCacheReducer, {
  forceClearBulkLoading,
} from "../redux/features/dataCache/bulkDataCacheSlice";
import {
  hasCompletedBulkDataset,
  hasCompletedProductDataset,
} from "../customHook/useDataBootstrap";

describe("bootstrap loading recovery", () => {
  test("clears stuck product loading state", () => {
    const nextState = productReducer(
      {
        ...productReducer(undefined, { type: "@@INIT" }),
        isLoading: true,
        isError: false,
        message: "",
      },
      forceClearProductLoading({ error: "dashboard stats bootstrap timed out" }),
    );

    expect(nextState.isLoading).toBe(false);
    expect(nextState.isError).toBe(true);
    expect(nextState.message).toBe("dashboard stats bootstrap timed out");
  });

  test("clears stuck cart loading state", () => {
    const nextState = cartReducer(
      {
        ...cartReducer(undefined, { type: "@@INIT" }),
        isCartLoading: true,
        isError: false,
        message: "",
      },
      forceClearCartLoading({ error: "cart bootstrap timed out" }),
    );

    expect(nextState.isCartLoading).toBe(false);
    expect(nextState.isError).toBe(true);
    expect(nextState.message).toBe("cart bootstrap timed out");
  });

  test("clears year-aware and nested bulk loading states", () => {
    const initialState = bulkDataCacheReducer(undefined, { type: "@@INIT" });
    const stateWithLoading = {
      ...initialState,
      sales: {
        ...initialState.sales,
        meta: {
          ...initialState.sales.meta,
          isLoading: true,
        },
        yearBuckets: {
          "2026": {
            ...initialState.sales,
            meta: {
              ...initialState.sales.meta,
              isLoading: true,
            },
          },
        },
      },
      outOfStock: {
        products: {
          ...initialState.outOfStock.products,
          meta: {
            ...initialState.outOfStock.products.meta,
            isLoading: true,
          },
        },
        productGroups: {
          ...initialState.outOfStock.productGroups,
          meta: {
            ...initialState.outOfStock.productGroups.meta,
            isLoading: true,
          },
        },
      },
    };

    const salesRecovered = bulkDataCacheReducer(
      stateWithLoading,
      forceClearBulkLoading({
        dataType: "sales",
        year: 2026,
        error: "sales background bootstrap timed out",
      }),
    );

    expect(salesRecovered.sales.meta.isLoading).toBe(false);
    expect(salesRecovered.sales.yearBuckets["2026"].meta.isLoading).toBe(false);
    expect(salesRecovered.sales.meta.error).toBe(
      "sales background bootstrap timed out",
    );

    const outOfStockRecovered = bulkDataCacheReducer(
      salesRecovered,
      forceClearBulkLoading({
        dataType: "outOfStock",
        error: "out-of-stock background bootstrap timed out",
      }),
    );

    expect(outOfStockRecovered.outOfStock.products.meta.isLoading).toBe(false);
    expect(
      outOfStockRecovered.outOfStock.productGroups.meta.isLoading,
    ).toBe(false);
    expect(outOfStockRecovered.outOfStock.products.meta.error).toBe(
      "out-of-stock background bootstrap timed out",
    );
  });

  test("treats empty but completed bulk datasets as already recovered", () => {
    expect(
      hasCompletedBulkDataset({
        loaded: 0,
        isComplete: true,
        lastFetchedAt: Date.now(),
      }),
    ).toBe(true);

    expect(
      hasCompletedBulkDataset({
        loaded: 0,
        isComplete: false,
        lastFetchedAt: null,
      }),
    ).toBe(false);
  });

  test("treats empty but completed product datasets as already recovered", () => {
    expect(
      hasCompletedProductDataset({
        loadedProducts: 0,
        isComplete: true,
        lastFullFetchAt: Date.now(),
      }),
    ).toBe(true);

    expect(
      hasCompletedProductDataset({
        loadedProducts: 0,
        isComplete: false,
        lastFullFetchAt: null,
      }),
    ).toBe(false);
  });
});
