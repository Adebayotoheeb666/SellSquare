import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate } from "react-router-dom";

const Confirm = () => {
  const navigate = useNavigate();

  const confirmEmail = async (e) => {
    e.preventDefault();
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isAndroid = /android/i.test(userAgent);

    if (isAndroid) {
      window.location.href =
        "intent://#Intent;action=com.google.android.gm;end";
    } else {
      window.location.href = "https://mail.google.com/";
    }
  };

  return (
    <div className="container auth confirm">
      <Helmet>
        <title>Email Verification | Sell Square - Check Your Inbox</title>
        <meta
          name="description"
          content="Verify your email to complete your Sell Square account setup and start managing your business operations."
        />
        <meta
          name="keywords"
          content="sell square email verification, confirm email, account verification, business email confirm"
        />
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:title" content="Email Verification | Sell Square" />
        <meta
          property="og:description"
          content="Complete your account setup by verifying your email address."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.sellsquarehub.com/forgot/success" />
        <meta
          property="og:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <link rel="canonical" href="https://www.sellsquarehub.com/forgot/success" />
      </Helmet>
      <div className="">
        <div className="auth-header">
          <h1>Check your email</h1>
          <p>
            Complete verification by following the instruction sent to your
            email
          </p>
        </div>
        <form onSubmit={confirmEmail}>
          <div className="auth-inputs">
            <button type="submit" className="--btn --btn-primary --btn-block">
              Open your mail app
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Confirm;
