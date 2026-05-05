const {
  getDiscountedPrice,
  discountAppliesToContext,
} = require("../../services/marketplace/discountResolver");

describe("discountResolver helpers", () => {
  test("applies percentage discount", () => {
    const value = getDiscountedPrice(1000, {
      discountAmount: 10,
      discountValueType: "percentage",
    });

    expect(value).toBe(900);
  });

  test("applies amount discount", () => {
    const value = getDiscountedPrice(1000, {
      discountAmount: 250,
      discountValueType: "amount",
    });

    expect(value).toBe(750);
  });

  test("group selected_items applies only selected variant", () => {
    const applies = discountAppliesToContext({
      discount: {
        appliedProducts: [],
        appliedGroupItems: ["variant-1"],
        appliedProductGroups: ["group-1"],
        groupSelection: "selected_items",
      },
      productId: "variant-2",
      variantProductId: "variant-2",
      groupId: "group-1",
    });

    expect(applies).toBe(false);
  });

  test("group all_items applies by group", () => {
    const applies = discountAppliesToContext({
      discount: {
        appliedProducts: [],
        appliedGroupItems: [],
        appliedProductGroups: ["group-1"],
        groupSelection: "all_items",
      },
      productId: "variant-2",
      variantProductId: "variant-2",
      groupId: "group-1",
    });

    expect(applies).toBe(true);
  });
});
