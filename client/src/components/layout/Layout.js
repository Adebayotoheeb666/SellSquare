import React, { useEffect, useState, useRef } from "react";
import menu from "../../data/sidebar";
import SidebarItem from "./SidebarItem";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";
import notification from "../../assets/home/notification.svg";
import user from "../../assets/home/user555.svg";
import arrowdown from "../../assets/home/arrowdown.svg";
import logouticon from "../../assets/home/logout.svg";
import notificationsImg from "../../assets/home/notification-img.svg";
import cancelIcon from "../../assets/home/cancel-menu.svg";
import menuIcon from "../../assets/home/menu-icon.svg";
import cartIcon from "../../assets/home/cartIcon.svg";
import "./layout.css";
import { logoutUser } from "../../services/authService";
import {
  selectName,
  selectBusiness,
  selectLoggedInBusinessOwner,
  selectUser,
} from "../../redux/features/auth/authSlice";
import { useDispatch, useSelector } from "react-redux";
import {
  CALC_CART_ITEMS,
  selectCartItemsLength,
  selectIncompletePayments,
} from "../../redux/features/cart/cartSlice";
import AddProductsBtn from "../product/addProductsBtn/AddProductsBtn";
import { selectSavedStatus } from "../../redux/features/product/productSlice";
import usePaymentUpdate from "../../customHook/usePaymentUpdate";
import { GracePeriod, ExpiredBanner } from "../paymentUpdates/UpdatePayment";
import BottomNav from "./BottomNav";
import { useDataBootstrap } from "../../customHook/useDataBootstrap";
import useRefreshGuard from "../../customHook/useRefreshGuard";
import { resetSessionState } from "../../redux/sessionReset";

const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const name = useSelector(selectName);
  const business = useSelector(selectBusiness);
  const cartLength = useSelector(selectCartItemsLength);
  const incompletePayments = useSelector(selectIncompletePayments);
  const [showAddProductOptions, setShowAddProductOptions] = useState(false);
  const { cart } = useSelector((state) => state.cart);
  const admin = useSelector(selectLoggedInBusinessOwner);
  const [showNotification, setShowNotifications] = useState(false);
  const currentUser = useSelector(selectUser);
  const [showMenu, setShowMenu] = useState(false);
  const savedStatus = useSelector(selectSavedStatus);
  const isBusinessOwner = useSelector(selectLoggedInBusinessOwner);
  const { isInGracePeriod, isSubscriptionExpired } = usePaymentUpdate({
    currentUser,
  });

  // Session-scoped data bootstrap - fetches all core data once per login
  // This replaces the old useEffect that fetched data on every mount
  useDataBootstrap({
    userEmail: currentUser?.email,
    isAdmin: Boolean(admin),
  });

  // Guard against accidental page refreshes with warning message
  useRefreshGuard();
  const logout = async () => {
    // Call backend logout endpoint
    await logoutUser();

    await resetSessionState(dispatch);

    // Navigate to login page
    navigate("/login");
  };

  // Only calculate cart items when cart changes - this is a pure Redux calculation
  // No API call is made here
  const prevCartRef = useRef();
  useEffect(() => {
    // Only dispatch if cart reference has actually changed
    if (cart && prevCartRef.current !== cart) {
      prevCartRef.current = cart;
      dispatch(CALC_CART_ITEMS(cart));
    }
  }, [dispatch, cart]);

  let filteredPayments = incompletePayments.filter(
    (item) =>
      item?.payment?.paymentType === "part" &&
      item?.payment?.paymentStatus === "pending",
  );

  const addProductButtonIncludedRoutes = [
    "/inventory",
    "/inventory/",
    "/add-product",
    "/add-product-group",
    "/edit-product/",
    "/edit-product/group/",
    "/cart",
  ];

  const shouldShowAddProductsBtn = addProductButtonIncludedRoutes.some(
    (route) =>
      location.pathname === route || location.pathname.startsWith(route),
  );

  return (
    // layout
    <div className="layout">
      <div className={showMenu ? "sidebar show_menu" : "sidebar"}>
        <div className="sidebar-content">
          <div className="logo">
            <Link to="/">
              <img src={logo} alt="logo" />
            </Link>
          </div>

          {menu.map((item, index) => {
            return (
              <SidebarItem
                handleShowMenu={() => setShowMenu(!showMenu)}
                count={cartLength}
                count2={filteredPayments.length}
                key={index}
                item={item}
              />
            );
          })}

          <div className="logout-box">
            <Link onClick={logout}>
              <div className="sidebar-item s-parent">
                <div className="sidebar-title">
                  <span>
                    <div className="icon">
                      <img src={logouticon} alt="logout" />
                    </div>
                    <div className="title">LogOut</div>
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </div>
        <div onClick={() => setShowMenu(!showMenu)} className="cancel-menu">
          <img src={cancelIcon} alt="cancel" />
        </div>
      </div>
      <div className="wrap-header-nav">
        <section className="top-nav">
          {location.pathname === "/add-product-group" && (
            <span>{savedStatus}</span>
          )}
          <div className="notification">
            <div className="notification-dot"></div>
            <img
              onClick={() => setShowNotifications(!showNotification)}
              src={notification}
              alt="notification-icon"
            />
            {showNotification && (
              <div className="notifications">
                <img src={notificationsImg} alt="notifications img" />
                <div className="notifications-header">
                  <h3>Notifications</h3>
                </div>
                <div className="notifications-body">
                  <div>
                    <h4>No notifications ...</h4>
                  </div>
                  {/* <div>
                  <h4>Item 6785 has just 2 units left</h4>
                  <span>1 minute ago</span>
                </div>
                <div>
                  <h4>Item 6785 has just 2 units left</h4>
                  <span>1 minute ago</span>
                </div> */}
                </div>
              </div>
            )}
          </div>
          <div className="user-icon">
            <img
              className="user-img"
              src={business ? business.photo : user}
              alt="user"
            />
            <img src={arrowdown} alt="user" />
          </div>
        </section>

        <main
          style={{
            transition: "all .5s",
          }}
        >
          <div
            onClick={() => setShowMenu(!showMenu)}
            className="mobile_view_menu"
          >
            <img src={menuIcon} alt="menu" />
          </div>
          {isBusinessOwner && isInGracePeriod && <GracePeriod />}
          {isBusinessOwner && isSubscriptionExpired && (
            <ExpiredBanner isBusinessOwner={true} />
          )}
          {!isBusinessOwner && isSubscriptionExpired && (
            <ExpiredBanner isBusinessOwner={false} />
          )}
          <div className="user-informations">
            <div className="user-name-icon">
              <img src={business ? business.photo : user} alt="" />
              <div>
                <h1>
                  Hi, {name} <span>({currentUser?.name})</span>
                </h1>
                <p>Welcome to your work space</p>
              </div>
            </div>
            <div>
              {shouldShowAddProductsBtn && (
                <div className="add_btn_web_tab_view">
                  <AddProductsBtn />
                </div>
              )}

              <Link to="/cart">
                <div className="mobile_cart_display">
                  <img src={cartIcon} alt="cart" />
                  <div className="cart_count">{cartLength}</div>
                </div>
              </Link>
            </div>
          </div>
          {shouldShowAddProductsBtn && (
            <div className="add_btn_mobile_view">
              <AddProductsBtn />
            </div>
          )}

          <br />
          {children}
          <br />
          <br />
        </main>
      </div>
      <BottomNav />
    </div>
  );
};

export default Layout;
