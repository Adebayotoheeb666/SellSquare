import { configureStore } from "@reduxjs/toolkit";
import cartReducer from "../redux/features/cart/cartSlice";
import realtimeReducer, {
  EventTypes,
  handleRealtimeEvent,
} from "../redux/features/realtime/realtimeSlice";

describe("Realtime cart idempotency", () => {
  const createStore = () =>
    configureStore({
      reducer: {
        cart: cartReducer,
        realtime: realtimeReducer,
      },
    });

  beforeEach(() => {
    localStorage.clear();
  });

  test("ignores duplicate cart event IDs and applies new IDs", () => {
    const store = createStore();

    const firstPayload = {
      id: "evt_cart_1",
      type: EventTypes.CART_UPDATED,
      data: {
        _id: "cart_1",
        user: { email: "alice@example.com" },
        items: [{ _id: "item_1", quantity: 1, price: 100 }],
      },
      metadata: {},
    };

    store.dispatch(handleRealtimeEvent(firstPayload));

    let state = store.getState();
    expect(state.cart.cart.items[0].quantity).toBe(1);
    expect(state.realtime.processedEventIds).toEqual(["evt_cart_1"]);

    // Same event ID should be ignored even if payload differs
    store.dispatch(
      handleRealtimeEvent({
        ...firstPayload,
        data: {
          ...firstPayload.data,
          items: [{ _id: "item_1", quantity: 999, price: 100 }],
        },
      }),
    );

    state = store.getState();
    expect(state.cart.cart.items[0].quantity).toBe(1);
    expect(state.realtime.processedEventIds).toEqual(["evt_cart_1"]);

    // New event ID should apply
    store.dispatch(
      handleRealtimeEvent({
        id: "evt_cart_2",
        type: EventTypes.CART_UPDATED,
        data: {
          _id: "cart_1",
          user: { email: "alice@example.com" },
          items: [{ _id: "item_1", quantity: 3, price: 100 }],
        },
        metadata: {},
      }),
    );

    state = store.getState();
    expect(state.cart.cart.items[0].quantity).toBe(3);
    expect(state.realtime.processedEventIds).toEqual([
      "evt_cart_1",
      "evt_cart_2",
    ]);
  });
});
