const {
  buildHoldExpiry,
  toIdString,
} = require("../../services/marketplace/inventoryHoldService");

describe("inventoryHoldService helpers", () => {
  test("buildHoldExpiry creates future timestamp", () => {
    const now = Date.now();
    const expiry = buildHoldExpiry(45);
    expect(expiry.getTime()).toBeGreaterThan(now);
  });

  test("toIdString handles object and string values", () => {
    expect(toIdString("abc")).toBe("abc");
    expect(toIdString({ toString: () => "xyz" })).toBe("xyz");
  });
});
