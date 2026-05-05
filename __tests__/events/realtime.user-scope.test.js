const { WebSocketManager } = require("../../events/WebSocketManager");
const { SSEManager } = require("../../events/SSEManager");

describe("Realtime user-scoped cart event delivery", () => {
  describe("WebSocketManager", () => {
    test("delivers cart event only to matching user", () => {
      const manager = new WebSocketManager();
      const sendToClientSpy = jest
        .spyOn(manager, "sendToClient")
        .mockReturnValue(true);

      manager.businessClients.set("biz_1", new Set(["client_alice", "client_bob"]));
      manager.clients.set("client_alice", { userId: "alice@example.com" });
      manager.clients.set("client_bob", { userId: "bob@example.com" });

      manager.handleBusinessEvent("biz_1", {
        type: "cart.updated",
        data: {
          user: { email: "alice@example.com" },
          items: [{ _id: "item_1" }],
        },
      });

      expect(sendToClientSpy).toHaveBeenCalledTimes(1);
      expect(sendToClientSpy).toHaveBeenCalledWith(
        "client_alice",
        "event",
        expect.objectContaining({ type: "cart.updated" }),
      );
    });

    test("delivers non-cart events to all business clients", () => {
      const manager = new WebSocketManager();
      const sendToClientSpy = jest
        .spyOn(manager, "sendToClient")
        .mockReturnValue(true);

      manager.businessClients.set("biz_1", new Set(["client_alice", "client_bob"]));
      manager.clients.set("client_alice", { userId: "alice@example.com" });
      manager.clients.set("client_bob", { userId: "bob@example.com" });

      manager.handleBusinessEvent("biz_1", {
        type: "product.updated",
        data: { _id: "prod_1" },
      });

      expect(sendToClientSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("SSEManager", () => {
    test("delivers cart event only to matching user", () => {
      const manager = new SSEManager();
      const sendEventSpy = jest.spyOn(manager, "sendEvent").mockReturnValue(true);

      manager.businessClients.set("biz_1", new Set(["client_alice", "client_bob"]));
      manager.clients.set("client_alice", {
        userId: "alice@example.com",
        res: { write: jest.fn() },
      });
      manager.clients.set("client_bob", {
        userId: "bob@example.com",
        res: { write: jest.fn() },
      });

      manager.handleBusinessEvent("biz_1", {
        type: "cart.updated",
        data: {
          userId: "alice@example.com",
          items: [{ _id: "item_1" }],
        },
      });

      expect(sendEventSpy).toHaveBeenCalledTimes(1);
      expect(sendEventSpy).toHaveBeenCalledWith(
        { write: expect.any(Function) },
        "event",
        expect.objectContaining({ type: "cart.updated" }),
        expect.any(String),
      );
    });

    test("delivers non-cart events to all business clients", () => {
      const manager = new SSEManager();
      const sendEventSpy = jest.spyOn(manager, "sendEvent").mockReturnValue(true);

      manager.businessClients.set("biz_1", new Set(["client_alice", "client_bob"]));
      manager.clients.set("client_alice", {
        userId: "alice@example.com",
        res: { write: jest.fn() },
      });
      manager.clients.set("client_bob", {
        userId: "bob@example.com",
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
