import React, { useState } from "react";
import styles from "./auth.scss";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { resetPassword } from "../../../services/authService";
import { useAsyncToast } from "../../../customHook/useAsyncToast";
import { Helmet } from "react-helmet";

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

const initialState = {
  password: "",
  password2: "",
};

const Reset = () => {
  const [formData, setformData] = useState(initialState);
  const navigate = useNavigate();
  const { password, password2 } = formData;
  const [showPassword, setShowPassword] = useState(false);
  const { executeWithToast } = useAsyncToast();

  const queryParams = new URLSearchParams(window.location.search);
  const email = queryParams.get("email");
  // Backward compatibility: still pass businessEmail if present in URL
  const businessEmail = queryParams.get("businessEmail");

  const { resetToken } = useParams();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setformData({ ...formData, [name]: value });
  };

  const reset = async (e) => {
    e.preventDefault();

    if (password.length < 6) {
      return toast.error("Passwords must be up to 6 characters");
    }
    if (password !== password2) {
      return toast.error("Passwords do not match");
    }

    const userData = {
      password,
      password2,
    };

    try {
      await executeWithToast(
        resetPassword(userData, resetToken, email, businessEmail),
        {
          loading: "Resetting password...",
          success: (data) => data.message || "Password reset successful!",
          error: "Failed to reset password. Please try again.",
        }
      );
      navigate("/login");
    } catch (error) {
      console.error("Reset password error:", error);
    }
  };

  return (
    <div className="container auth">
      {/* Loader removed - using toast notifications instead */}
      <Helmet>
        <title>Reset Password | Sell Square - Create New Password</title>
        <meta
          name="description"
          content="Create a new secure password for your Sell Square business account. Get back to managing your inventory and sales operations."
        />
        <meta
          name="keywords"
          content="sell square reset password, new password, change password, secure password, business account security"
        />
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:title" content="Reset Password | Sell Square" />
        <meta
          property="og:description"
          content="Create a new password and regain access to your business management platform."
        />
        <meta property="og:type" content="website" />
        <meta
          property="og:url"
          content="https://www.sellsquarehub.com/resetpassword"
        />
        <meta
          property="og:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <link
          rel="canonical"
          href="https://www.sellsquarehub.com/resetpassword"
        />
      </Helmet>
      <div className="">
        <div className="auth-header">
          <h1>Set New Password</h1>
        </div>
        <form onSubmit={reset}>
          <div className="auth-inputs">
            <div className="input-field">
              <div className="password-input">
                <label>Create New Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="*********"
                  required
                  name="password"
                  value={password}
                  onChange={handleInputChange}
                />
                <div
                  onClick={() => setShowPassword(!showPassword)}
                  className="show-password"
                >
                  {!showPassword && <div className="cross-line"></div>}
                  <EyeIcon />
                </div>
              </div>
            </div>
            <div className="input-field">
              <div className="password-input">
                <label>Confirm New Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="*********"
                  required
                  name="password2"
                  value={password2}
                  onChange={handleInputChange}
                />
                <div
                  onClick={() => setShowPassword(!showPassword)}
                  className="show-password"
                >
                  {!showPassword && <div className="cross-line"></div>}
                  <EyeIcon />
                </div>
              </div>
            </div>
            <button type="submit" className="--btn --btn-primary --btn-block">
              Create Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Reset;
