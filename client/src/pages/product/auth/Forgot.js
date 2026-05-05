import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { forgotPassword, validateEmail } from "../../../services/authService";
import { toast } from "sonner";
import { Helmet } from "react-helmet";
import { useAsyncToast } from "../../../customHook/useAsyncToast";
// import "./auth.css";

const Forgot = () => {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();
  const { executeWithToast } = useAsyncToast();

  console.log(window.location.hostname);

  const forgot = async (e) => {
    e.preventDefault();
    if (!email) {
      return toast.error("Please enter your email");
    }

    if (!validateEmail(email)) {
      return toast.error("Please enter a valid email");
    }

    const userData = {
      email,
      url:
        window.location.hostname === "localhost"
          ? "http://" + window.location.hostname + ":3000"
          : window.location.hostname,
    };

    try {
      await executeWithToast(forgotPassword(userData), {
        loading: "Sending reset link...",
        success: "Password reset link sent to your email!",
        error: "Failed to send reset link. Please try again.",
      });
      navigate("/forgot/confirm");
      setEmail("");
    } catch (error) {
      console.error("Forgot password error:", error);
    }
  };

  return (
    <div className="container auth">
      {/* Loader removed - using toast notifications instead */}
      <Helmet>
        <title>Forgot Password | Sell Square - Secure Password Recovery</title>
        <meta
          name="description"
          content="Reset your Sell Square account password securely. Get back to managing your business inventory, sales, and operations quickly and safely."
        />
        <meta
          name="keywords"
          content="sell square forgot password, reset password, account recovery, secure password reset, business account recovery"
        />
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:title" content="Forgot Password | Sell Square" />
        <meta
          property="og:description"
          content="Securely reset your Sell Square password and regain access to your business management platform."
        />
        <meta property="og:type" content="website" />
        <meta
          property="og:url"
          content="https://www.sellsquarehub.com/forgot"
        />
        <meta
          property="og:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <link rel="canonical" href="https://www.sellsquarehub.com/forgot" />
      </Helmet>
      <div className="">
        <div className="auth-header">
          <h1>Enter Your email address</h1>
        </div>
        <form onSubmit={forgot}>
          <div className="auth-inputs">
            <div className="input-field">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="you@gmail.com"
                // required
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button type="submit" className="--btn --btn-primary --btn-block">
              Get Reset Email
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Forgot;
