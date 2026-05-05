import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import { loginUser, validateEmail } from "../../../services/authService";
import {
  SET_LOGIN,
  SET_NAME,
  SET_USER,
  SET_CONNECTED_STORES,
} from "../../../redux/features/auth/authSlice";
import "./auth.css";
import { Helmet } from "react-helmet";
import { useAsyncToast } from "../../../customHook/useAsyncToast";
import { logoutBuyer } from "../../../redux/features/buyerAuth/buyerAuthSlice";

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
  email: "",
  password: "",
};

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [formData, setformData] = useState(initialState);
  const { email, password } = formData;
  const [showPassword, setShowPassword] = useState(false);
  const location = useLocation();
  const { executeWithToast } = useAsyncToast();

  const determineRedirectUrl = () => {
    const queryParams = new URLSearchParams(location.search);
    const redirectUrl = queryParams.get("redirect_url");
    return redirectUrl ? redirectUrl : "/dashboard";
  };

  const redirectUrl = determineRedirectUrl();
  // useRedirectLoggedOutUser(redirectUrl);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setformData({ ...formData, [name]: value });
  };

  const login = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      return toast.error("All fields are required");
    }

    if (!validateEmail(email)) {
      return toast.error("Please enter a valid email");
    }

    const userData = {
      email,
      password,
    };

    try {
      await executeWithToast(
        (async () => {
          const data = await loginUser(userData);
          // Clear any existing buyer session
          await dispatch(logoutBuyer());
          
          await dispatch(SET_LOGIN(true));
          await dispatch(SET_NAME(data.businessName));
          await dispatch(SET_USER(data));
          if (data.connectedStores) {
            await dispatch(SET_CONNECTED_STORES(data.connectedStores));
          }

          const queryParams = new URLSearchParams(location.search);
          const redirectUrl = queryParams.get("redirect_url");

          if (redirectUrl) {
            navigate(redirectUrl);
          } else {
            navigate("/dashboard");
          }
        })(),
        {
          loading: "Logging in...",
          success: "Login successful!",
          error: (err) => err?.message || "Login failed. Please check your credentials.",
        }
      );
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  return (
    <div className="container auth">
      {/* Loader removed - using toast notifications instead */}
      <Helmet>
        <title>
          Login | Sell Square - Cloud-Based Business Management Platform
        </title>
        <meta
          name="description"
          content="Login to Sell Square to manage your business efficiently. Access real-time inventory tracking, POS system, sales analytics, customer management, and team collaboration tools for SMEs."
        />
        <meta
          name="keywords"
          content="sell square login, business management login, inventory management system, POS system, cloud-based inventory, SME business software, sales tracking, warehouse management, retail management software"
        />
        <meta name="author" content="Sell Square" />
        <meta name="robots" content="index, follow" />
        <meta
          property="og:title"
          content="Login | Sell Square - Business Management Platform"
        />
        <meta
          property="og:description"
          content="Access your comprehensive business management dashboard. Track inventory across multiple warehouses, manage sales with our POS system, analyze business performance, and collaborate with your team."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.sellsquarehub.com/login" />
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
          content="Login | Sell Square - Business Management Platform"
        />
        <meta
          name="twitter:description"
          content="Access your comprehensive business management dashboard. Track inventory, manage sales, and grow your business."
        />
        <meta
          name="twitter:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <link rel="canonical" href="https://www.sellsquarehub.com/login" />
      </Helmet>
      <div className="">
        <div className="auth-header">
          <h1>Login</h1>
        </div>
        <form onSubmit={login}>
          <div className="auth-inputs">
            <div className="input-field">
              <label>Email</label>
              <input
                type="email"
                placeholder="you@gmail.com"
                required
                autoComplete="email"
                name="email"
                value={email}
                onChange={handleInputChange}
              />
            </div>
            <div className="input-field">
              <div className="password-input">
                <label>Password</label>
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
            <Link className="forgot-password" to="/forgot">
              Forgot Password?
            </Link>
            <button type="submit" className="--btn --btn-primary --btn-block">
              Login
            </button>
            <p>
              {" "}
              Don't have an account?{" "}
              <Link className="bold" to="/register">
                Sign Up
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
