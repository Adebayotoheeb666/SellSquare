import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import "./account.css";
import BusinessProfile from "./accComponents/BusinessProfile";
import Subscription from "./accComponents/Subscription";
import ManageStores from "./accComponents/ManageStores";
import SalesList from "./accComponents/SalesList";
import SubscribePage from "./accComponents/SubscribePage";
import ApiKeys from "./accComponents/ApiKeys";
import useRedirectLoggedOutUser from "../../../customHook/useRedirectLoggedOutUser";
import { Helmet } from "react-helmet";

export default function Account() {
  const [activeRoute, setActiveRoute] = useState("business-profile");

  const { id } = useParams();

  useEffect(() => {
    setActiveRoute(id || "business-profile");
  }, [id]);

  // Get dynamic page title
  const getPageLabel = () => {
    switch (activeRoute) {
      case "business-profile":
        return "Account | Business Profile";
      case "subscription":
        return "Account | Subscription";
      case "store":
        return "Account | Manage Stores";
      case "sales":
        return "Account | Staff";
      case "api-keys":
        return "Account | API Keys";
      default:
        return "Account | Business Profile";
    }
  };

  return (
    <div className="business-profile">
      <Helmet>
        <title>Account Settings | Sell Square - Business Profile & Subscription</title>
        <meta
          name="description"
          content="Manage your business profile, subscription plans, warehouses, and sales team. Update business information, add team members with role-based permissions, and choose from Free, Basic, Standard, or Professional plans."
        />
        <meta
          name="keywords"
          content="account settings, business profile, subscription management, team management, warehouse settings, sales representatives, business information, subscription plans, user permissions, business account"
        />
        <meta name="author" content="Sell Square" />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content="Account Settings | Sell Square" />
        <meta
          property="og:description"
          content="Manage your business profile, subscription, team members, and warehouse locations all in one place."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.sellsquarehub.com/accounts" />
        <meta property="og:site_name" content="Sell Square" />
        <meta
          property="og:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Account Settings | Sell Square" />
        <meta
          name="twitter:description"
          content="Manage business profile, subscription, team, and warehouses."
        />
        <meta
          name="twitter:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <link rel="canonical" href="https://www.sellsquarehub.com/accounts" />
      </Helmet>

      {activeRoute !== "subscribe" && (
        <div className="account-header">
          <h2 className="account-label">{getPageLabel()}</h2>
        </div>
      )}

      <div className="account-content">
        {activeRoute === "business-profile" && <BusinessProfile />}
        {activeRoute === "subscription" && <Subscription />}
        {activeRoute === "store" && <ManageStores />}
        {activeRoute === "sales" && <SalesList />}
        {activeRoute === "api-keys" && <ApiKeys />}
        {activeRoute === "subscribe" && <SubscribePage />}
      </div>
    </div>
  );
}
