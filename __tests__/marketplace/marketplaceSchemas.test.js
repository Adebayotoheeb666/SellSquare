const {
  validateOrderCreatePayload,
} = require("../../validators/marketplaceSchemas");

describe("marketplaceSchemas order payload validation", () => {
  test("accepts legacy productId line", () => {
    const result = validateOrderCreatePayload({
      lines: [{ productId: "product_1", quantity: 1 }],
    });

    expect(result.valid).toBe(true);
  });

  test("accepts listingId + variantId line", () => {
    const result = validateOrderCreatePayload({
      lines: [{ listingId: "group_1", variantId: "variant_1", quantity: 1 }],
    });

    expect(result.valid).toBe(true);
  });

  test("rejects missing variantId when listingId is provided", () => {
    const result = validateOrderCreatePayload({
      lines: [{ listingId: "group_1", quantity: 1 }],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("lines[0].variantId is required when listingId is provided");
  });

  test("rejects mixed legacy and canonical identifiers on same line", () => {
    const result = validateOrderCreatePayload({
      lines: [
        {
          productId: "product_1",
          listingId: "group_1",
          variantId: "variant_1",
          quantity: 1,
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "lines[0] must use either legacy productId or listingId+variantId, not both",
    );
  });
});
