/**
 * Connection Status Component
 *
 * Displays realtime connection status to the user.
 * Shows reconnection attempts, offline status, and provides
 * manual reconnection option.
 */
import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  selectConnectionStatus,
  selectRetryCount,
  selectLastEventTime,
  resetRetryCount,
} from "../../redux/features/realtime/realtimeSlice";
import { realtimeClient } from "../../services/realtimeClient";

// Connection status types for styling
const STATUS_CONFIG = {
  connected: {
    color: "#10b981",
    bgColor: "#d1fae5",
    borderColor: "#6ee7b7",
    icon: "●",
    label: "Connected",
    showReconnect: false,
  },
  connecting: {
    color: "#f59e0b",
    bgColor: "#fef3c7",
    borderColor: "#fcd34d",
    icon: "◐",
    label: "Connecting...",
    showReconnect: false,
  },
  disconnected: {
    color: "#ef4444",
    bgColor: "#fee2e2",
    borderColor: "#fca5a5",
    icon: "○",
    label: "Disconnected",
    showReconnect: true,
  },
  reconnecting: {
    color: "#f59e0b",
    bgColor: "#fef3c7",
    borderColor: "#fcd34d",
    icon: "◑",
    label: "Reconnecting",
    showReconnect: false,
  },
  failed: {
    color: "#dc2626",
    bgColor: "#fecaca",
    borderColor: "#f87171",
    icon: "✕",
    label: "Connection Failed",
    showReconnect: true,
  },
  offline: {
    color: "#6b7280",
    bgColor: "#f3f4f6",
    borderColor: "#d1d5db",
    icon: "⊘",
    label: "Offline",
    showReconnect: false,
  },
};

/**
 * Compact connection indicator (icon + tooltip)
 */
export const ConnectionIndicator = ({ className = "" }) => {
  const connectionStatus = useSelector(selectConnectionStatus);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const effectiveStatus = !isOnline ? "offline" : connectionStatus;
  const config = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.disconnected;

  return (
    <div
      className={`connection-indicator ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "12px",
        color: config.color,
        cursor: "default",
      }}
      title={`Realtime: ${config.label}`}
    >
      <span
        style={{
          fontSize: "10px",
          animation:
            effectiveStatus === "connecting" ||
            effectiveStatus === "reconnecting"
              ? "pulse 1.5s infinite"
              : "none",
        }}
      >
        {config.icon}
      </span>
    </div>
  );
};

/**
 * Full connection status bar with retry info
 */
export const ConnectionStatusBar = ({
  showAlways = false,
  className = "",
  position = "bottom", // "top" | "bottom"
}) => {
  const dispatch = useDispatch();
  const connectionStatus = useSelector(selectConnectionStatus);
  const retryCount = useSelector(selectRetryCount);
  const lastEventTime = useSelector(selectLastEventTime);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showBar, setShowBar] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Show bar when there's an issue
  useEffect(() => {
    const shouldShow =
      showAlways ||
      !isOnline ||
      connectionStatus === "disconnected" ||
      connectionStatus === "failed" ||
      connectionStatus === "reconnecting";

    setShowBar(shouldShow);
  }, [showAlways, isOnline, connectionStatus]);

  const effectiveStatus = !isOnline ? "offline" : connectionStatus;
  const config = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.disconnected;

  const handleReconnect = async () => {
    if (isReconnecting) return;

    setIsReconnecting(true);
    try {
      dispatch(resetRetryCount());
      await realtimeClient.reconnect();
    } catch (error) {
      console.error("Manual reconnection failed:", error);
    } finally {
      setIsReconnecting(false);
    }
  };

  const formatLastEventTime = () => {
    if (!lastEventTime) return "Never";

    const seconds = Math.floor((Date.now() - lastEventTime) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  if (!showBar) return null;

  return (
    <div
      className={`connection-status-bar ${className}`}
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        [position]: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        padding: "8px 16px",
        backgroundColor: config.bgColor,
        borderTop:
          position === "bottom" ? `2px solid ${config.borderColor}` : "none",
        borderBottom:
          position === "top" ? `2px solid ${config.borderColor}` : "none",
        fontSize: "14px",
        color: config.color,
        transition: "transform 0.3s ease",
      }}
    >
      {/* Status Icon */}
      <span
        style={{
          fontSize: "16px",
          animation:
            effectiveStatus === "reconnecting"
              ? "spin 1s linear infinite"
              : effectiveStatus === "connecting"
              ? "pulse 1.5s infinite"
              : "none",
        }}
      >
        {config.icon}
      </span>

      {/* Status Label */}
      <span style={{ fontWeight: 500 }}>
        {config.label}
        {effectiveStatus === "reconnecting" && retryCount > 0 && (
          <span style={{ marginLeft: "4px", opacity: 0.8 }}>
            (Attempt {retryCount}/10)
          </span>
        )}
      </span>

      {/* Last Event Time */}
      {connectionStatus === "connected" && lastEventTime && (
        <span style={{ fontSize: "12px", opacity: 0.7 }}>
          Last event: {formatLastEventTime()}
        </span>
      )}

      {/* Reconnect Button */}
      {config.showReconnect && isOnline && (
        <button
          onClick={handleReconnect}
          disabled={isReconnecting}
          style={{
            marginLeft: "8px",
            padding: "4px 12px",
            fontSize: "12px",
            fontWeight: 500,
            color: "#fff",
            backgroundColor: config.color,
            border: "none",
            borderRadius: "4px",
            cursor: isReconnecting ? "not-allowed" : "pointer",
            opacity: isReconnecting ? 0.7 : 1,
            transition: "opacity 0.2s",
          }}
        >
          {isReconnecting ? "Reconnecting..." : "Reconnect"}
        </button>
      )}

      {/* Offline Message */}
      {!isOnline && (
        <span style={{ fontSize: "12px", opacity: 0.8 }}>
          Check your internet connection
        </span>
      )}

      {/* Close Button (optional) */}
      {showAlways && effectiveStatus === "connected" && (
        <button
          onClick={() => setShowBar(false)}
          style={{
            marginLeft: "auto",
            padding: "2px 8px",
            fontSize: "12px",
            color: config.color,
            backgroundColor: "transparent",
            border: `1px solid ${config.borderColor}`,
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      )}

      {/* CSS Animations */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

/**
 * Toast-style connection notification
 */
export const ConnectionToast = ({ duration = 3000 }) => {
  const connectionStatus = useSelector(selectConnectionStatus);
  const [prevStatus, setPrevStatus] = useState(connectionStatus);
  const [showToast, setShowToast] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (connectionStatus !== prevStatus) {
      // Status changed, show toast
      if (connectionStatus === "connected" && prevStatus !== "connected") {
        setMessage("Realtime connection restored");
        setShowToast(true);
      } else if (
        connectionStatus === "disconnected" &&
        prevStatus === "connected"
      ) {
        setMessage("Realtime connection lost");
        setShowToast(true);
      } else if (connectionStatus === "reconnecting") {
        setMessage("Attempting to reconnect...");
        setShowToast(true);
      }

      setPrevStatus(connectionStatus);

      // Auto-hide toast after duration
      if (connectionStatus === "connected") {
        const timer = setTimeout(() => setShowToast(false), duration);
        return () => clearTimeout(timer);
      }
    }
  }, [connectionStatus, prevStatus, duration]);

  if (!showToast) return null;

  const config = STATUS_CONFIG[connectionStatus] || STATUS_CONFIG.disconnected;

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "12px 16px",
        backgroundColor: config.bgColor,
        border: `1px solid ${config.borderColor}`,
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        animation: "slideIn 0.3s ease",
      }}
    >
      <span style={{ color: config.color, fontSize: "16px" }}>
        {config.icon}
      </span>
      <span style={{ color: config.color, fontWeight: 500 }}>{message}</span>
      <button
        onClick={() => setShowToast(false)}
        style={{
          marginLeft: "8px",
          padding: "0",
          fontSize: "16px",
          color: config.color,
          backgroundColor: "transparent",
          border: "none",
          cursor: "pointer",
          opacity: 0.7,
        }}
      >
        ✕
      </button>
      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  );
};

/**
 * Hook to get connection status information
 */
export const useConnectionStatus = () => {
  const connectionStatus = useSelector(selectConnectionStatus);
  const retryCount = useSelector(selectRetryCount);
  const lastEventTime = useSelector(selectLastEventTime);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const isConnected = isOnline && connectionStatus === "connected";
  const isReconnecting = connectionStatus === "reconnecting";
  const hasFailed = connectionStatus === "failed";

  return {
    connectionStatus,
    isOnline,
    isConnected,
    isReconnecting,
    hasFailed,
    retryCount,
    lastEventTime,
    effectiveStatus: !isOnline ? "offline" : connectionStatus,
  };
};

export default ConnectionStatusBar;
