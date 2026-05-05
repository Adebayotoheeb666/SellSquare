import { configureStore } from "@reduxjs/toolkit";
import authReducer, {
  SET_LOGIN,
  SET_USER,
  SET_BUSINESS,
} from "../redux/features/auth/authSlice";
import cartReducer, {
} from "../redux/features/cart/cartSlice";
import dataCacheReducer, {
  startSession,
  completeBootstrap,
  setFetched,
  BOOTSTRAP_DATA,
} from "../redux/features/dataCache/dataCacheSlice";
import bulkDataCacheReducer, {
  addBulkCacheItem,
} from "../redux/features/dataCache/bulkDataCacheSlice";
import filterReducer, {
  FILTER_PRODUCTS,
} from "../redux/features/product/filterSlice";
import productCacheReducer from "../redux/features/product/productCacheSlice";
import { resetSessionState } from "../redux/sessionReset";

describe("Logout session hygiene", () => {
  const createStore = () =>
    configureStore({
      reducer: {
        auth: authReducer,
        cart: cartReducer,
        dataCache: dataCacheReducer,
        bulkDataCache: bulkDataCacheReducer,
        filter: filterReducer,
        productCache: productCacheReducer,
      },
    });

  beforeEach(() => {
    localStorage.clear();
  });

  test("logout reset sequence clears auth, cart, cache, bulk cache, filters, and persisted keys", async () => {
    const store = createStore();

    // Seed auth state
    store.dispatch(SET_LOGIN(true));
    store.dispatch(
      SET_USER({
        name: "Alice",
        email: "alice@example.com",
        businessOwnerLoggedIn: true,
      }),
    );
    store.dispatch(
      SET_BUSINESS({
        _id: "biz_1",
        businessName: "Test Biz",
        businessAddress: "Address",
      }),
    );

    // Seed cart state via realtime handler action shape
    store.dispatch({
      type: "cart/handleRealtimeUpdate",
      payload: {
        eventType: "cart.updated",
        data: {
          _id: "cart_1",
          user: { email: "alice@example.com" },
          items: [{ _id: "item_1", quantity: 2, price: 100 }],
        },
      },
    });

    // Seed data cache state
    store.dispatch(startSession("session_1"));
    store.dispatch(completeBootstrap());
    store.dispatch(setFetched({ dataKey: BOOTSTRAP_DATA.CART }));

    // Seed bulk cache state
    store.dispatch(
      addBulkCacheItem({
        dataType: "sales",
        item: { _id: "sale_1", totalOrderCost: 200 },
      }),
    );

    // Seed filter state
    store.dispatch(
      FILTER_PRODUCTS({
        products: [{ name: "Soap", category: "Body", sku: "SOAP-1" }],
        search: "soap",
        filters: { category: [], warehouse: [], priceRange: [] },
      }),
    );

    // Sanity check seeded state is populated
    let state = store.getState();
    expect(state.auth.isLoggedIn).toBe(true);
    expect(state.cart.cart?._id).toBe("cart_1");
    expect(state.dataCache.isBootstrapped).toBe(true);
    expect(state.bulkDataCache.sales.allIds).toContain("sale_1");
    expect(state.filter.filteredProducts.length).toBe(1);

    localStorage.setItem("persist:sellsquare-cache:biz:user:dataCache", "{}");

    await resetSessionState(store.dispatch);

    state = store.getState();

    // Auth cleared
    expect(state.auth.isLoggedIn).toBe(false);
    expect(state.auth.user.email).toBe("");

    // Cart cleared
    expect(state.cart.cart).toEqual({});
    expect(state.cart.checkouts).toEqual([]);

    // Session/data cache cleared
    expect(state.dataCache.isBootstrapped).toBe(false);
    expect(state.dataCache.sessionId).toBeNull();
    expect(state.dataCache.cache[BOOTSTRAP_DATA.CART].isFetched).toBe(false);

    // Bulk cache cleared
    expect(state.bulkDataCache.sales.allIds).toEqual([]);
    expect(state.bulkDataCache.sales.byId).toEqual({});

    // Filters cleared
    expect(state.filter.filteredProducts).toEqual([]);

    // Persisted cache purged
    expect(localStorage.getItem("persist:sellsquare-cache:biz:user:dataCache")).toBeNull();
  });
});
