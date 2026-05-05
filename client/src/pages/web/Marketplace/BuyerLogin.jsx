import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Helmet } from "react-helmet";
import { toast } from "sonner";
import {
  loginBuyer,
  selectBuyer,
  selectBuyerLoading,
  selectBuyerError,
  clearBuyerError,
} from "../../../redux/features/buyerAuth/buyerAuthSlice";
import { LOGOUT } from "../../../redux/features/auth/authSlice";
import SiteNav from "../../../components/header/SiteNav";
import Footer from "../../../components/footer/Footer";
import "./BuyerAuth.scss";

// Eye Icon SVG Component
const EyeIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M10 4C4.5 4 2 10 2 10C2 10 4.5 16 10 16C15.5 16 18 10 18 10C18 10 15.5 4 10 4Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="10"
      cy="10"
      r="3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BuyerLogin = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  
  const buyer = useSelector(selectBuyer);
  const isLoading = useSelector(selectBuyerLoading);
  const error = useSelector(selectBuyerError);

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (buyer) {
      const redirectUrl = new URLSearchParams(location.search).get("redirect_url") || "/marketplace/buyer/orders";
      navigate(redirectUrl);
    }
  }, [buyer, navigate, location]);

  // Show error toast
  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearBuyerError());
    }
  }, [error, dispatch]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.email || !formData.password) {
      return toast.error("Please fill in all fields");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return toast.error("Please enter a valid email address");
    }

    // Clear any existing seller session
    dispatch(LOGOUT());
    // Dispatch login thunk
    dispatch(loginBuyer(formData));
  };

  const handleGoogleSignIn = () => {
    // Clear any existing seller session
    dispatch(LOGOUT());
    const redirectUrl =
      new URLSearchParams(location.search).get("redirect_url") ||
      "/marketplace/buyer/orders";
    const oauthStart = `/api/buyer/auth/google/start?redirect_url=${encodeURIComponent(
      redirectUrl
    )}`;
    window.location.href = oauthStart;
  };

  useEffect(() => {
    const oauthError = new URLSearchParams(location.search).get("oauth_error");
    if (oauthError) {
      toast.error("Google sign-in failed. Please try again.");
    }
  }, [location.search]);

  return (
    <main className="buyer-auth-root">
      <Helmet>
        <title>Buyer Login - Sell Square Marketplace</title>
        <meta name="description" content="Login to your Sell Square buyer account to shop from local businesses." />
      </Helmet>
      
      <div className="buyer-auth-top-hero">
        <SiteNav />
      </div>

      <section className="buyer-auth-content-section">
        <div className="buyer-auth-container">
          <div className="buyer-auth-wrapper">
            {/* Left Side - Form */}
            <div className="buyer-auth-form-wrapper">
              <div className="buyer-auth-form-inner">
                <h1 className="buyer-auth-title">Welcome Back</h1>
                <p className="buyer-auth-subtitle">Sign in to your account to continue shopping</p>

                <form className="buyer-auth-form" onSubmit={handleSubmit}>
                  <button
                    type="button"
                    className="buyer-auth-submit-btn"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    style={{ marginBottom: 12, background: "#fff", color: "#111827", border: "1px solid #d1d5db" }}
                  >
                    Continue with Google
                  </button>

                  {/* Email Field */}
                  <div className="buyer-form-group">
                    <label htmlFor="email" className="buyer-form-label">
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      name="email"
                      className="buyer-form-input"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>

                  {/* Password Field */}
                  <div className="buyer-form-group">
                    <div className="buyer-form-label-row">
                      <label htmlFor="password" className="buyer-form-label">
                        Password
                      </label>
                    </div>
                    <div className="buyer-password-input-wrapper">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        className="buyer-form-input"
                        placeholder="Enter your password"
                        value={formData.password}
                        onChange={handleInputChange}
                        disabled={isLoading}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="buyer-password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isLoading}
                        aria-label="Toggle password visibility"
                      >
                        <EyeIcon />
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="buyer-auth-submit-btn"
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </button>
                </form>

                {/* Sign Up Link */}
                <div className="buyer-auth-footer">
                  <p className="buyer-auth-footer-text">
                    Don't have an account?{" "}
                    <Link to="/marketplace/register" className="buyer-auth-link">
                      Create one
                    </Link>
                  </p>
                </div>
              </div>
            </div>

            {/* Right Side - Illustration */}
            <div className="buyer-auth-illustration">
              <div className="buyer-auth-illustration-content">
                <div className="buyer-auth-icon-box">
                  <svg
                    width="80"
                    height="80"
                    viewBox="0 0 80 80"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="40" cy="40" r="38" fill="#ECFDF5" stroke="#10B981" strokeWidth="4" />
                    <path
                      d="M35 40L38 43L45 35"
                      stroke="#10B981"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="buyer-auth-illustration-title">Shop with Confidence</h3>
                <p className="buyer-auth-illustration-text">
                  Browse products from trusted local businesses and enjoy secure, escrow-backed shopping
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default BuyerLogin;
