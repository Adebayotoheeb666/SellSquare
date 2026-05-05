import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  ScrollRestoration,
  Outlet,
} from "react-router-dom";
import Login from "./pages/product/auth/Login";
import Register from "./pages/product/auth/Register";
import Forgot from "./pages/product/auth/Forgot";
import Reset from "./pages/product/auth/Reset";
import Dashboard from "./pages/product/dashboard/Dashboard";
import Layout from "./components/layout/Layout";
import axios from "axios";
import { Toaster } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import { selectLoggedInBusinessOwner } from "./redux/features/auth/authSlice";
import AddProduct from "./pages/product/addProduct/AddProduct";
import EditProduct from "./pages/product/editProduct/EditProduct";
import ContactPage from "./pages/web/Contact/Contact";
import Cart from "./pages/product/cart/Cart";
import Blog from "./pages/web/Blog/Blog";
import BlogPost from "./pages/web/Blog/BlogPost";
import AboutPage from "./pages/web/About/About";
import Confirm from "./pages/product/auth/Confirm";
import SuccessRegistered from "./pages/product/auth/registerComponents/SuccessRegistered";
import Inventory from "./pages/product/inventory/Inventory";
import Customers from "./pages/product/customers/Customers";
import Account from "./pages/product/accounts/Account";
import AddProductGroup from "./pages/product/addProduct/AddProductGroup";
import GroupItem from "./components/product/productGroupList/GroupItem";
import ProductDetail from "./pages/product/products/ProductDetail";
import Fulfilment from "./pages/product/fulfilment/Fulfilment";
import Policy from "./pages/web/Policy/Policy";
import Terms from "./pages/web/Terms/Terms";
import ScrollToTop from "./components/scrollToTop/ScrollToTop";
import Admin from "./pages/product/admin/Admin";
import EditProductGroup from "./pages/product/editProduct/EditProductGroup";
import BusinessActivities from "./pages/product/activities/BusinessActivities";
import Homepage from "./pages/web/Home/Homepage";
import NotFound from "./pages/web/NotFound/NotFound";
import Marketplace from "./pages/web/Marketplace/Marketplace";
import MarketplaceProductDetail from "./pages/web/Marketplace/ProductDetail";
import MarketplaceCart from "./pages/web/Marketplace/Cart";
import BuyerLogin from "./pages/web/Marketplace/BuyerLogin";
import BuyerRegister from "./pages/web/Marketplace/BuyerRegister";
import OfflineIndicator from "./components/offlineIndicator/OfflineIndicator";
import MarketingInterns from "./pages/web/MarketingInterns/MarketingInterns";
import BriefPage from "./pages/web/MarketingInterns/BriefPage";
import Expenses from "./pages/product/expenses/Expenses";
import MarketplaceOrders from "./pages/product/marketplace/Orders";
import MarketplaceOrderDetail from "./pages/product/marketplace/OrderDetail";
import MarketplaceDiscounts from "./pages/product/marketplace/Discounts";
import MarketplaceDiscountForm from "./pages/product/marketplace/DiscountForm";
import MarketplaceDiscountDetail from "./pages/product/marketplace/DiscountDetail";
import MarketplaceWallet from "./pages/product/marketplace/Wallet";
import MarketplaceSetup from "./pages/product/marketplace/Setup";
import InternalOrderDetail from "./pages/product/marketplace/InternalOrderDetail";
import BuyerOrders from "./pages/web/Marketplace/BuyerOrders";
import BuyerOrderDetail from "./pages/web/Marketplace/BuyerOrderDetail";
import BuyerWallet from "./pages/web/Marketplace/BuyerWallet";
import BuyerProtectedRoute from "./components/BuyerProtectedRoute";
import { restoreBuyerSession } from "./redux/features/buyerAuth/buyerAuthSlice";
import { clearAccessToken } from "./utils/authSession";
import { resetSessionState } from "./redux/sessionReset";
import { store } from "./redux/store";

/**
 * Protected Layout Wrapper
 *
 * This component wraps the Layout and uses Outlet to render child routes.
 * By using this pattern, the Layout component only mounts ONCE and persists
 * across all protected route navigations. This is critical for:
 *
 * 1. Preventing data re-fetching on navigation
 * 2. Keeping WebSocket connections stable
 * 3. Maintaining bootstrap data across the session
 * 4. Avoiding unnecessary component remounts
 */
const ProtectedLayout = () => {
  const admin = useSelector(selectLoggedInBusinessOwner);
  return (
    <Layout>
      <Outlet context={{ admin }} />
    </Layout>
  );
};

axios.defaults.withCredentials = true;

// Track if a redirect is in progress to prevent multiple redirects
let isRedirecting = false;

// Add axios interceptor to handle authentication errors globally
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Ensure error.response exists for network errors
    if (!error.response) {
      // Network error or request was made but no response received
      error.response = {
        status: 0,
        data: {
          message:
            error.message || "Network error. Please check your connection.",
        },
      };
      return Promise.reject(error);
    }

    // Ensure error.response.data exists to prevent "Unexpected token u in JSON" errors
    if (!error.response.data) {
      error.response.data = { message: error.message || "An error occurred" };
    }

    // Handle 401 errors (unauthorized)
    if (error.response.status === 401) {
      // Don't redirect for login status check endpoint - that's expected to return false when not logged in
      const requestUrl = error.config?.url || "";
      if (
        requestUrl.includes("/loggedin") ||
        requestUrl.includes("/login-status")
      ) {
        console.log(
          "[Auth] Login status check returned 401 - user not logged in"
        );
        return Promise.reject(error);
      }

      // Don't redirect if already redirecting
      if (isRedirecting) {
        return Promise.reject(error);
      }

      // Check if we're not already on the login page to avoid redirect loops
      const currentPath = window.location.pathname;
      const isAuthPage =
        currentPath.includes("/login") ||
        currentPath.includes("/register") ||
        currentPath.includes("/forgot") ||
        currentPath.includes("/resetpassword");

      // Don't redirect from public pages
      const isPublicPage =
        currentPath === "/" ||
        currentPath.includes("/blog") ||
        currentPath.includes("/about") ||
        currentPath.includes("/contact") ||
        currentPath.includes("/marketplace") ||
        currentPath.includes("/policy") ||
        currentPath.includes("/terms");

      if (!isAuthPage && !isPublicPage) {
        console.log(
          "[Auth] 401 error on protected route, redirecting to login"
        );
        isRedirecting = true;
        clearAccessToken();
        resetSessionState(store.dispatch);

        // Small delay to prevent race conditions
        setTimeout(() => {
          window.location.href = `/login?redirect_url=${encodeURIComponent(
            currentPath
          )}`;
        }, 100);
      }
    }

    return Promise.reject(error);
  }
);

// Realtime connection component - manages WebSocket/SSE lifecycle
function RealtimeConnectionManager() {
  const { useRealtimeConnection } = require("./customHook/useRealtime");
  useRealtimeConnection();
  return null;
}

function App() {
  const admin = useSelector(selectLoggedInBusinessOwner);
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(restoreBuyerSession());
  }, [dispatch]);

  // useEffect(() => {
  //   const userAgent = window.navigator.userAgent;
  //   if (/iPhone|iPad|iPod/.test(userAgent)) {
  //     // Adjust the viewport meta tag for iOS devices to prevent auto-zoom
  //     const viewportMeta = document.querySelector('meta[name="viewport"]');
  //     if (viewportMeta) {
  //       viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
  //     }
  //   }
  // }, []);

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <OfflineIndicator />
      <ScrollToTop />
      {/* Initialize realtime connection for logged-in users */}
      <RealtimeConnectionManager />
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/marketplace/store/:storeToken" element={<Marketplace />} />
        <Route path="/marketplace/store/:storeToken/cart" element={<MarketplaceCart />} />
        <Route path="/marketplace/store/:storeToken/product/:productId" element={<MarketplaceProductDetail />} />
        <Route path="/marketplace/login" element={<BuyerLogin />} />
        <Route path="/marketplace/register" element={<BuyerRegister />} />
        <Route
          path="/marketplace/product/:productId"
          element={<MarketplaceProductDetail />}
        />
        <Route
          path="/marketplace/cart/:productId"
          element={<MarketplaceCart />}
        />
        <Route path="/marketplace/cart" element={<MarketplaceCart />} />
        <Route
          path="/marketplace/buyer/orders"
          element={
            <BuyerProtectedRoute>
              <BuyerOrders />
            </BuyerProtectedRoute>
          }
        />
        <Route
          path="/marketplace/buyer/orders/:orderId"
          element={
            <BuyerProtectedRoute>
              <BuyerOrderDetail />
            </BuyerProtectedRoute>
          }
        />
        <Route
          path="/marketplace/buyer/wallet"
          element={
            <BuyerProtectedRoute>
              <BuyerWallet />
            </BuyerProtectedRoute>
          }
        />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register/success" element={<SuccessRegistered />} />
        <Route path="/forgot" element={<Forgot />} />
        <Route path="/forgot/confirm" element={<Confirm />} />
        <Route path="/resetpassword/:resetToken" element={<Reset />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:id" element={<BlogPost />} />
        <Route path="/about-us" element={<AboutPage />} />
        <Route path="/contact-us" element={<ContactPage />} />
        <Route path="/marketing-interns" element={<MarketingInterns />} />
        <Route path="/marketing-interns/brief/:token" element={<BriefPage />} />
        <Route path="/our-policy" element={<Policy />} />
        <Route path="/terms-and-agreement" element={<Terms />} />

        {/* Protected routes - Layout mounts ONCE and persists across navigation */}
        <Route element={<ProtectedLayout />}>
          <Route path="/admin" element={<Admin />} />
          <Route path="/activities" element={<BusinessActivities />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/inventory/product-group/:id" element={<GroupItem />} />
          <Route path="/inventory/:id" element={<Inventory />} />
          <Route path="/inventory/product/:id" element={<ProductDetail />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/accounts" element={<Account />} />
          <Route path="/accounts/:id" element={<Account />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/add-product" element={<AddProduct />} />
          <Route path="/add-product-group" element={<AddProductGroup />} />
          <Route path="/edit-product/:id" element={<EditProduct />} />
          <Route
            path="/edit-product/group/:id"
            element={<EditProductGroup />}
          />
          <Route path="/cart" element={<Cart />} />
          <Route path="/fulfilments" element={<Fulfilment />} />
          <Route path="/fulfilments/:id" element={<Fulfilment />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/marketplace/orders" element={<MarketplaceOrders />} />
          <Route
            path="/marketplace/orders/:orderId"
            element={<MarketplaceOrderDetail />}
          />
          <Route
            path="/marketplace/buyer-orders/:orderId"
            element={<InternalOrderDetail />}
          />
          <Route
            path="/marketplace/discounts"
            element={<MarketplaceDiscounts />}
          />
          <Route
            path="/marketplace/discounts/create"
            element={<MarketplaceDiscountForm />}
          />
          <Route
            path="/marketplace/discounts/:id"
            element={<MarketplaceDiscountDetail />}
          />
          <Route
            path="/marketplace/discounts/:id/edit"
            element={<MarketplaceDiscountForm />}
          />
          <Route path="/marketplace/wallet" element={<MarketplaceWallet />} />
          <Route path="/marketplace/setup" element={<MarketplaceSetup />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
