import React from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { selectIsBuyerAuthenticated } from "../redux/features/buyerAuth/buyerAuthSlice";

/**
 * BuyerProtectedRoute
 *
 * Component that protects buyer-only routes.
 * Redirects to buyer login if not authenticated.
 */
const BuyerProtectedRoute = ({ children }) => {
  const isBuyerAuthenticated = useSelector(selectIsBuyerAuthenticated);

  if (!isBuyerAuthenticated) {
    return <Navigate to="/marketplace/login" replace />;
  }

  return children;
};

export default BuyerProtectedRoute;
