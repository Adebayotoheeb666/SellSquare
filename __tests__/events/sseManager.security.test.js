jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(),
}));

const { SSEManager } = require("../../events/SSEManager");

describe("SSEManager hardening", () => {
  test("blocks disallowed origins for credentialed SSE connection", () => {
    const manager = new SSEManager();

    const req = {
      headers: {
        origin: "https://example.com",
      },
      query: {},
      ip: "127.0.0.1",
      get: jest.fn().mockReturnValue("jest-agent"),
      on: jest.fn(),
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    manager.handleConnection(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Forbidden origin" });
  });

  test("filters user-scoped cart events to owning SSE user", () => {
    const manager = new SSEManager();

    const writes = {
      userA: [],
      userB: [],
    };

    manager.businessClients.set("biz-1", new Set(["c1", "c2"]));
    manager.clients.set("c1", {
      businessId: "biz-1",
      userId: "a@example.com",
      res: { writable: true, write: (msg) => writes.userA.push(msg) },
    });
    manager.clients.set("c2", {
      businessId: "biz-1",
      userId: "b@example.com",
      res: { writable: true, write: (msg) => writes.userB.push(msg) },
    });

    manager.handleBusinessEvent("biz-1", {
      id: "evt_1",
      type: "cart.updated",
      data: {
        user: { email: "a@example.com" },
      },
    });

    expect(writes.userA.length).toBeGreaterThan(0);
    expect(writes.userB.length).toBe(0);
  });
});
