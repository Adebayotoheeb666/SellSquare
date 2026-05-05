import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";
import "./Cart.scss";
import SiteNav from "../../../components/header/SiteNav";
import Footer from "../../../components/footer/Footer";
import productImg from "../../../assets/homepageicons/product-placeholder.jpg";
import removeIcon from "../../../assets/homepageicons/trash-icon.svg";
import joinImg from "../../../assets/homepageicons/joinImg.svg";
import buyerMarketplaceService from "../../../services/buyerMarketplaceService";
import { checkoutOrders, selectCheckoutLoading, selectCheckoutError } from "../../../redux/features/buyerOrders/buyerOrdersSlice";
import { selectIsBuyerAuthenticated, selectBuyer } from "../../../redux/features/buyerAuth/buyerAuthSlice";

const Cart = () => {
  const { productId, storeToken } = useParams();
  const navigate = useNavigate();
  const recentlyViewedRef = useRef(null);
  const dispatch = useDispatch();

  const checkoutLoading = useSelector(selectCheckoutLoading);
  const checkoutError = useSelector(selectCheckoutError);
  const isBuyerAuthenticated = useSelector(selectIsBuyerAuthenticated);
  const buyer = useSelector(selectBuyer);

  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timers, setTimers] = useState({});
  const [shippingAddress, setShippingAddress] = useState("");
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const autoReleasedRef = useRef(new Set());
  const [recentlyViewedProducts, setRecentlyViewedProducts] = useState([]);
  const [recentlyViewedLoading, setRecentlyViewedLoading] = useState(true);

  // Fetch recently viewed product details from API
  useEffect(() => {
    const fetchRecentlyViewed = async () => {
      setRecentlyViewedLoading(true);
      try {
        // Get IDs from localStorage (most recent first, max 10)
        const ids = JSON.parse(localStorage.getItem("recentlyViewedProducts") || "[]");
        if (!ids.length) {
          setRecentlyViewedProducts([]);
          setRecentlyViewedLoading(false);
          return;
        }
        // Fetch product details from API (assume endpoint exists)
        const response = await buyerMarketplaceService.getProductsByIds(ids.slice(0, 10));
        setRecentlyViewedProducts(response?.data?.data || []);
      } catch (err) {
        setRecentlyViewedProducts([]);
      } finally {
        setRecentlyViewedLoading(false);
      }
    };
    fetchRecentlyViewed();
  }, []);

  const loadCartHolds = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const response = await buyerMarketplaceService.getCartHolds();
      const holds = response?.data?.data || [];

      let displayItems = holds;
      if (productId) {
        displayItems = holds.filter((item) => item.productId === productId);
      }

      setCartItems(displayItems);
      setError(null);
    } catch (err) {
      console.error("Error loading cart holds:", err);
      if (!isBackground) setError("Failed to load cart. Please try again.");
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    loadCartHolds();
  }, [productId]);

  // Keep cart holds alive only while this page is active/visible.
  useEffect(() => {
    let intervalId = null;

    const sendHeartbeat = () => {
      if (document.visibilityState !== "visible") return;
      buyerMarketplaceService.refreshCartHolds().catch(() => { });
    };

    const startHeartbeat = () => {
      if (intervalId || document.visibilityState !== "visible") return;
      sendHeartbeat();
      intervalId = setInterval(sendHeartbeat, 60000);
    };

    const stopHeartbeat = () => {
      if (!intervalId) return;
      clearInterval(intervalId);
      intervalId = null;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        startHeartbeat();
      } else {
        stopHeartbeat();
      }
    };

    if (cartItems.length > 0) {
      startHeartbeat();
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      stopHeartbeat();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [cartItems.length]);

  const handleQuantityChange = async (holdId, productId, currentQuantity, change) => {
    try {
      const newQuantity = Math.max(1, currentQuantity + change);

      // Extract product ID properly
      const id = (typeof productId === "object" && productId._id) ? productId._id : productId;

      // Call API to update hold
      await buyerMarketplaceService.createOrUpdateHold({
        productId: id,
        quantity: newQuantity,
      });

      // Update local state
      setCartItems((prev) =>
        prev.map((item) => {
          if (item.holdId === holdId) {
            return { ...item, quantity: newQuantity };
          }
          return item;
        })
      );
    } catch (err) {
      console.error("Error updating quantity:", err);
      setError("Failed to update quantity. Please try again.");
    }
  };

  const handleRemoveItem = async (holdId, productId) => {
    try {
      // Use product._id or fallback to productId
      const id = (typeof productId === "object" && productId._id) ? productId._id : productId;

      // Call API to release hold
      await buyerMarketplaceService.releaseHold(id);

      // Update local state
      setCartItems((prev) => prev.filter((item) => item.holdId !== holdId));
    } catch (err) {
      console.error("Error removing item:", err);
      setError("Failed to remove item. Please try again.");
    }
  };

  // Timer effect to update countdown for each hold
  useEffect(() => {
    const timerInterval = setInterval(() => {
      const newTimers = {};
      cartItems.forEach((item) => {
        const expiresAt = new Date(item.expiresAt);
        const now = new Date();
        const diff = expiresAt - now;

        if (diff <= 0) {
          newTimers[item.holdId] = {
            minutes: 0,
            seconds: 0,
            expired: true,
          };
          if (!autoReleasedRef.current.has(item.holdId)) {
            autoReleasedRef.current.add(item.holdId);
            buyerMarketplaceService
              .releaseHold(item.productId)
              .then(() => loadCartHolds(true))
              .catch(() => { });
          }
        } else {
          const minutes = Math.floor(diff / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          newTimers[item.holdId] = {
            minutes,
            seconds,
            expired: false,
          };
        }
      });
      setTimers(newTimers);
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [cartItems]);

  const handleViewAllCart = () => {
    navigate("/marketplace/cart");
  };

  const handleBackToStore = () => {
    if (storeToken) {
      navigate(`/marketplace/store/${storeToken}`);
    } else {
      navigate("/marketplace");
    }
  };

  const handleScroll = (ref, direction) => {
    if (ref.current) {
      const scrollAmount = 260;
      ref.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => {
      const price = Number(item.productPrice || item.price || 0);
      return total + price * item.quantity;
    }, 0);
  };

  const calculateVAT = () => {
    return calculateSubtotal() * 0.075; // 7.5% VAT
  };

  const totalAmount = calculateSubtotal() + calculateVAT();

  const fwConfig = {
    public_key: process.env.REACT_APP_FLUTTERWAVE_PUBLIC_KEY,
    tx_ref: `ss_${Date.now()}`,
    amount: totalAmount,
    currency: "NGN",
    payment_options: "card,mobilemoney,ussd",
    customer: {
      email: buyer?.email || buyer?.buyerEmail || "buyer@example.com",
      name: buyer?.name || buyer?.username || "SellSquare Customer",
      phone_number: buyer?.phone || "",
    },
    customizations: {
      title: "SellSquare Marketplace",
      description: "Cart Checkout",
      logo: "https://res.cloudinary.com/dfrwntkjm/image/upload/v1721347620/logo_qbgiqq.png",
    },
  };

  const handleFlutterPayment = useFlutterwave(fwConfig);

  const handleCheckout = async () => {
    if (!isBuyerAuthenticated) {
      const redirectPath = window.location.pathname;
      navigate(`/marketplace/login?redirect_url=${encodeURIComponent(redirectPath)}`);
      return;
    }

    const hasExpiredItems = cartItems.some((item) => timers[item.holdId]?.expired);
    if (hasExpiredItems) {
      toast.error("Some cart reservations have expired. Please refresh your cart.");
      await loadCartHolds();
      return;
    }

    if (cartItems.length === 0) {
      toast.error("Your cart is empty. Add items before checkout.");
      return;
    }

    if (!shippingAddress.trim()) {
      toast.error("Please enter a shipping address.");
      return;
    }

    handleFlutterPayment({
      callback: async (response) => {
        closePaymentModal();
        if (response.status === "successful" || response.status === "completed") {
          try {
            await dispatch(
              checkoutOrders({
                paymentReference: response.transaction_id.toString(),
                shippingAddress: shippingAddress.trim(),
              })
            ).unwrap();

            toast.success("Checkout completed successfully! Redirecting to orders...");
            setShippingAddress("");
            setCartItems([]);

            setTimeout(() => {
              navigate("/marketplace/buyer/orders");
            }, 1500);
          } catch (err) {
            const errorMsg = typeof err === "string" ? err : "Checkout failed. Please try again.";
            toast.error(errorMsg);
          }
        } else {
          toast.error("Payment was not successful. Please try again.");
        }
      },
      onClose: () => {
        // User closed the modal
      },
    });
  };

  const StarRating = ({ rating }) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <svg
            key={i}
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6 0.5L7.34708 4.72746L11.7063 4.72746L8.17963 7.29508L9.52671 11.5225L6 8.95492L2.47329 11.5225L3.82037 7.29508L0.293661 4.72746L4.65292 4.72746L6 0.5Z"
              fill="#FF9E48"
            />
          </svg>
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <svg
            key={i}
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id={`half-${i}`}>
                <stop offset="50%" stopColor="#FF9E48" />
                <stop offset="50%" stopColor="#E5E7EB" />
              </linearGradient>
            </defs>
            <path
              d="M6 0.5L7.34708 4.72746L11.7063 4.72746L8.17963 7.29508L9.52671 11.5225L6 8.95492L2.47329 11.5225L3.82037 7.29508L0.293661 4.72746L4.65292 4.72746L6 0.5Z"
              fill={`url(#half-${i})`}
            />
          </svg>
        );
      } else {
        stars.push(
          <svg
            key={i}
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6 0.5L7.34708 4.72746L11.7063 4.72746L8.17963 7.29508L9.52671 11.5225L6 8.95492L2.47329 11.5225L3.82037 7.29508L0.293661 4.72746L4.65292 4.72746L6 0.5Z"
              fill="#E5E7EB"
            />
          </svg>
        );
      }
    }
    return <div className="star-rating">{stars}</div>;
  };

  return (
    <main className="cart-root">
      <div className="cart-top-hero">
        <SiteNav />
      </div>

      <section className="cart-section">
        <div className="cart-container">
          {/* Back to Store Button - Only show if viewing from a store link */}
          {storeToken && (
            <div className="cart-back-to-store">
              <button
                className="back-to-store-btn"
                onClick={handleBackToStore}
              >
                ← Back to Store View
              </button>
            </div>
          )}

          {/* Cart Items Section */}
          <div className="cart-items-section">
            {/* Add More Products button (for everyone) */}
            <div style={{ marginBottom: "16px", textAlign: "right" }}>
              <button
                className="add-more-products-btn"
                onClick={() => navigate("/marketplace")}
                style={{
                  background: "#FF9E48",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  padding: "8px 18px",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                + Add More Products
              </button>
            </div>
            <div className="cart-items-card">
              {loading ? (
                <div style={{ padding: "20px", textAlign: "center" }}>
                  <p>Loading cart...</p>
                </div>
              ) : error ? (
                <div style={{ padding: "20px", textAlign: "center", color: "red" }}>
                  <p>{error}</p>
                </div>
              ) : cartItems.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center" }}>
                  <p>Your cart is empty</p>
                </div>
              ) : (
                cartItems.map((item, index) => {
                  const timer = timers[item.holdId] || { minutes: 0, seconds: 0 };
                  const productName = item.productName || "Product";
                  const productPrice = item.productPrice || 0;
                  const productImage = item.productImage || productImg;

                  return (
                    <React.Fragment key={item.holdId}>
                      <div className="cart-item">
                        <img
                          src={productImage}
                          alt={productName}
                          className="cart-item-image"
                        />
                        <div className="cart-item-details">
                          <h4 className="cart-item-name">{productName}</h4>
                          <p className="cart-item-seller">
                            Sold by {item.businessName || "Seller"}
                          </p>
                          <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                            Reserved for {String(timer.minutes).padStart(2, "0")}:
                            {String(timer.seconds).padStart(2, "0")}
                            {timer.expired && <span style={{ color: "red" }}> (Expired)</span>}
                          </div>
                          <button
                            className="cart-item-remove"
                            onClick={() => handleRemoveItem(item.holdId, item.productId)}
                          >
                            <img src={removeIcon} alt="Remove" />
                            Remove
                          </button>
                        </div>
                        <div className="cart-item-quantity">
                          <button
                            onClick={() =>
                              handleQuantityChange(item.holdId, item.productId, item.quantity, -1)
                            }
                          >
                            -
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            onClick={() =>
                              handleQuantityChange(item.holdId, item.productId, item.quantity, 1)
                            }
                          >
                            +
                          </button>
                        </div>
                        <div className="cart-item-amount">
                          ₦{(productPrice * item.quantity).toLocaleString()}
                        </div>
                      </div>
                      {index < cartItems.length - 1 && (
                        <div className="cart-item-divider"></div>
                      )}
                    </React.Fragment>
                  );
                })
              )}

              {productId && (
                <button
                  className="view-all-cart-btn"
                  onClick={handleViewAllCart}
                >
                  Checkout other cart items
                </button>
              )}
            </div>

            {/* Recently Viewed */}
            <div className="cart-recommendations">
              <div className="recommendations-header">
                <h3>Recently Viewed</h3>
              </div>
              <div className="recommendations-carousel">
                <button
                  className="carousel-nav-btn prev"
                  onClick={() => handleScroll(recentlyViewedRef, "left")}
                >
                  &lt;
                </button>
                <div className="recommendations-list" ref={recentlyViewedRef}>
                  {recentlyViewedLoading ? (
                    <div style={{ padding: "20px", textAlign: "center" }}>Loading...</div>
                  ) : recentlyViewedProducts.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", color: "#888" }}>
                      No recently viewed products yet.
                    </div>
                  ) : (
                    recentlyViewedProducts.map((prod) => (
                      <div
                        key={prod._id}
                        className="recommendation-card"
                        onClick={() => {
                          if (storeToken) {
                            navigate(`/marketplace/store/${storeToken}/product/${prod._id}`);
                          } else {
                            navigate(`/marketplace/product/${prod._id}`);
                          }
                        }}
                      >
                        <div className="recommendation-image-container">
                          <img
                            src={prod.imageUrl || productImg}
                            alt={prod.name}
                            className="recommendation-image"
                          />
                        </div>
                        <div className="recommendation-details">
                          <h4 className="recommendation-name">{prod.name}</h4>
                          <div className="recommendation-price">
                            ₦{(prod.price || 0).toLocaleString()}
                          </div>
                          {prod.slashedPrice && (
                            <div className="recommendation-slashed-price">
                              ₦{prod.slashedPrice.toLocaleString()}
                            </div>
                          )}
                          <div className="recommendation-rating">
                            <StarRating rating={prod.rating || 0} />
                            <span className="recommendation-rating-text">
                              {prod.rating || 0} ({prod.reviews || 0})
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <button
                  className="carousel-nav-btn next"
                  onClick={() => handleScroll(recentlyViewedRef, "right")}
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>

          {/* Cart Summary Section */}
          <div className="cart-summary-section">
            <div className="cart-summary">
              <h3 className="summary-title">Cart Summary</h3>
              <div className="summary-row">
                <span className="summary-label">Subtotal</span>
                <span className="summary-value">
                  ₦{calculateSubtotal().toLocaleString()}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-label">VAT</span>
                <span className="summary-value">
                  ₦{calculateVAT().toLocaleString()}
                </span>
              </div>

              {/* Checkout Form Section */}
              {cartItems.length > 0 && isBuyerAuthenticated && (
                <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #e5e7eb" }}>
                  <h4 style={{ marginBottom: "12px", fontSize: "14px", fontWeight: "600" }}>
                    Checkout Details
                  </h4>

                  <div style={{ marginBottom: "12px" }}>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>
                      Shipping Address *
                    </label>
                    <textarea
                      placeholder="Enter your delivery address"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      disabled={checkoutLoading}
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #d1d5db",
                        borderRadius: "4px",
                        fontSize: "12px",
                        minHeight: "80px",
                        fontFamily: "inherit",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>
                </div>
              )}


              {checkoutError && (
                <div style={{ color: "red", fontSize: "12px", marginBottom: "12px", padding: "8px", backgroundColor: "#ffe6e6", borderRadius: "4px", marginTop: "12px" }}>
                  {checkoutError}
                </div>
              )}
              <button
                className="checkout-btn"
                onClick={handleCheckout}
                disabled={checkoutLoading || cartItems.length === 0 || cartItems.some((item) => timers[item.holdId]?.expired)}
                style={{
                  opacity: checkoutLoading || cartItems.length === 0 || cartItems.some((item) => timers[item.holdId]?.expired) ? 0.6 : 1,
                  cursor: checkoutLoading || cartItems.length === 0 || cartItems.some((item) => timers[item.holdId]?.expired) ? "not-allowed" : "pointer",
                  marginTop: "12px"
                }}
              >
                {checkoutLoading
                  ? "Processing..."
                  : isBuyerAuthenticated
                    ? "Checkout"
                    : "Sign In / Sign Up to Checkout"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="join-sellers-section">
        <div className="join-sellers-inner">
          <div className="join-sellers-box">
            <div className="join-media">
              <img src={joinImg} alt="sellers growing" />
            </div>
            <div className="join-content">
              <h3 className="join-title">
                Join The Train of Sellers Who Are Growing Their Businesses with{" "}
                <span className="join-brand">SellSquare</span>
              </h3>
              <div className="join-ctas">
                <a className="btn create-store" href="/signup">
                  Create My Free Store
                </a>
                <a className="btn explore-market" href="/marketplace">
                  Explore the Marketplace
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Cart;
