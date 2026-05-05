const {
  buildTimestampedSignatureHeader,
  verifyTimestampedSignature,
} = require("../../services/marketplace/webhookSecurity");
const {
  buildWebhookV2Envelope,
  createStableEventId,
  SUPPORTED_ORDER_EVENT_TYPES,
} = require("../../services/marketplace/webhookEventBuilder");
const {
  getRetryDelayMinutes,
} = require("../../services/marketplace/webhookFanoutService");

describe("marketplace webhook v2 unit", () => {
  test("builds and verifies timestamped signature header", () => {
    const payload = { orderId: "o1" };
    const header = buildTimestampedSignatureHeader({
      payload,
      currentSecret: "current-secret",
      nextSecret: "next-secret",
      unixTimestamp: 1735689600,
    });

    expect(header).toContain("t=1735689600");
    expect(header.split(",").filter((part) => part.startsWith("v1=")).length).toBe(2);

    const verifyCurrent = verifyTimestampedSignature({
      payload,
      headerValue: header,
      currentSecret: "current-secret",
    });
    expect(verifyCurrent.valid).toBe(true);
    expect(verifyCurrent.matchedSecret).toBe("current");

    const verifyNext = verifyTimestampedSignature({
      payload,
      headerValue: header,
      currentSecret: "wrong-secret",
      nextSecret: "next-secret",
    });
    expect(verifyNext.valid).toBe(true);
    expect(verifyNext.matchedSecret).toBe("next");
  });

  test("builds v2 envelope with required fields", () => {
    const envelope = buildWebhookV2Envelope({
      eventType: "marketplace.order.shipped",
      eventId: "3f9f8cf1-7274-4d8b-8c98-13f3d0aa7174",
      deliveryId: "delivery-1",
      correlationId: "corr-1",
      occurredAt: "2026-03-03T12:00:00.000Z",
      order: { _id: "order-1", status: "shipped" },
      lines: [
        {
          lineId: "line-1",
          productId: "product-1",
          requestedQty: 2,
          acceptedQty: 2,
          rejectedQty: 0,
          decisionStatus: "accepted",
          decisionReason: "ok",
          variantId: "variant-1",
          parentGroupId: "group-1",
          groupName: "Group",
          variantImage: "https://example.com/v.jpg",
          groupImage: "https://example.com/g.jpg",
        },
      ],
    });

    expect(envelope).toEqual(
      expect.objectContaining({
        eventId: "3f9f8cf1-7274-4d8b-8c98-13f3d0aa7174",
        deliveryId: "delivery-1",
        correlationId: "corr-1",
        eventType: "marketplace.order.shipped",
        schemaVersion: "2.0.0",
        occurredAt: "2026-03-03T12:00:00.000Z",
      }),
    );
    expect(Array.isArray(envelope.lines)).toBe(true);
  });

  test("reuses stable event id for identical seed", () => {
    const eventIdOne = createStableEventId("seed-abc");
    const eventIdTwo = createStableEventId("seed-abc");
    const eventIdThree = createStableEventId("seed-def");

    expect(eventIdOne).toBe(eventIdTwo);
    expect(eventIdOne).not.toBe(eventIdThree);
    expect(eventIdOne).toMatch(/^[a-f0-9-]{36}$/);
  });

  test("returns exponential retry policy delays", () => {
    expect(getRetryDelayMinutes(1)).toBe(1);
    expect(getRetryDelayMinutes(2)).toBe(5);
    expect(getRetryDelayMinutes(3)).toBe(15);
    expect(getRetryDelayMinutes(4)).toBe(30);
    expect(getRetryDelayMinutes(5)).toBe(60);
    expect(getRetryDelayMinutes(9)).toBe(60);
  });

  test("keeps marketplace.order.* event names stable including placed", () => {
    expect(SUPPORTED_ORDER_EVENT_TYPES.has("marketplace.order.placed")).toBe(true);
    expect(SUPPORTED_ORDER_EVENT_TYPES.has("marketplace.order.payment_confirmed")).toBe(true);
    expect(SUPPORTED_ORDER_EVENT_TYPES.has("marketplace.order.accepted")).toBe(true);
    expect(SUPPORTED_ORDER_EVENT_TYPES.has("marketplace.order.rejected")).toBe(true);
    expect(SUPPORTED_ORDER_EVENT_TYPES.has("marketplace.order.processing")).toBe(true);
    expect(SUPPORTED_ORDER_EVENT_TYPES.has("marketplace.order.shipped")).toBe(true);
    expect(SUPPORTED_ORDER_EVENT_TYPES.has("marketplace.order.delivered")).toBe(true);
    expect(SUPPORTED_ORDER_EVENT_TYPES.has("marketplace.order.line.updated")).toBe(true);
  });
});
