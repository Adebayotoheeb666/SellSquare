import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Helmet } from "react-helmet";
import { toast } from "sonner";
import {
  registerBuyer,
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

const BuyerRegister = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  
  const buyer = useSelector(selectBuyer);
  const isLoading = useSelector(selectBuyerLoading);
  const error = useSelector(selectBuyerError);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (buyer) {
      const redirectUrl = new URLSearchParams(location.search).get("redirect_url") || "/marketplace";
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

  const validateForm = () => {
    const { firstName, lastName, email, password, confirmPassword } = formData;

    if (!firstName.trim()) {
      toast.error("First name is required");
      return false;
    }

    if (!lastName.trim()) {
      toast.error("Last name is required");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return false;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return false;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Clear any existing seller session
    dispatch(LOGOUT());
    // Dispatch register thunk
    dispatch(registerBuyer({
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.toLowerCase().trim(),
      password: formData.password,
    }));
  };

  const handleGoogleSignUp = () => {
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

  return (
    <main className="buyer-auth-root">
      <Helmet>
        <title>Create Account - Sell Square Marketplace</title>
        <meta name="description" content="Create a Sell Square buyer account to start shopping from local businesses." />
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
                <h1 className="buyer-auth-title">Create Your Account</h1>
                <p className="buyer-auth-subtitle">Join Sell Square and start shopping from trusted sellers</p>

                <form className="buyer-auth-form" onSubmit={handleSubmit}>
                  <button
                    type="button"
                    className="buyer-auth-submit-btn"
                    onClick={handleGoogleSignUp}
                    disabled={isLoading}
                    style={{ marginBottom: 12, background: "#fff", color: "#111827", border: "1px solid #d1d5db" }}
                  >
                    Continue with Google
                  </button>

                  {/* First Name Field */}
                  <div className="buyer-form-group">
                    <label htmlFor="firstName" className="buyer-form-label">
                      First Name
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      name="firstName"
                      className="buyer-form-input"
                      placeholder="Enter your first name"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      autoComplete="given-name"
                    />
                  </div>

                  {/* Last Name Field */}
                  <div className="buyer-form-group">
                    <label htmlFor="lastName" className="buyer-form-label">
                      Last Name
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      name="lastName"
                      className="buyer-form-input"
                      placeholder="Enter your last name"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      autoComplete="family-name"
                    />
                  </div>

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
                    <label htmlFor="password" className="buyer-form-label">
                      Password
                    </label>
                    <div className="buyer-password-input-wrapper">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        className="buyer-form-input"
                        placeholder="Create a password"
                        value={formData.password}
                        onChange={handleInputChange}
                        disabled={isLoading}
                        autoComplete="new-password"
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
                    <p className="buyer-password-hint">At least 6 characters</p>
                  </div>

                  {/* Confirm Password Field */}
                  <div className="buyer-form-group">
                    <label htmlFor="confirmPassword" className="buyer-form-label">
                      Confirm Password
                    </label>
                    <div className="buyer-password-input-wrapper">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        className="buyer-form-input"
                        placeholder="Confirm your password"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        disabled={isLoading}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="buyer-password-toggle"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                    {isLoading ? "Creating Account..." : "Create Account"}
                  </button>
                </form>

                {/* Sign In Link */}
                <div className="buyer-auth-footer">
                  <p className="buyer-auth-footer-text">
                    Already have an account?{" "}
                    <Link to="/marketplace/login" className="buyer-auth-link">
                      Sign in here
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
                      d="M35 35C35 31.7 37.7 29 41 29C44.3 29 47 31.7 47 35C47 38.3 44.3 41 41 41C37.7 41 35 38.3 35 35Z"
                      stroke="#10B981"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M32 47C32 44.8 33.8 43 36 43H46C48.2 43 50 44.8 50 47V51C50 51.6 49.6 52 49 52H33C32.4 52 32 51.6 32 51V47Z"
                      stroke="#10B981"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="buyer-auth-illustration-title">Start Shopping Today</h3>
                <p className="buyer-auth-illustration-text">
                  Discover exclusive products from verified local sellers and enjoy secure, escrow-backed purchases
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

export default BuyerRegister;
