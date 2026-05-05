import { configureStore } from "@reduxjs/toolkit";
import authReducer, {
  SET_USER,
} from "../redux/features/auth/authSlice";
import realtimeReducer, {
  EventTypes,
  handleRealtimeEvent,
} from "../redux/features/realtime/realtimeSlice";

describe("Realtime auth event handling", () => {
  const createTestStore = () =>
    configureStore({
      reducer: {
        auth: authReducer,
        realtime: realtimeReducer,
      },
    });

  beforeEach(() => {
    localStorage.clear();
  });

  test("permissions_updated event updates current user permissions", () => {
    const store = createTestStore();

    store.dispatch(
      SET_USER({
        name: "Alice",
        email: "alice@example.com",
        permissions: { sellProducts: false },
      }),
    );

    store.dispatch(
      handleRealtimeEvent({
        id: "evt_perm_1",
        type: EventTypes.PERMISSIONS_UPDATED,
        data: {
          permissions: { sellProducts: true, manageUsers: true },
        },
        metadata: {},
      }),
    );

    const { auth } = store.getState();
    expect(auth.user.permissions).toEqual({
      sellProducts: true,
      manageUsers: true,
    });
  });

  test("account_suspended event marks user suspended with reason", () => {
    const store = createTestStore();

    store.dispatch(
      SET_USER({
        name: "Bob",
        email: "bob@example.com",
        permissions: { sellProducts: true },
      }),
    );

    store.dispatch(
      handleRealtimeEvent({
        id: "evt_suspend_1",
        type: EventTypes.ACCOUNT_SUSPENDED,
        data: {
          reason: "payment_overdue",
        },
        metadata: {},
      }),
    );

    const { auth } = store.getState();
    expect(auth.user.suspended).toBe(true);
    expect(auth.user.suspensionReason).toBe("payment_overdue");
  });
});
