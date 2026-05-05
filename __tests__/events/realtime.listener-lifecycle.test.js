const http = require("http");
const { eventBus } = require("../../events/EventEmitter");
const { WebSocketManager } = require("../../events/WebSocketManager");
const { SSEManager } = require("../../events/SSEManager");

describe("Realtime manager event listener lifecycle", () => {
  test("WebSocketManager registers and unregisters business_event listener", async () => {
    const baseline = eventBus.listenerCount("business_event");
    const manager = new WebSocketManager();
    const server = http.createServer();

    await new Promise((resolve) => server.listen(0, resolve));

    try {
      manager.initialize(server);

      expect(eventBus.listenerCount("business_event")).toBe(baseline + 1);

      manager.shutdown();

      expect(eventBus.listenerCount("business_event")).toBe(baseline);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      eventBus.off("business_event", manager.businessEventListener);
    }
  });

  test("SSEManager initialize is idempotent and shutdown cleans listener", () => {
    const baseline = eventBus.listenerCount("business_event");
    const manager = new SSEManager();

    manager.initialize();
    manager.initialize();

    expect(eventBus.listenerCount("business_event")).toBe(baseline + 1);

    manager.shutdown();

    expect(eventBus.listenerCount("business_event")).toBe(baseline);
  });
});
