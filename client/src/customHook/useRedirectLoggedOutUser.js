import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  SET_LOGIN,
  selectIsLoggedIn,
} from "../redux/features/auth/authSlice";
import { toast } from "sonner";
import { resetSessionState } from "../redux/sessionReset";
import { hasAccessToken } from "../utils/authSession";

const useRedirectLoggedOutUser = (path) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentIsLoggedIn = useSelector(selectIsLoggedIn);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    // Track online/offline status changes
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const redirectLoggedOutUser = async () => {
      if (!navigator.onLine) {
        console.log("[Auth] User is offline, skipping auth redirect check");
        return;
      }

      if (hasRedirectedRef.current) {
        return;
      }

      const isLoggedIn = hasAccessToken();
      dispatch(SET_LOGIN(isLoggedIn));

      if (isLoggedIn) {
        hasRedirectedRef.current = false;
        return;
      }

      try {
        hasRedirectedRef.current = true;
        await resetSessionState(dispatch);
        toast.info("Session expired, please login to continue.");
        navigate(path);
      } catch (error) {
        console.error("[Auth] Error handling auth redirect:", error);
      }
    };

    const timer = setTimeout(redirectLoggedOutUser, 0);
    return () => clearTimeout(timer);
  }, [navigate, path, dispatch, isOnline, currentIsLoggedIn]);
};

export default useRedirectLoggedOutUser;
