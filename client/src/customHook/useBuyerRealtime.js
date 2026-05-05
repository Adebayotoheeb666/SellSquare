/**
 * useBuyerRealtime Hook
 *
 * Custom hook for managing buyer realtime notifications via WebSocket.
 * Handles order status updates, order rejections, and wallet credits.
 */

import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectIsBuyerAuthenticated } from "../redux/features/buyerAuth/buyerAuthSlice";
import { useNotification } from "./useNotification";

/**
 * Hook for buyer realtime notifications
 * Connects to WebSocket using buyer JWT token from localStorage
 * Handles marketplace order and wallet events
 */
export const useBuyerRealtime = () => {
  const dispatch = useDispatch();
  const isBuyerAuthenticated = useSelector(selectIsBuyerAuthenticated);
  const showNotification = useNotification();
  const wsRef = useRef(null);
  const connectAttemptRef = useRef(0);
  const maxConnectAttemptsRef = useRef(5);

  useEffect(() => {
    // Only connect if buyer is authenticated
    if (!isBuyerAuthenticated) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    // Get buyer token from localStorage
    const buyerToken =
      localStorage.getItem("buyer_token") ||
      document.cookie
        .split("; ")
        .find((c) => c.startsWith("buyer_token="))
        ?.split("=")[1];

    if (!buyerToken) {
      console.log("[useBuyerRealtime] No buyer token found");
      return;
    }

    const connectWebSocket = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log("[useBuyerRealtime] WebSocket already connected");
        return;
      }

      try {
        const protocol =
          window.location.protocol === "https:" ? "wss:" : "ws:";
        const isDevelopment =
          process.env.NODE_ENV === "development" &&
          window.location.hostname === "localhost";

        let wsUrl;
        if (isDevelopment) {
          wsUrl = `${protocol}//localhost:4000/ws?buyer_token=${buyerToken}`;
        } else {
          wsUrl = `${protocol}//${window.location.host}/ws?buyer_token=${buyerToken}`;
        }

        console.log("[useBuyerRealtime] Connecting to:", wsUrl);

        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log("[useBuyerRealtime] WebSocket connected");
          connectAttemptRef.current = 0;
        };

        wsRef.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            handleBuyerMessage(message);
          } catch (error) {
            console.error("[useBuyerRealtime] Error parsing message:", error);
          }
        };

        wsRef.current.onclose = () => {
          console.log("[useBuyerRealtime] WebSocket closed");
          wsRef.current = null;

          // Attempt to reconnect with exponential backoff
          if (
            connectAttemptRef.current < maxConnectAttemptsRef.current &&
            isBuyerAuthenticated
          ) {
            connectAttemptRef.current++;
            const delay = Math.pow(2, connectAttemptRef.current) * 1000;
            console.log(
              `[useBuyerRealtime] Attempting to reconnect in ${delay}ms`
            );
            setTimeout(connectWebSocket, delay);
          }
        };

        wsRef.current.onerror = (error) => {
          console.error("[useBuyerRealtime] WebSocket error:", error);
        };
      } catch (error) {
        console.error("[useBuyerRealtime] Connection error:", error);
      }
    };

    const handleBuyerMessage = (message) => {
      console.log("[useBuyerRealtime] Message received:", message.type);

      switch (message.type) {
        case "connected":
          console.log("[useBuyerRealtime] Successfully connected to realtime");
          break;

        case "event":
          handleBuyerEvent(message.data);
          break;

        case "pong":
          // Heartbeat response
          break;

        default:
          console.log("[useBuyerRealtime] Unknown message type:", message.type);
      }
    };

    const handleBuyerEvent = (eventData) => {
      const eventType = eventData?.type;
      console.log("[useBuyerRealtime] Event received:", eventType);

      // Handle marketplace order accepted
      if (eventType === "marketplace.internal_order.accepted") {
        showNotification({
          type: "success",
          message: `Order from ${eventData.data?.businessName} accepted! ✓`,
        });
        // Dispatch action to refresh orders if you have one
        // dispatch(fetchBuyerOrders());
      }

      // Handle marketplace order rejected
      if (eventType === "marketplace.internal_order.rejected") {
        showNotification({
          type: "info",
          message: `Order rejected: ${eventData.data?.reason}. Refund sent to wallet.`,
        });
        // Dispatch actions to refresh orders and wallet
        // dispatch(fetchBuyerOrders());
        // dispatch(fetchBuyerWalletBalance());
      }

      // Handle wallet credited
      if (eventType === "wallet.credited") {
        showNotification({
          type: "info",
          message: `Wallet credited: ${eventData.data?.currency} ${eventData.data?.amount}`,
        });
        // dispatch(fetchBuyerWalletBalance());
      }

      // Handle order status updates
      if (eventType === "marketplace.internal_order.status_updated") {
        const newStatus = eventData.data?.newStatus;
        const statusMessages = {
          processing: "Order is being processed",
          shipped: "Order has been shipped!",
          delivered: "Order has been delivered!",
        };
        if (statusMessages[newStatus]) {
          showNotification({
            type: "info",
            message: statusMessages[newStatus],
          });
        }
        // dispatch(fetchBuyerOrders());
      }
    };

    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isBuyerAuthenticated, showNotification]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
};

export default useBuyerRealtime;
