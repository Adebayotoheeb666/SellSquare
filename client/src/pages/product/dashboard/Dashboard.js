import React from "react";
import { useDispatch, useSelector } from "react-redux";
import ProductList from "../../../components/product/productList/ProductList";
import useRedirectLoggedOutUser from "../../../customHook/useRedirectLoggedOutUser";
import {
  selectIsLoggedIn,
  selectLoggedInBusinessOwner,
  selectUser,
} from "../../../redux/features/auth/authSlice";
import {
  getProducts,
  getSales,
  getOutOfStock,
  getAllProductGroups,
} from "../../../redux/features/product/productSlice";
import { useParams } from "react-router-dom";
import BusinessSummary from "../../../components/businessSummary/businessSummary";
import { getCart } from "../../../redux/features/cart/cartSlice";
import { Helmet } from "react-helmet";

const Dashboard = () => {
  const dispatch = useDispatch();
  const admin = useSelector(selectLoggedInBusinessOwner);

  const { id } = useParams();

  const isLoggedIn = useSelector(selectIsLoggedIn);
  const { isError, message } = useSelector((state) => state.product);

  const user = useSelector(selectUser);

  if (isError) {
    console.log(message);
  }

  return (
    <div>
      <Helmet>
        <title>Dashboard | Sell Square - Business Analytics & Insights</title>
        <meta
          name="description"
          content="Comprehensive business dashboard with real-time analytics. View total products, sales and profit graphs, low stock alerts, top-selling products, and complete business metrics. Make data-driven decisions for your SME."
        />
        <meta
          name="keywords"
          content="business dashboard, sales analytics, inventory dashboard, profit tracking, business metrics, real-time inventory, stock management, sales reports, business intelligence, SME analytics, product performance"
        />
        <meta name="author" content="Sell Square" />
        <meta name="robots" content="index, follow" />
        <meta
          property="og:title"
          content="Dashboard | Sell Square - Business Analytics & Real-Time Metrics"
        />
        <meta
          property="og:description"
          content="Monitor your business performance with comprehensive analytics: sales graphs, profit tracking, inventory levels, top products, and more. All your business metrics in one place."
        />
        <meta property="og:type" content="website" />
        <meta
          property="og:url"
          content="https://www.sellsquarehub.com/dashboard"
        />
        <meta property="og:site_name" content="Sell Square" />
        <meta
          property="og:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Dashboard | Sell Square - Business Analytics"
        />
        <meta
          name="twitter:description"
          content="Complete business overview: sales, profit, inventory, and performance metrics in real-time."
        />
        <meta
          name="twitter:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <link rel="canonical" href="https://www.sellsquarehub.com/dashboard" />
      </Helmet>
      <BusinessSummary
        // products={products}
        // productGroups={allProductGroups}
        admin={admin}
        user={user}
      />
    </div>
  );
};

export default Dashboard;
