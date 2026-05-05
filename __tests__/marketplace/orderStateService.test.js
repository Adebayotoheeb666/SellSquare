const {
  canTransitionOrderStatus,
  assertValidOrderTransition,
  normalizeLineDecision,
} = require("../../services/marketplace/orderStateService");

describe("orderStateService", () => {
  test("allows valid transition path", () => {
    expect(
      canTransitionOrderStatus({ from: "payment_confirmed", to: "accepted" }),
    ).toBe(true);
  });

  test("rejects invalid transition path", () => {
    expect(
      canTransitionOrderStatus({ from: "placed", to: "shipped" }),
    ).toBe(false);
  });

  test("throws on invalid transition assertion", () => {
    expect(() =>
      assertValidOrderTransition({ from: "placed", to: "delivered" }),
    ).toThrow("Invalid marketplace order transition");
  });

  test("normalizes full acceptance", () => {
    const result = normalizeLineDecision({
      requestedQty: 4,
      acceptedQty: 4,
      rejectedQty: 0,
    });

    expect(result).toEqual({
      acceptedQty: 4,
      rejectedQty: 0,
      lineStatus: "accepted",
    });
  });

  test("normalizes partial acceptance", () => {
    const result = normalizeLineDecision({
      requestedQty: 5,
      acceptedQty: 2,
      rejectedQty: 3,
    });

    expect(result.lineStatus).toBe("partially_accepted");
    expect(result.acceptedQty).toBe(2);
    expect(result.rejectedQty).toBe(3);
  });
});
