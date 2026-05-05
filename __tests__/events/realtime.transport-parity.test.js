const { WebSocketManager } = require("../../events/WebSocketManager");
const { SSEManager } = require("../../events/SSEManager");

const setupManagers = () => {
  const wsManager = new WebSocketManager();
  const sseManager = new SSEManager();

  wsManager.businessClients.set("biz_1", new Set(["c1", "c2"]));
  wsManager.clients.set("c1", { userId: "a@example.com", isPartnerClient: false });
  wsManager.clients.set("c2", { userId: "b@example.com", isPartnerClient: false });

  const resA = { write: jest.fn() };
  const resB = { write: jest.fn() };

  sseManager.businessClients.set("biz_1", new Set(["c1", "c2"]));
  sseManager.clients.set("c1", {
    userId: "a@example.com",
    isPartnerClient: false,
    res: resA,
  });
  sseManager.clients.set("c2", {
    userId: "b@example.com",
    isPartnerClient: false,
    res: resB,
  });

  const wsSendSpy = jest.spyOn(wsManager, "sendToClient").mockReturnValue(true);
  const sseSendSpy = jest.spyOn(sseManager, "sendEvent").mockReturnValue(true);

  return { wsManager, sseManager, wsSendSpy, sseSendSpy, resA, resB };
};

describe("Realtime transport parity for user-scoped cart events", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("uses data.user.email when present", () => {
    const { wsManager, sseManager, wsSendSpy, sseSendSpy, resA } = setupManagers();

    const payload = {
      type: "cart.updated",
      data: {
        user: { email: "a@example.com" },
      },
    };

    wsManager.handleBusinessEvent("biz_1", payload);
    sseManager.handleBusinessEvent("biz_1", payload);

    expect(wsSendSpy).toHaveBeenCalledTimes(1);
    expect(wsSendSpy).toHaveBeenCalledWith(
      "c1",
      "event",
      expect.objectContaining({ type: "cart.updated" }),
    );

    expect(sseSendSpy).toHaveBeenCalledTimes(1);
    expect(sseSendSpy).toHaveBeenCalledWith(
      resA,
      "event",
      expect.objectContaining({ type: "cart.updated" }),
      expect.any(String),
    );
  });

  test("uses data.userId when email is absent", () => {
    const { wsManager, sseManager, wsSendSpy, sseSendSpy, resA } = setupManagers();

    const payload = {
      type: "cart.updated",
      data: {
        userId: "a@example.com",
      },
    };

    wsManager.handleBusinessEvent("biz_1", payload);
    sseManager.handleBusinessEvent("biz_1", payload);

    expect(wsSendSpy).toHaveBeenCalledTimes(1);
    expect(wsSendSpy).toHaveBeenCalledWith(
      "c1",
      "event",
      expect.objectContaining({ type: "cart.updated" }),
    );

    expect(sseSendSpy).toHaveBeenCalledTimes(1);
    expect(sseSendSpy).toHaveBeenCalledWith(
      resA,
      "event",
      expect.objectContaining({ type: "cart.updated" }),
      expect.any(String),
    );
  });

  test("falls back to metadata.userId when data user fields are absent", () => {
    const { wsManager, sseManager, wsSendSpy, sseSendSpy, resA } = setupManagers();

    const payload = {
      type: "cart.updated",
      data: {},
      metadata: {
        userId: "a@example.com",
      },
    };

    wsManager.handleBusinessEvent("biz_1", payload);
    sseManager.handleBusinessEvent("biz_1", payload);

    expect(wsSendSpy).toHaveBeenCalledTimes(1);
    expect(wsSendSpy).toHaveBeenCalledWith(
      "c1",
      "event",
      expect.objectContaining({ type: "cart.updated" }),
    );

    expect(sseSendSpy).toHaveBeenCalledTimes(1);
    expect(sseSendSpy).toHaveBeenCalledWith(
      resA,
      "event",
      expect.objectContaining({ type: "cart.updated" }),
      expect.any(String),
    );
  });

  test("broadcasts cart event when no user identity is present", () => {
    const { wsManager, sseManager, wsSendSpy, sseSendSpy } = setupManagers();

    const payload = {
      type: "cart.updated",
      data: {},
      metadata: {},
    };

    wsManager.handleBusinessEvent("biz_1", payload);
    sseManager.handleBusinessEvent("biz_1", payload);

    expect(wsSendSpy).toHaveBeenCalledTimes(2);
    expect(sseSendSpy).toHaveBeenCalledTimes(2);
  });
});
