/**
 * useRealtime Hook
 *
 * Custom hook for managing realtime connection and subscriptions.
 * Provides easy access to connection state and event subscription.
 */

import { useEffect, useCallback, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { realtimeClient, ConnectionState } from "../services/realtimeClient";
import {
  selectConnectionStatus,
  selectIsConnected,
  selectCacheInvalidation,
  clearCacheInvalidation,
} from "../redux/features/realtime/realtimeSlice";
import { selectIsLoggedIn } from "../redux/features/auth/authSlice";
import { selectIsBootstrapped } from "../redux/features/dataCache/dataCacheSlice";

/**
 * Hook for realtime connection management
 *
 * NOTE: httpOnly cookies cannot be read from JavaScript.
 * The realtime connection uses cookie-based auth - cookies are
 * automatically included in WebSocket/SSE requests to the same origin.
 */
export const useRealtimeConnection = () => {
  const dispatch = useDispatch();
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const isBootstrapped = useSelector(selectIsBootstrapped);
  const connectionStatus = useSelector(selectConnectionStatus);
  const isConnected = useSelector(selectIsConnected);
  const hasConnected = useRef(false);

  useEffect(() => {
    // Connect when logged in, disconnect when logged out
    // We don't need to pass a token - the httpOnly cookie is automatically
    // sent with WebSocket handshake and SSE requests to same origin
    if (isLoggedIn && isBootstrapped && !hasConnected.current) {
      console.log(
        "[useRealtime] Bootstrap complete, initiating realtime connection"
      );
      realtimeClient.connect();
      hasConnected.current = true;
    } else if (!isLoggedIn && hasConnected.current) {
      console.log("[useRealtime] User logged out, disconnecting realtime");
      realtimeClient.disconnect();
      hasConnected.current = false;
    }

    // Cleanup on unmount
    return () => {
      // Don't disconnect on unmount - connection should persist across routes
    };
  }, [isLoggedIn, isBootstrapped]);

  // Handle online/offline
  useEffect(() => {
    const handleOnline = () => {
      if (isLoggedIn && isBootstrapped && !isConnected) {
        console.log("[useRealtime] Back online, reconnecting realtime");
        realtimeClient.connect();
      }
    };

    const handleOffline = () => {
      // Connection will automatically handle offline state
      console.log("[useRealtime] Went offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isLoggedIn, isBootstrapped, isConnected]);

  return {
    connectionStatus,
    isConnected,
  };
};

/**
 * Hook for subscribing to specific event types
 */
export const useRealtimeSubscription = (eventType, callback) => {
  useEffect(() => {
    if (!eventType || !callback) return;

    const unsubscribe = realtimeClient.subscribe(eventType, callback);
    return unsubscribe;
  }, [eventType, callback]);
};

/**
 * Hook for checking cache invalidation
 * Returns true if cache needs refresh
 */
export const useCacheInvalidation = (cacheKey) => {
  const dispatch = useDispatch();
  const cacheInvalidation = useSelector(selectCacheInvalidation);
  const isInvalid = cacheInvalidation[cacheKey] || false;

  const clearInvalidation = useCallback(() => {
    dispatch(clearCacheInvalidation(cacheKey));
  }, [dispatch, cacheKey]);

  return {
    isInvalid,
    clearInvalidation,
  };
};

/**
 * Hook that tracks cache staleness.
 *
 * Returns `isStale` so callers can show a visual indicator, but does NOT
 * auto-refetch.  Data is only refetched when the user explicitly clicks
 * a refresh button.
 */
export const useSmartFetch = (
  cacheKey,
  fetchAction,
  data,
  dependencies = []
) => {
  const dispatch = useDispatch();
  const { isInvalid, clearInvalidation } = useCacheInvalidation(cacheKey);

  // Expose staleness so UI can optionally display a "stale data" badge
  // without triggering a GET request.
  return {
    isStale: isInvalid,
    refresh: () => {
      dispatch(fetchAction);
      if (isInvalid) {
        clearInvalidation();
      }
    },
  };
};

/**
 * Hook for connection status indicator
 */
export const useConnectionIndicator = () => {
  const connectionStatus = useSelector(selectConnectionStatus);

  const getIndicatorProps = useCallback(() => {
    switch (connectionStatus) {
      case ConnectionState.CONNECTED:
        return {
          color: "green",
          text: "Connected",
          icon: "●",
        };
      case ConnectionState.CONNECTING:
      case ConnectionState.RECONNECTING:
        return {
          color: "yellow",
          text: "Connecting...",
          icon: "○",
        };
      case ConnectionState.DISCONNECTED:
        return {
          color: "gray",
          text: "Disconnected",
          icon: "○",
        };
      case ConnectionState.ERROR:
        return {
          color: "red",
          text: "Connection Error",
          icon: "✕",
        };
      default:
        return {
          color: "gray",
          text: "Unknown",
          icon: "?",
        };
    }
  }, [connectionStatus]);

  return {
    connectionStatus,
    ...getIndicatorProps(),
  };
};

export default useRealtimeConnection;
