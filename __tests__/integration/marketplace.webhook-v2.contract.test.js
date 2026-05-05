const fs = require("fs");
const path = require("path");
const {
  buildWebhookV2Envelope,
} = require("../../services/marketplace/webhookEventBuilder");

const contractPath = path.join(
  __dirname,
  "..",
  "..",
  "docs",
  "contracts",
  "nino-marketplace-webhook-v2.contract.json",
);

const requireFields = (obj, keys) => keys.every((key) => Object.prototype.hasOwnProperty.call(obj, key));

describe("marketplace webhook v2 contract", () => {
  test("matches Nino required contract fields", () => {
    const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
    const envelope = buildWebhookV2Envelope({
      eventType: "marketplace.order.delivered",
      eventId: "7b9ebbe8-f3e2-4b72-85d1-8f858af7f64f",
      deliveryId: "delivery_123",
      correlationId: "corr-123",
      occurredAt: "2026-03-03T10:00:00.000Z",
      order: {
        _id: "order-1",
        status: "delivered",
      },
      lines: [
        {
          lineId: "line-1",
          productId: "product-1",
          requestedQty: 1,
          acceptedQty: 1,
          rejectedQty: 0,
          decisionStatus: "accepted",
          decisionReason: "ok",
          variantId: "variant-1",
          parentGroupId: "group-1",
          groupName: "Group",
          variantImage: "https://example.com/variant.jpg",
          groupImage: "https://example.com/group.jpg",
        },
      ],
    });

    expect(requireFields(envelope, contract.required)).toBe(true);

    const lineSchema = contract.properties.lines.items;
    expect(Array.isArray(envelope.lines)).toBe(true);
    expect(requireFields(envelope.lines[0], lineSchema.required)).toBe(true);
    expect(envelope.schemaVersion).toBe(contract.properties.schemaVersion.const);
  });
});
