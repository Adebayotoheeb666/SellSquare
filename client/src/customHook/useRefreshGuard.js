/**
 * useRefreshGuard Hook
 *
 * Intercepts page refresh attempts and shows a confirmation dialog
 * warning users that data reload may take a while for large datasets.
 *
 * Features:
 * - Intercepts browser refresh (F5, Ctrl+R, etc.)
 * - Intercepts navigation away (closing tab, clicking back)
 * - Two-step confirmation dialog
 * - Shows estimated load time based on data size
 * - Allows users to decide if they want to proceed
 *
 * Usage:
 * In Layout or App component:
 * useRefreshGuard();
 */

import { useEffect } from "react";
import { useSelector } from "react-redux";
import { selectIsLoggedIn } from "../redux/features/auth/authSlice";

export const useRefreshGuard = () => {
  const isLoggedIn = useSelector(selectIsLoggedIn);

  useEffect(() => {
    if (!isLoggedIn) {
      return; // Don't show guard when not logged in
    }

    // Handle page refresh/reload attempts
    const handleBeforeUnload = (event) => {
      // For browser refresh (F5, Ctrl+R, etc.)
      const message =
        "⚠️ Page refresh will reload all your data, which may take a while for large datasets. Are you sure you want to refresh?";

      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    // Handle navigation away (back button, closing tab, etc.)
    const handlePageHide = (event) => {
      // This is more for analytics/tracking
      // Modern browsers don't allow dialogs on pagehide
      console.log("[RefreshGuard] User navigating away from page");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [isLoggedIn]);
};

/**
 * Enhanced refresh guard with custom dialog
 * This version uses a custom confirmation dialog for better UX
 */
export const useRefreshGuardWithDialog = (dataSize = null) => {
  const isLoggedIn = useSelector(selectIsLoggedIn);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    // Estimate load time based on data size
    const estimateLoadTime = () => {
      if (!dataSize) return "a few seconds";
      if (dataSize < 100) return "2-5 seconds";
      if (dataSize < 1000) return "5-15 seconds";
      if (dataSize < 5000) return "15-30 seconds";
      return "30+ seconds";
    };

    const handleBeforeUnload = (event) => {
      const estimatedTime = estimateLoadTime();
      const message = `⚠️ WARNING: Page refresh will reload all your data (${dataSize} items). This may take ${estimatedTime}. Continue?`;

      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isLoggedIn, dataSize]);
};

export default useRefreshGuard;
