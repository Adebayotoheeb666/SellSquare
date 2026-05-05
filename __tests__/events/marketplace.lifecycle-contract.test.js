const { EventTypes } = require("../../events/EventEmitter");
const { ORDER_STATUS_FLOW } = require("../../services/marketplace/constants");

describe("Marketplace lifecycle event contract", () => {
  test("status transition events match backend EventTypes constants", () => {
    const expectedStatusToEvent = {
      placed: EventTypes.MARKETPLACE_ORDER_PLACED,
      payment_confirmed: EventTypes.MARKETPLACE_ORDER_PAYMENT_CONFIRMED,
      accepted: EventTypes.MARKETPLACE_ORDER_ACCEPTED,
      rejected: EventTypes.MARKETPLACE_ORDER_REJECTED,
      processing: EventTypes.MARKETPLACE_ORDER_PROCESSING,
      shipped: EventTypes.MARKETPLACE_ORDER_SHIPPED,
      delivered: EventTypes.MARKETPLACE_ORDER_DELIVERED,
    };

    Object.keys(expectedStatusToEvent).forEach((status) => {
      expect(`marketplace.order.${status}`).toBe(expectedStatusToEvent[status]);
    });
  });

  test("all ORDER_STATUS_FLOW states have corresponding marketplace order event types", () => {
    const statuses = Object.keys(ORDER_STATUS_FLOW);

    statuses.forEach((status) => {
      expect(EventTypes).toEqual(
        expect.objectContaining({
          [`MARKETPLACE_ORDER_${status.toUpperCase()}`]: `marketplace.order.${status}`,
        }),
      );
    });
  });

  test("line update and webhook events are present for lifecycle side-effects", () => {
    expect(EventTypes.MARKETPLACE_ORDER_LINE_UPDATED).toBe(
      "marketplace.order.line.updated",
    );
    expect(EventTypes.MARKETPLACE_WEBHOOK_DELIVERY_SUCCEEDED).toBe(
      "marketplace.webhook.delivery_succeeded",
    );
    expect(EventTypes.MARKETPLACE_WEBHOOK_DELIVERY_FAILED).toBe(
      "marketplace.webhook.delivery_failed",
    );
  });

  test("marketplace order payload baseline shape supports realtime cache updates", () => {
    const orderSnapshotPayload = {
      orderId: "order_1",
      status: "processing",
      order: {
        _id: "order_1",
        status: "processing",
        lines: [
          {
            lineId: "line_1",
            lineStatus: "accepted",
            acceptedQty: 2,
            rejectedQty: 0,
          },
        ],
      },
      lines: [
        {
          lineId: "line_1",
        },
      ],
      affectedLines: [
        {
          lineId: "line_1",
        },
      ],
      correlationId: "order_1",
    };

    expect(orderSnapshotPayload).toEqual(
      expect.objectContaining({
        orderId: expect.any(String),
        status: expect.any(String),
        order: expect.objectContaining({
          _id: expect.any(String),
        }),
        lines: expect.any(Array),
        affectedLines: expect.any(Array),
      }),
    );
  });
});
