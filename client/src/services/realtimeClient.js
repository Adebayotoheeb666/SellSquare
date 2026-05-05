/**
 * Realtime Client
 *
 * Provides WebSocket and SSE connections for realtime event updates.
 * Automatically falls back to SSE if WebSocket is unavailable.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Connection state management
 * - Event buffering during disconnection
 * - Graceful offline handling
 */

import { store } from "../redux/store";
import {
  handleRealtimeEvent,
  setConnectionStatus,
  setLastEventTimestamp,
} from "../redux/features/realtime/realtimeSlice";

// Connection states
export const ConnectionState = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  RECONNECTING: "reconnecting",
  ERROR: "error",
};

class RealtimeClient {
  constructor() {
    this.ws = null;
    this.sse = null;
    this.connectionState = ConnectionState.DISCONNECTED;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.baseReconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.heartbeatInterval = null;
    this.lastEventId = null;
    this.eventBuffer = [];
    this.subscribers = new Map();
    this.useWebSocket = true; // Prefer WebSocket, fallback to SSE
    this.isConnecting = false;
  }

  /**
   * Initialize the realtime connection
   * Uses httpOnly cookies for auth - no token parameter needed
   */
  connect() {
    // Prevent multiple simultaneous connection attempts
    if (
      this.isConnecting ||
      this.connectionState === ConnectionState.CONNECTED
    ) {
      console.log("[RealtimeClient] Already connected or connecting, skipping");
      return;
    }

    this.isConnecting = true;
    this.updateConnectionState(ConnectionState.CONNECTING);

    // Try WebSocket first, fallback to SSE
    if (this.useWebSocket && "WebSocket" in window) {
      this.connectWebSocket();
    } else {
      this.connectSSE();
    }
  }

  /**
   * Connect via WebSocket
   * Cookies are automatically sent with the WebSocket handshake on same-origin
   * In development, connects to backend server on port 4000
   * In production, connects to same origin
   */
  connectWebSocket() {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const isDevelopment =
        process.env.NODE_ENV === "development" &&
        window.location.hostname === "localhost";

      let wsUrl;
      if (isDevelopment) {
        // In development, connect directly to backend on port 4000
        // This bypasses the React dev server and goes straight to our backend
        wsUrl = `${protocol}//localhost:4000/ws`;
      } else {
        // In production, connect to same origin
        wsUrl = `${protocol}//${window.location.host}/ws`;
      }

      console.log(
        "[RealtimeClient] Attempting WebSocket connection to:",
        wsUrl,
      );
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("[RealtimeClient] WebSocket connected successfully");
        this.isConnecting = false;
        this.updateConnectionState(ConnectionState.CONNECTED);
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.flushEventBuffer();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("[RealtimeClient] Message received:", message.type);
          this.handleMessage(message);
        } catch (error) {
          console.error("[RealtimeClient] Error parsing message:", error);
        }
      };

      this.ws.onclose = (event) => {
        console.log(
          "[RealtimeClient] WebSocket closed:",
          event.code,
          event.reason,
        );
        this.isConnecting = false;
        this.stopHeartbeat();

        // Don't reconnect on auth failure (1008) or normal closure (1000)
        if (event.code === 1008) {
          console.log("[RealtimeClient] Auth failed, not reconnecting");
          this.updateConnectionState(ConnectionState.DISCONNECTED);
        } else if (event.code !== 1000) {
          // Abnormal closure - try to reconnect
          this.handleDisconnect();
        } else {
          this.updateConnectionState(ConnectionState.DISCONNECTED);
        }
      };

      this.ws.onerror = (error) => {
        console.error("[RealtimeClient] WebSocket error:", error);
        this.isConnecting = false;
        this.updateConnectionState(ConnectionState.ERROR);

        // Fallback to SSE
        if (this.useWebSocket) {
          console.log("[RealtimeClient] Falling back to SSE");
          this.useWebSocket = false;
          this.connectSSE();
        }
      };
    } catch (error) {
      console.error("[RealtimeClient] WebSocket connection error:", error);
      this.isConnecting = false;
      this.useWebSocket = false;
      this.connectSSE();
    }
  }

  /**
   * Connect via Server-Sent Events
   * Cookies are automatically sent with fetch/EventSource on same-origin
   */
  connectSSE() {
    try {
      // Build SSE URL based on environment
      const isDevelopment =
        process.env.NODE_ENV === "development" &&
        window.location.hostname === "localhost";

      let sseUrl;
      if (isDevelopment) {
        // In development, connect to backend on port 4000
        sseUrl = `http://localhost:4000/api/realtime/events`;
      } else {
        // In production, connect to same origin
        sseUrl = `/api/realtime/events`;
      }

      console.log("[RealtimeClient] Attempting SSE connection to:", sseUrl);

      this.sse = new EventSource(sseUrl, { withCredentials: true });

      this.sse.onopen = () => {
        console.log("[RealtimeClient] SSE connected");
        this.isConnecting = false;
        this.updateConnectionState(ConnectionState.CONNECTED);
        this.reconnectAttempts = 0;
        this.flushEventBuffer();
      };

      this.sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage({ type: "event", data });
          this.lastEventId = event.lastEventId;
        } catch (error) {
          console.error("[RealtimeClient] Error parsing SSE message:", error);
        }
      };

      // Handle specific event types
      this.sse.addEventListener("connected", (event) => {
        const data = JSON.parse(event.data);
        console.log("[RealtimeClient] SSE connection confirmed:", data);
      });

      this.sse.addEventListener("event", (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage({ type: "event", data });
          this.lastEventId = event.lastEventId;
        } catch (error) {
          console.error("[RealtimeClient] Error parsing SSE event:", error);
        }
      });

      this.sse.addEventListener("shutdown", (event) => {
        const data = JSON.parse(event.data);
        console.log("[RealtimeClient] Server shutdown:", data);
        this.handleDisconnect(data.reconnectIn);
      });

      this.sse.onerror = (error) => {
        console.error("[RealtimeClient] SSE error:", error);
        this.updateConnectionState(ConnectionState.ERROR);
        this.handleDisconnect();
      };
    } catch (error) {
      console.error("[RealtimeClient] SSE connection error:", error);
      this.handleDisconnect();
    }
  }

  /**
   * Handle incoming message
   */
  handleMessage(message) {
    const { type, data, timestamp } = message;

    switch (type) {
      case "connected":
        console.log("[RealtimeClient] Connection confirmed:", data);
        break;

      case "event":
        this.dispatchEvent(data);
        break;

      case "pong":
        // Heartbeat response
        break;

      case "error":
        console.error("[RealtimeClient] Server error:", data);
        break;

      case "shutdown":
        console.log("[RealtimeClient] Server shutdown:", data);
        this.handleDisconnect(data?.reconnectIn);
        break;

      default:
        console.log("[RealtimeClient] Unknown message type:", type);
    }
  }

  /**
   * Dispatch event to Redux store and subscribers
   */
  dispatchEvent(eventData) {
    // Update last event timestamp
    store.dispatch(setLastEventTimestamp(Date.now()));

    // Dispatch to Redux for state updates
    store.dispatch(handleRealtimeEvent(eventData));

    // Notify subscribers
    const eventType = eventData.type;
    const subscribers = this.subscribers.get(eventType) || [];
    const wildcardSubscribers = this.subscribers.get("*") || [];

    [...subscribers, ...wildcardSubscribers].forEach((callback) => {
      try {
        callback(eventData);
      } catch (error) {
        console.error("[RealtimeClient] Subscriber error:", error);
      }
    });
  }

  /**
   * Subscribe to specific event types
   */
  subscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType).push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(eventType);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Handle disconnection with reconnection logic
   */
  handleDisconnect(reconnectDelay = null) {
    this.stopHeartbeat();
    this.cleanup();

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[RealtimeClient] Max reconnection attempts reached");
      this.updateConnectionState(ConnectionState.ERROR);
      return;
    }

    this.updateConnectionState(ConnectionState.RECONNECTING);
    this.reconnectAttempts++;

    // Calculate delay with exponential backoff and jitter
    const baseDelay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay,
    );
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    const delay = reconnectDelay || baseDelay + jitter;

    console.log(
      `[RealtimeClient] Reconnecting in ${Math.round(delay)}ms (attempt ${
        this.reconnectAttempts
      })`,
    );

    setTimeout(() => {
      // Check if user is still online before reconnecting
      if (!navigator.onLine) {
        console.log("[RealtimeClient] Offline, waiting for connection");
        this.updateConnectionState(ConnectionState.DISCONNECTED);
        return;
      }

      if (this.useWebSocket) {
        this.connectWebSocket();
      } else {
        this.connectSSE();
      }
    }, delay);
  }

  /**
   * Update connection state and dispatch to Redux
   */
  updateConnectionState(state) {
    this.connectionState = state;
    store.dispatch(setConnectionStatus(state));
  }

  /**
   * Start heartbeat for WebSocket
   */
  startHeartbeat() {
    if (!this.ws) return;

    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 25000);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Buffer events when offline
   */
  bufferEvent(event) {
    this.eventBuffer.push({
      event,
      timestamp: Date.now(),
    });

    // Keep only last 100 events
    if (this.eventBuffer.length > 100) {
      this.eventBuffer.shift();
    }
  }

  /**
   * Flush buffered events
   */
  flushEventBuffer() {
    if (this.eventBuffer.length === 0) return;

    console.log(
      `[RealtimeClient] Flushing ${this.eventBuffer.length} buffered events`,
    );

    this.eventBuffer.forEach(({ event }) => {
      this.dispatchEvent(event);
    });

    this.eventBuffer = [];
  }

  /**
   * Send message via WebSocket
   */
  send(type, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
      return true;
    }
    return false;
  }

  /**
   * Acknowledge event receipt
   */
  acknowledgeEvent(eventId) {
    this.send("ack", { eventId });
  }

  /**
   * Cleanup connections
   */
  cleanup() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.sse) {
      this.sse.close();
      this.sse = null;
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect() {
    this.stopHeartbeat();
    this.cleanup();
    this.updateConnectionState(ConnectionState.DISCONNECTED);
    this.token = null;
    this.reconnectAttempts = 0;
    this.eventBuffer = [];
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connectionState === ConnectionState.CONNECTED;
  }

  /**
   * Get current connection state
   */
  getConnectionState() {
    return this.connectionState;
  }
}

// Create and export singleton instance
export const realtimeClient = new RealtimeClient();

export default realtimeClient;
