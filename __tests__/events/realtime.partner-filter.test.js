const { WebSocketManager } = require("../../events/WebSocketManager");
const { SSEManager } = require("../../events/SSEManager");

describe("Realtime partner allowlist filtering", () => {
  describe("WebSocketManager", () => {
    test("blocks non-allowlisted events for partner clients", () => {
      const manager = new WebSocketManager();
      const sendToClientSpy = jest
        .spyOn(manager, "sendToClient")
        .mockReturnValue(true);

      manager.businessClients.set("biz_1", new Set(["partner", "internal"]));
      manager.clients.set("partner", {
        userId: "partner@example.com",
        isPartnerClient: true,
      });
      manager.clients.set("internal", {
        userId: "owner@example.com",
        isPartnerClient: false,
      });

      manager.handleBusinessEvent("biz_1", {
        type: "auth.permissions_updated",
        data: { userId: "owner@example.com" },
      });

      expect(sendToClientSpy).toHaveBeenCalledTimes(1);
      expect(sendToClientSpy).toHaveBeenCalledWith(
        "internal",
        "event",
        expect.objectContaining({ type: "auth.permissions_updated" }),
      );
    });

    test("allows allowlisted marketplace events for partner clients", () => {
      const manager = new WebSocketManager();
      const sendToClientSpy = jest
        .spyOn(manager, "sendToClient")
        .mockReturnValue(true);

      manager.businessClients.set("biz_1", new Set(["partner", "internal"]));
      manager.clients.set("partner", {
        userId: "partner@example.com",
        isPartnerClient: true,
      });
      manager.clients.set("internal", {
        userId: "owner@example.com",
        isPartnerClient: false,
      });

      manager.handleBusinessEvent("biz_1", {
        type: "marketplace.order.placed",
        data: { orderId: "order_1" },
      });

      expect(sendToClientSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("SSEManager", () => {
    test("blocks non-allowlisted events for partner clients", () => {
      const manager = new SSEManager();
      const sendEventSpy = jest.spyOn(manager, "sendEvent").mockReturnValue(true);

      manager.businessClients.set("biz_1", new Set(["partner", "internal"]));
      manager.clients.set("partner", {
        userId: "partner@example.com",
        isPartnerClient: true,
        res: { write: jest.fn() },
      });
      manager.clients.set("internal", {
        userId: "owner@example.com",
        isPartnerClient: false,
        res: { write: jest.fn() },
      });

      manager.handleBusinessEvent("biz_1", {
        type: "auth.permissions_updated",
        data: { userId: "owner@example.com" },
      });

      expect(sendEventSpy).toHaveBeenCalledTimes(1);
      expect(sendEventSpy).toHaveBeenCalledWith(
        { write: expect.any(Function) },
        "event",
        expect.objectContaining({ type: "auth.permissions_updated" }),
        expect.any(String),
      );
    });

    test("allows allowlisted product events for partner clients", () => {
      const manager = new SSEManager();
      const sendEventSpy = jest.spyOn(manager, "sendEvent").mockReturnValue(true);

      manager.businessClients.set("biz_1", new Set(["partner", "internal"]));
      manager.clients.set("partner", {
        userId: "partner@example.com",
        isPartnerClient: true,
        res: { write: jest.fn() },
      });
      manager.clients.set("internal", {
        userId: "owner@example.com",
        isPartnerClient: false,
        res: { write: jest.fn() },
      });

      manager.handleBusinessEvent("biz_1", {
        type: "product.updated",
        data: { _id: "prod_1" },
      });

      expect(sendEventSpy).toHaveBeenCalledTimes(2);
    });
  });
});
