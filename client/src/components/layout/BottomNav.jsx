import React, { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logoutUser } from "../../services/authService";
import { resetSessionState } from "../../redux/sessionReset";
import "./BottomNav.css";

// Main navigation items - shown in bottom bar
const mainNavItems = [
    {
        title: "Dashboard",
        path: "/dashboard",
        icon: (
            <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
        ),
    },
    {
        title: "Inventory",
        path: "/inventory",
        icon: (
            <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 9H21" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9 3V9" stroke="currentColor" strokeWidth="1.5" />
            </svg>
        ),
        hasChildren: true,
    },
    {
        title: "Marketplace",
        path: "/marketplace",
        icon: (
            <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    d="M4 9H20V19C20 19.5523 19.5523 20 19 20H5C4.44772 20 4 19.5523 4 19V9Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                />
                <path
                    d="M3 9L5.5 4H18.5L21 9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M9 13H15"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                />
            </svg>
        ),
        hasChildren: true,
    },
    {
        title: "Expenses",
        path: "/expenses",
        icon: (
            <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M2 10H22" stroke="currentColor" strokeWidth="1.5" />
            </svg>
        ),
    },
    {
        title: "More",
        path: null,
        icon: (
            <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <circle cx="12" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="18" r="1.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
        ),
    },
];

// Items to show in the "More" menu (tooltip)
const moreMenuItems = [
    {
        title: "Cart",
        path: "/cart",
        icon: (
            <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path d="M4 4H2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M5 4L6.2 12.5C6.3 13.3 6.97 13.9 7.78 13.9H13.8C14.58 13.9 15.23 13.34 15.34 12.57L16 8H6.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="8" cy="16" r="1.2" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="14" cy="16" r="1.2" stroke="currentColor" strokeWidth="1.4" />
            </svg>
        ),
    },
    {
        title: "Fulfilments",
        path: "/fulfilments",
        icon: (
            <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path d="M3 6L10 3L17 6V14C17 14.55 16.55 15 16 15H4C3.45 15 3 14.55 3 14V6Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 15V10H12V15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15 10H17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M3 10H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
        ),
        hasChildren: true,
    },
    {
        title: "Account",
        path: "/accounts",
        icon: (
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M4 20C4 16.6863 6.68629 14 10 14H14C17.3137 14 20 16.6863 20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
        ),
        hasChildren: true,
    },
    {
        title: "Blog",
        path: "/blog",
        icon: (
            <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M6 8H14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M6 11H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
        ),
    },
    {
        title: "Customers",
        path: "/customers",
        icon: (
            <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <circle cx="5.3" cy="5.3" r="2.3" stroke="currentColor" strokeWidth="1.3" />
                <circle cx="11.2" cy="5.8" r="2.1" stroke="currentColor" strokeWidth="1.3" />
                <path d="M1.8 12.2C1.8 10.9 2.9 9.8 4.2 9.8H6.2C7.5 9.8 8.6 10.9 8.6 12.2V13.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M9.2 12.3C9.2 11.1 10.2 10.1 11.4 10.1H12C13.3 10.1 14.3 11.1 14.3 12.3V13.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
        ),
    },
    {
        title: "Activities",
        path: "/activities",
        icon: (
            <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    d="M14.7 8H12L10 14L6 2L4 8H1.3"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        ),
    },
    {
        title: "Log Out",
        path: "logout",
        icon: (
            <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    d="M6 14H3C2.73478 14 2.48043 13.8946 2.29289 13.7071C2.10536 13.5196 2 13.2652 2 13V3C2 2.73478 2.10536 2.48043 2.29289 2.29289C2.48043 2.10536 2.73478 2 3 2H6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M11 11L14 8L11 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M14 8H6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        ),
    },
];

// Inventory children items
const inventoryChildren = [
    {
        title: "Products",
        path: "/inventory",
        icon: (
            <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M2 8H14" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 2V14" stroke="currentColor" strokeWidth="1.4" />
            </svg>
        ),
    },
    {
        title: "Groups",
        path: "/inventory/product-groups",
        icon: (
            <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                <path d="M7 4.5H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M4.5 7V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
        ),
    },
    {
        title: "Sales",
        path: "/inventory/sales",
        icon: (
            <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path d="M2 10L6 6L9 9L14 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 4H14V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
    },
    {
        title: "Out of Stock",
        path: "/inventory/out-of-stock",
        icon: (
            <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path d="M3 3.5C3 3.22386 3.22386 3 3.5 3H10.3C10.43 3 10.5532 3.05089 10.6464 3.14292L13.3571 5.85355C13.4491 5.9468 13.5 6.07 13.5 6.2V12.5C13.5 12.7761 13.2761 13 13 13H3.5C3.22386 13 3 12.7761 3 12.5V3.5Z" stroke="currentColor" strokeWidth="1.4" />
                <path d="M3 6H11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="10.5" cy="9.5" r="0.8" fill="currentColor" />
                <path d="M4 2L12 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
        ),
    },
];

// Account children items
const accountChildren = [
    {
        title: "Business Profile",
        path: "/accounts/business-profile",
        icon: (
            <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    d="M7 1C4.79086 1 3 2.79086 3 5C3 7.20914 4.79086 9 7 9C9.20914 9 11 7.20914 11 5C11 2.79086 9.20914 1 7 1Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                />
                <path
                    d="M2 13C2 10.7909 4.23858 9 7 9C9.76142 9 12 10.7909 12 13"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    fill="none"
                />
            </svg>
        ),
    },
    {
        title: "Subscription",
        path: "/accounts/subscription",
        icon: (
            <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <rect
                    x="2"
                    y="3"
                    width="10"
                    height="8"
                    rx="1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                />
                <path
                    d="M4 3V2C4 1.44772 4.44772 1 5 1H9C9.55228 1 10 1.44772 10 2V3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                />
                <path
                    d="M7 7V9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                />
            </svg>
        ),
    },
    {
        title: "Manage Stores",
        path: "/accounts/store",
        icon: (
            <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    d="M2 5L7 2L12 5V11C12 11.5523 11.5523 12 11 12H3C2.44772 12 2 11.5523 2 11V5Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                />
                <path
                    d="M5 12V7H9V12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        ),
    },
    {
        title: "Staff",
        path: "/accounts/sales",
        icon: (
            <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <circle
                    cx="4"
                    cy="4"
                    r="2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                />
                <circle
                    cx="10"
                    cy="4"
                    r="2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                />
                <path
                    d="M1 12C1 10.3431 2.34315 9 4 9C5.65685 9 7 10.3431 7 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    fill="none"
                />
                <path
                    d="M7 12C7 10.3431 8.34315 9 10 9C11.6569 9 13 10.3431 13 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    fill="none"
                />
            </svg>
        ),
    },
    {
        title: "API Keys",
        path: "/accounts/api-keys",
        icon: (
            <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    d="M8.8 2.2C10.3464 2.2 11.6 3.4536 11.6 5C11.6 6.5464 10.3464 7.8 8.8 7.8C7.2536 7.8 6 6.5464 6 5C6 3.4536 7.2536 2.2 8.8 2.2Z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                />
                <path
                    d="M1.2 7H6"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                />
                <path
                    d="M3.2 9V7"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                />
                <path
                    d="M5 8.6V7"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                />
            </svg>
        ),
    },
];

// Marketplace children items
const marketplaceChildren = [
    {
        title: "Orders",
        path: "/marketplace/orders",
        icon: (
            <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M4 6H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M4 9H9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
        ),
    },
    {
        title: "Discounts",
        path: "/marketplace/discounts",
        icon: (
            <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <circle cx="5" cy="5" r="1.4" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="11" cy="11" r="1.4" stroke="currentColor" strokeWidth="1.4" />
                <path d="M11.5 4.5L4.5 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
        ),
    },
    {
        title: "Wallet",
        path: "/marketplace/wallet",
        icon: (
            <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <rect x="2" y="4" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M10 8H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
        ),
    },
    {
        title: "Setup",
        path: "/marketplace/setup",
        icon: (
            <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 2V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M8 12V14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M12 8H14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M2 8H4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
        ),
    },
];

// Fulfilments children items
const fulfilmentsChildren = [
    {
        title: "Pending",
        path: "/fulfilments",
        icon: (
            <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <circle
                    cx="7"
                    cy="7"
                    r="5.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                />
                <path
                    d="M7 4V7L9 9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        ),
    },
    {
        title: "Cleared",
        path: "/fulfilments/cleared",
        icon: (
            <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <polyline
                    points="2,7 5.5,10.5 12,3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                />
            </svg>
        ),
    },
];

const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch();
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipContent, setTooltipContent] = useState(null);
    const [tooltipTitle, setTooltipTitle] = useState(null);
    const [parentTitle, setParentTitle] = useState(null);

    const isActive = (itemPath) => {
        if (!itemPath) return false;
        return location.pathname === itemPath || location.pathname.startsWith(itemPath + '/');
    };

    const handleLogout = async () => {
        await logoutUser();
        await resetSessionState(dispatch);
        navigate("/login");
        setShowTooltip(false);
    };

    const handleNavItemClick = (item, e) => {
        e.preventDefault();

        if (item.title === "More") {
            setParentTitle(null);
            setTooltipContent(moreMenuItems);
            setTooltipTitle("More");
            setShowTooltip(true);
        } else if (item.hasChildren) {
            // Show children in tooltip
            const children =
                item.title === "Inventory"
                    ? inventoryChildren
                    : item.title === "Marketplace"
                            ? marketplaceChildren
                        : item.title === "Fulfilments"
                            ? fulfilmentsChildren
                            : [];
            setParentTitle(null);
            setTooltipContent(children);
            setTooltipTitle(item.title);
            setShowTooltip(true);
        } else {
            // Navigate directly
            navigate(item.path);
            setShowTooltip(false);
        }
    };

    const handleTooltipItemClick = (item) => {
        if (item.path === "logout") {
            // Handle logout
            handleLogout();
        } else if (item.hasChildren) {
            // Show children of this item
            const children =
                item.title === "Inventory"
                    ? inventoryChildren
                    : item.title === "Fulfilments"
                        ? fulfilmentsChildren
                        : item.title === "Account"
                            ? accountChildren
                        : item.title === "Marketplace"
                            ? marketplaceChildren
                        : [];
            setParentTitle(item.title);
            setTooltipContent(children);
            setTooltipTitle(item.title);
        } else {
            // Navigate directly
            navigate(item.path);
            setShowTooltip(false);
        }
    };

    const handleBackArrow = () => {
        if (parentTitle) {
            // Go back to more menu
            setParentTitle(null);
            setTooltipContent(moreMenuItems);
            setTooltipTitle("More");
        } else {
            // Close tooltip
            setShowTooltip(false);
        }
    };

    return (
        <>
            {/* Bottom Navigation Bar */}
            <nav className="bottom-nav">
                <div className="bottom-nav-container">
                    {mainNavItems.map((item, index) => (
                        <button
                            key={index}
                            className={`bottom-nav-item ${isActive(item.path) ? 'active' : ''}`}
                            onClick={(e) => handleNavItemClick(item, e)}
                            title={item.title}
                        >
                            <div className="nav-icon">{item.icon}</div>
                            <span className="nav-label">{item.title}</span>
                        </button>
                    ))}
                </div>
            </nav>

            {/* Tooltip Overlay */}
            {showTooltip && (
                <div className="bottom-nav-overlay" onClick={() => setShowTooltip(false)}>
                    <div className="bottom-nav-tooltip" onClick={(e) => e.stopPropagation()}>
                        {/* Tooltip Header */}
                        <div className="tooltip-header">
                            {parentTitle && (
                                <button className="back-arrow" onClick={handleBackArrow}>
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <path d="M19 12H5M12 19l-7-7 7-7" />
                                    </svg>
                                </button>
                            )}
                            <h3>{parentTitle || tooltipTitle}</h3>
                        </div>

                        {/* Tooltip Content */}
                        <div className="tooltip-content">
                            {tooltipContent &&
                                tooltipContent.map((item, index) => (
                                    <button
                                        key={index}
                                        className="tooltip-item"
                                        onClick={() => handleTooltipItemClick(item)}
                                    >
                                        <div className="tooltip-item-icon">{item.icon}</div>
                                        <span className="tooltip-item-label">{item.title}</span>
                                        {item.hasChildren && (
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 16 16"
                                                fill="none"
                                                className="tooltip-arrow"
                                            >
                                                <path
                                                    d="M6 12L12 8L6 4"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        )}
                                    </button>
                                ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default BottomNav;
