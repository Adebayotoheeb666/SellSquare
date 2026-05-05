import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  selectBuyer,
  logoutBuyer,
} from "../../redux/features/buyerAuth/buyerAuthSlice";
import logo from "../../assets/logo.png";
import notification from "../../assets/home/notification.svg";
import user from "../../assets/home/user555.svg";
import arrowdown from "../../assets/home/arrowdown.svg";
import cancelIcon from "../../assets/home/cancel-menu.svg";
import menuIcon from "../../assets/home/menu-icon.svg";
import logouticon from "../../assets/home/logout.svg";
import notificationsImg from "../../assets/home/notification-img.svg";
import "./layout.css";

const BuyerLayout = ({ children }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const buyer = useSelector(selectBuyer);
  const [showMenu, setShowMenu] = useState(false);
  const [showNotification, setShowNotifications] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const handleLogout = async () => {
    await dispatch(logoutBuyer());
    navigate("/marketplace/login");
  };

  const buyerMenuItems = [
    {
      title: "Marketplace",
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2.5 5H13.5V12.5C13.5 12.7761 13.2761 13 13 13H3C2.72386 13 2.5 12.7761 2.5 12.5V5Z"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M2 5L3.5 2.5H12.5L14 5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6 8.5H10"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      ),
      path: "/marketplace",
    },
    {
      title: "Orders",
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="2"
            y="3"
            width="12"
            height="10"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path d="M2 7H14" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M5 10H11"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      ),
      path: "/marketplace/buyer/orders",
    },
    {
      title: "Wallet",
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="2"
            y="3"
            width="12"
            height="10"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M12 8H14"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      ),
      path: "/marketplace/buyer/wallet",
    },
  ];

  return (
    <div className="layout">
      {/* Sidebar */}
      <div className={showMenu ? "sidebar show_menu" : "sidebar"}>
        <div className="sidebar-content">
          <div className="logo">
            <Link to="/">
              <img src={logo} alt="logo" />
            </Link>
          </div>

          {/* Buyer Menu Items */}
          {buyerMenuItems.map((item, index) => (
            <Link
              key={index}
              to={item.path}
              className="sidebar-menu-link"
              onClick={() => setShowMenu(false)}
            >
              <div className="sidebar-item s-parent">
                <div className="sidebar-title">
                  <span>
                    <div className="icon">{item.icon}</div>
                    <div className="title">{item.title}</div>
                  </span>
                </div>
              </div>
            </Link>
          ))}

          {/* Logout */}
          <div className="logout-box">
            <Link onClick={handleLogout}>
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

      {/* Main Content */}
      <div className="wrap-header-nav">
        {/* Top Navigation */}
        <section className="top-nav">
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
                </div>
              </div>
            )}
          </div>

          {/* User Dropdown */}
          <div className="user-icon" onClick={() => setShowUserDropdown(!showUserDropdown)}>
            <img
              className="user-img"
              src={buyer?.photo || user}
              alt="user"
            />
            <span className="user-name">{buyer?.firstName || 'User'}</span>
            <img src={arrowdown} alt="dropdown" />
            {showUserDropdown && (
              <div className="buyer-dropdown-menu">
                <div className="dropdown-item">
                  <span>{buyer?.email || 'user@example.com'}</span>
                </div>
                <button
                  className="dropdown-logout"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLogout();
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Page Content */}
        <main>
          <div
            onClick={() => setShowMenu(!showMenu)}
            className="mobile_view_menu"
          >
            <img src={menuIcon} alt="menu" />
          </div>

          {children}
        </main>
      </div>
    </div>
  );
};

export default BuyerLayout;
