import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { selectUser } from "../../redux/features/auth/authSlice";
import { selectIsBuyerAuthenticated } from "../../redux/features/buyerAuth/buyerAuthSlice";
import { logoutBuyer } from "../../redux/features/buyerAuth/buyerAuthSlice";
import { LOGOUT } from "../../redux/features/auth/authSlice";
import logo from "../../assets/logo2.png";
import { getLoginStatus } from "../../services/authService";
import buyerMarketplaceService from "../../services/buyerMarketplaceService";
import "./SiteNav.scss";

const SiteNav = () => {
    const currentUser = useSelector(selectUser);
    const isBuyerAuthenticated = useSelector(selectIsBuyerAuthenticated);
    const [isBusinessLoggedIn, setIsBusinessLoggedIn] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [cartCount, setCartCount] = useState(0);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        let mounted = true;
        async function check() {
            try {
                const status = await getLoginStatus();
                if (mounted) setIsBusinessLoggedIn(status);
            } catch (err) {
                if (mounted) setIsBusinessLoggedIn(false);
            }
        }
        check();
        return () => (mounted = false);
    }, [location.pathname]);

    const handleLogout = async () => {
        if (isBusinessLoggedIn) {
            await dispatch(LOGOUT());
            setIsBusinessLoggedIn(false);
            navigate("/login");
        }
        if (isBuyerAuthenticated) {
            await dispatch(logoutBuyer());
            navigate("/marketplace/login");
        }
    };

    useEffect(() => {
        let mounted = true;
        async function fetchCartCount() {
            try {
                const response = await buyerMarketplaceService.getCartHolds();
                const holds = response?.data?.data || [];
                if (mounted) setCartCount(holds.length);
            } catch {
                // silently ignore — cart count is non-critical
            }
        }
        fetchCartCount();
        return () => (mounted = false);
    }, [location.pathname, isBuyerAuthenticated]);

    const handleSectionClick = (e, sectionId) => {
        e.preventDefault();
        setMobileMenuOpen(false); // Close mobile menu when clicking

        // If we're already on the homepage, just scroll to the section
        if (location.pathname === "/") {
            const element = document.getElementById(sectionId);
            if (element) {
                element.scrollIntoView({ behavior: "smooth" });
            }
        } else {
            // Navigate to homepage with hash, then scroll after navigation
            navigate(`/#${sectionId}`);
        }
    };

    const handleNavLinkClick = () => {
        setMobileMenuOpen(false); // Close mobile menu when clicking any nav link
    };

    // Handle scrolling after navigation when hash is present
    useEffect(() => {
        if (location.hash) {
            const sectionId = location.hash.substring(1); // Remove the #
            setTimeout(() => {
                const element = document.getElementById(sectionId);
                if (element) {
                    element.scrollIntoView({ behavior: "smooth" });
                }
            }, 100); // Small delay to ensure page is loaded
        }
    }, [location]);

    return (
        <nav className="site-nav">
            <div className="nav-inner">
                <div className="nav-left">
                    <img src={logo} alt="sellsquare Logo" className="nav-logo" />
                    <Link className="brand" to="/">
                        <strong>Sellsquare</strong>
                    </Link>
                </div>

                <div className="nav-center">
                    <NavLink to="/" onClick={handleNavLinkClick}>Home</NavLink>
                    <NavLink to="/marketplace" onClick={handleNavLinkClick}>Marketplace</NavLink>
                    <NavLink to="/about-us" onClick={handleNavLinkClick}>About us</NavLink>
                    <a href="#features" onClick={(e) => handleSectionClick(e, "features")}>Features</a>
                    <NavLink to="/blog" onClick={handleNavLinkClick}>Blog</NavLink>
                    <a href="#pricing" onClick={(e) => handleSectionClick(e, "pricing")}>Pricing</a>
                    <NavLink to="/contact-us" onClick={handleNavLinkClick}>Contact us</NavLink>
                </div>

                <div className="nav-right">
                    <Link className="nav-cart-icon" to="/marketplace/cart" aria-label="View cart">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="9" cy="21" r="1" />
                            <circle cx="20" cy="21" r="1" />
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                        </svg>
                        {cartCount > 0 && (
                            <span className="nav-cart-badge">{cartCount > 99 ? "99+" : cartCount}</span>
                        )}
                    </Link>
                    {(() => {
                        const isMarketplace = location.pathname.startsWith("/marketplace");

                        if (isMarketplace) {
                            if (isBusinessLoggedIn) {
                                return (
                                    <div className="nav_auth_links">
                                        <Link className="btn primary small" to="/marketplace/orders">
                                            Orders
                                        </Link>
                                    </div>
                                );
                            }
                            if (isBuyerAuthenticated) {
                                return (
                                    <div className="nav_auth_links">
                                        <Link className="btn primary small" to="/marketplace/buyer/orders">
                                            Orders
                                        </Link>
                                    </div>
                                );
                            }
                            return null; // Guest on marketplace: Nothing
                        } else {
                            // All public pages (except marketplace)
                            if (isBusinessLoggedIn) {
                                return (
                                    <div className="nav_auth_links">
                                        <Link className="btn primary small" to="/dashboard">
                                            Dashboard
                                        </Link>
                                    </div>
                                );
                            }
                            // Guest or Buyer sees Login + Sign Up (for business)
                            return (
                                <div className="nav_auth_links">
                                    <Link className="btn ghost small" to="/login">
                                        Log in
                                    </Link>
                                    <Link className="btn primary small" to="/register">
                                        Sign up
                                    </Link>
                                </div>
                            );
                        }
                    })()}
                </div>

                {/* Mobile Menu Toggle */}
                <button
                    className="mobile-menu-toggle"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    aria-label="Toggle menu"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12h18M3 6h18M3 18h18" />
                    </svg>
                </button>
            </div>

            {/* Mobile Dropdown Menu */}
            {mobileMenuOpen && (
                <div className="mobile-menu-dropdown">
                    <div className="mobile-menu-header">
                        <div className="nav-left">
                            <img src={logo} alt="sellsquare Logo" className="nav-logo" />
                            <Link className="brand" to="/" onClick={handleNavLinkClick}>
                                <strong>Sellsquare</strong>
                            </Link>
                        </div>
                        <button
                            className="mobile-menu-close"
                            onClick={() => setMobileMenuOpen(false)}
                            aria-label="Close menu"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>

                    <div className="mobile-menu-items">
                        <NavLink to="/" onClick={handleNavLinkClick} className="mobile-menu-item">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                <polyline points="9 22 9 12 15 12 15 22" />
                            </svg>
                            <span>Home</span>
                        </NavLink>

                        <NavLink to="/marketplace" onClick={handleNavLinkClick} className="mobile-menu-item">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="9" cy="21" r="1" />
                                <circle cx="20" cy="21" r="1" />
                                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                            </svg>
                            <span>Marketplace</span>
                        </NavLink>

                        <NavLink to="/about-us" onClick={handleNavLinkClick} className="mobile-menu-item">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 16v-4M12 8h.01" />
                            </svg>
                            <span>About us</span>
                        </NavLink>

                        <a href="#features" onClick={(e) => handleSectionClick(e, "features")} className="mobile-menu-item">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                            <span>Features</span>
                        </a>

                        <NavLink to="/blog" onClick={handleNavLinkClick} className="mobile-menu-item">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <polyline points="10 9 9 9 8 9" />
                            </svg>
                            <span>Blog</span>
                        </NavLink>

                        <a href="#pricing" onClick={(e) => handleSectionClick(e, "pricing")} className="mobile-menu-item">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="1" x2="12" y2="23" />
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                            </svg>
                            <span>Pricing</span>
                        </a>

                        <NavLink to="/contact-us" onClick={handleNavLinkClick} className="mobile-menu-item">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            <span>Contact us</span>
                        </NavLink>

                        <Link to="/marketplace/cart" onClick={handleNavLinkClick} className="mobile-menu-item">
                            <span className="mobile-cart-icon-wrap">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="9" cy="21" r="1" />
                                    <circle cx="20" cy="21" r="1" />
                                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                                </svg>
                                {cartCount > 0 && (
                                    <span className="nav-cart-badge">{cartCount > 99 ? "99+" : cartCount}</span>
                                )}
                            </span>
                            <span>Cart{cartCount > 0 ? ` (${cartCount})` : ""}</span>
                        </Link>

                        {(() => {
                            const isMarketplace = location.pathname.startsWith("/marketplace");

                            if (isMarketplace) {
                                if (isBusinessLoggedIn) {
                                    return (
                                        <Link to="/marketplace/orders" onClick={handleNavLinkClick} className="mobile-menu-item">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                                                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                                                <path d="M9 14l2 2 4-4" />
                                            </svg>
                                            <span>Orders</span>
                                        </Link>
                                    );
                                }
                                if (isBuyerAuthenticated) {
                                    return (
                                        <Link to="/marketplace/buyer/orders" onClick={handleNavLinkClick} className="mobile-menu-item">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                                                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                                                <path d="M9 14l2 2 4-4" />
                                            </svg>
                                            <span>My Orders</span>
                                        </Link>
                                    );
                                }
                            } else {
                                if (isBusinessLoggedIn) {
                                    return (
                                        <Link to="/dashboard" onClick={handleNavLinkClick} className="mobile-menu-item">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="3" y="3" width="7" height="7" />
                                                <rect x="14" y="3" width="7" height="7" />
                                                <rect x="14" y="14" width="7" height="7" />
                                                <rect x="3" y="14" width="7" height="7" />
                                            </svg>
                                            <span>Admin Dashboard</span>
                                        </Link>
                                    );
                                }
                            }
                            return null;
                        })()}
                    </div>

                    {/* Auth Buttons at Bottom */}
                    {(() => {
                        const isMarketplace = location.pathname.startsWith("/marketplace");

                        if (!isBusinessLoggedIn && !isBuyerAuthenticated) {
                            if (isMarketplace) {
                                return null; // Guest on marketplace: Nothing
                            } else {
                                // All public pages: Login + Sign Up (for business)
                                return (
                                    <div className="mobile-menu-auth">
                                        <div className="mobile-auth-group">
                                            <div className="mobile-auth-btns">
                                                <Link className="btn ghost small" to="/login" onClick={handleNavLinkClick}>
                                                    Log in
                                                </Link>
                                                <Link className="btn primary small" to="/register" onClick={handleNavLinkClick}>
                                                    Sign up
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                        }

                        // If logged in, don't show logout here anymore as per user request
                        return null;
                    })()}
                </div>
            )}
        </nav>
    );
};

export default SiteNav;
