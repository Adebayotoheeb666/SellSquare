import cartService from "../redux/features/cart/cartService";
import activitiesService from "../redux/features/activities/activityService";
import {
  fetchBulkSales,
  fetchBulkActivities,
} from "../redux/features/dataCache/bulkDataCacheSlice";

jest.mock("../redux/features/cart/cartService", () => ({
  __esModule: true,
  default: {
    getCheckouts: jest.fn(),
  },
}));

jest.mock("../redux/features/activities/activityService", () => ({
  __esModule: true,
  default: {
    getAllActivities: jest.fn(),
  },
}));

describe("bulkDataCache/fetchBulkSales", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("loads complete sales dataset via paged backfill loop", async () => {
    cartService.getCheckouts.mockResolvedValueOnce({
      checkouts: [{ _id: "sale_1", orderId: "ORD-1" }],
      total: 2,
      currentPage: 1,
      hasMore: true,
      aggregatedStats: { totalSales: 1000 },
    });

    cartService.getCheckouts.mockResolvedValueOnce({
      checkouts: [{ _id: "sale_2", orderId: "ORD-2" }],
      total: 2,
      currentPage: 2,
      hasMore: false,
    });

    const dispatch = jest.fn();
    const getState = () => ({
      bulkDataCache: {
        sales: {
            meta: { isComplete: false, isLoading: false, resumePage: 1 },
        },
        cacheValidUntil: {},
      },
    });

    await fetchBulkSales({ force: true })(dispatch, getState, undefined);

    expect(cartService.getCheckouts).toHaveBeenCalledTimes(2);

    const fulfilledAction = dispatch.mock.calls
      .map(([action]) => action)
      .find((action) => action.type === "bulkDataCache/fetchBulkSales/fulfilled");

    expect(fulfilledAction).toBeDefined();
    expect(fulfilledAction.payload.items).toHaveLength(2);
    expect(fulfilledAction.payload.items.map((item) => item._id)).toEqual([
      "sale_1",
      "sale_2",
    ]);
    expect(fulfilledAction.payload.aggregatedStats).toEqual({ totalSales: 1000 });
    expect(fulfilledAction.payload.isComplete).toBe(true);
    expect(fulfilledAction.payload.resumePage).toBe(1);
  });
});

describe("bulkDataCache/fetchBulkActivities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("loads a single page per run and keeps resume metadata when more exists", async () => {
    activitiesService.getAllActivities.mockResolvedValueOnce({
      activities: [{ _id: "act_1", activity: "Created product" }],
      pagination: {
        currentPage: 1,
        totalCount: 2000,
        hasMore: true,
      },
    });

    const dispatch = jest.fn();
    const getState = () => ({
      bulkDataCache: {
        activities: {
          meta: { isComplete: false, isLoading: false, resumePage: 1 },
        },
        cacheValidUntil: {},
      },
    });

    await fetchBulkActivities({ force: true })(dispatch, getState, undefined);

    expect(activitiesService.getAllActivities).toHaveBeenCalledTimes(1);
    expect(activitiesService.getAllActivities).toHaveBeenCalledWith(1, 1000);

    const fulfilledAction = dispatch.mock.calls
      .map(([action]) => action)
      .find((action) => action.type === "bulkDataCache/fetchBulkActivities/fulfilled");

    expect(fulfilledAction).toBeDefined();
    expect(fulfilledAction.payload.items).toHaveLength(1);
    expect(fulfilledAction.payload.isComplete).toBe(false);
    expect(fulfilledAction.payload.resumePage).toBe(2);
  });
});
