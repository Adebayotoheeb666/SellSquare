const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const axios = require("axios");
const Buyer = require("../models/buyerModel");
const BuyerWallet = require("../models/buyerWalletModel");

// Sign JWT token
const signToken = (buyerId) => {
  return jwt.sign({ buyerId }, process.env.BUYER_JWT_SECRET, {
    expiresIn: "30d",
  });
};

const ensureBuyerWallet = async (buyerId) => {
  const existingWallet = await BuyerWallet.findOne({ buyer: buyerId });
  if (existingWallet) return existingWallet;
  return BuyerWallet.create({
    buyer: buyerId,
    balance: 0,
    currency: "NGN",
    transactions: [],
  });
};

// Register buyer
const registerBuyer = asyncHandler(async (req, res, next) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body;

  // Validation
  if (!firstName || !lastName || !email || !password) {
    res.status(400);
    throw new Error("Please provide all required fields");
  }

  if (password !== confirmPassword) {
    res.status(400);
    throw new Error("Passwords do not match");
  }

  // Check if email already exists
  const existingBuyer = await Buyer.findOne({ email: email.toLowerCase() });
  if (existingBuyer) {
    res.status(400);
    throw new Error("Email already registered");
  }

  // Create buyer
  const buyer = await Buyer.create({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.toLowerCase().trim(),
    password,
  });

  // Create wallet for buyer
  await ensureBuyerWallet(buyer._id);

  // Sign token
  const token = signToken(buyer._id);

  // Set cookie
  res.cookie("buyer_token", token, {
    httpOnly: true,
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  // Return buyer (exclude password)
  res.status(201).json({
    success: true,
    data: {
      _id: buyer._id,
      firstName: buyer.firstName,
      lastName: buyer.lastName,
      email: buyer.email,
      phone: buyer.phone,
      isEmailVerified: buyer.isEmailVerified,
    },
  });
});

// Login buyer
const loginBuyer = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide email and password");
  }

  // Find buyer and include password
  const buyer = await Buyer.findOne({ email: email.toLowerCase() }).select(
    "+password"
  );

  if (!buyer) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  // Match password
  const isPasswordMatch = await buyer.matchPassword(password);

  if (!isPasswordMatch) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  // Sign token
  const token = signToken(buyer._id);

  // Set cookie
  res.cookie("buyer_token", token, {
    httpOnly: true,
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  // Return buyer (exclude password)
  res.status(200).json({
    success: true,
    data: {
      _id: buyer._id,
      firstName: buyer.firstName,
      lastName: buyer.lastName,
      email: buyer.email,
      phone: buyer.phone,
      isEmailVerified: buyer.isEmailVerified,
    },
  });
});

// Logout buyer
const logoutBuyer = asyncHandler(async (req, res, next) => {
  res.clearCookie("buyer_token");
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

// Get buyer profile
const getBuyerMe = asyncHandler(async (req, res, next) => {
  const buyer = await Buyer.findById(req.buyer._id);

  res.status(200).json({
    success: true,
    data: buyer,
  });
});

// Start Google OAuth flow for buyers
const startGoogleAuth = asyncHandler(async (req, res) => {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const callbackUrl =
    process.env.GOOGLE_OAUTH_BUYER_CALLBACK_URL ||
    "http://localhost:4000/api/buyer/auth/google/callback";

  if (!clientId) {
    res.status(500);
    throw new Error("Google OAuth is not configured");
  }

  const requestedRedirect =
    typeof req.query.redirect_url === "string" && req.query.redirect_url.trim()
      ? req.query.redirect_url.trim()
      : "/marketplace/buyer/orders";

  const normalizedRedirect = requestedRedirect.startsWith("/")
    ? requestedRedirect
    : "/marketplace/buyer/orders";

  const stateNonce = crypto.randomBytes(16).toString("hex");
  const statePayload = Buffer.from(
    JSON.stringify({
      nonce: stateNonce,
      redirectUrl: normalizedRedirect,
    }),
  ).toString("base64url");

  res.cookie("buyer_google_oauth_state", stateNonce, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
  });

  const authParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state: statePayload,
  });

  return res.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`,
  );
});

// Google OAuth callback for buyer login/signup
const handleGoogleAuthCallback = asyncHandler(async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;
  const cookieState = req.cookies?.buyer_google_oauth_state;

  const frontendBaseUrl =
    process.env.CLIENT_URL ||
    process.env.FRONTEND_URL ||
    "http://localhost:3000";

  if (!code || !state || !cookieState) {
    return res.redirect(`${frontendBaseUrl}/marketplace/login?oauth_error=missing_oauth_data`);
  }

  let parsedState = null;
  try {
    parsedState = JSON.parse(Buffer.from(String(state), "base64url").toString("utf8"));
  } catch (error) {
    return res.redirect(`${frontendBaseUrl}/marketplace/login?oauth_error=invalid_state`);
  }

  if (!parsedState?.nonce || parsedState.nonce !== cookieState) {
    return res.redirect(`${frontendBaseUrl}/marketplace/login?oauth_error=state_mismatch`);
  }

  res.clearCookie("buyer_google_oauth_state");

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const callbackUrl =
    process.env.GOOGLE_OAUTH_BUYER_CALLBACK_URL ||
    "http://localhost:4000/api/buyer/auth/google/callback";

  if (!clientId || !clientSecret) {
    return res.redirect(`${frontendBaseUrl}/marketplace/login?oauth_error=oauth_not_configured`);
  }

  let idToken;
  let accessToken;
  try {
    const tokenRes = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    idToken = tokenRes?.data?.id_token;
    accessToken = tokenRes?.data?.access_token;
  } catch (error) {
    return res.redirect(`${frontendBaseUrl}/marketplace/login?oauth_error=token_exchange_failed`);
  }

  if (!idToken || !accessToken) {
    return res.redirect(`${frontendBaseUrl}/marketplace/login?oauth_error=missing_id_token`);
  }

  let profile;
  try {
    const profileRes = await axios.get("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    profile = profileRes.data;
  } catch (error) {
    return res.redirect(`${frontendBaseUrl}/marketplace/login?oauth_error=profile_fetch_failed`);
  }

  const email = String(profile?.email || "").toLowerCase().trim();
  if (!email) {
    return res.redirect(`${frontendBaseUrl}/marketplace/login?oauth_error=missing_email`);
  }

  let buyer = await Buyer.findOne({ email });
  if (!buyer) {
    const fullName = String(profile?.name || "").trim();
    const [firstFromName, ...restNames] = fullName.split(" ").filter(Boolean);
    const firstName = firstFromName || "Buyer";
    const lastName = restNames.join(" ") || "Account";

    buyer = await Buyer.create({
      firstName,
      lastName,
      email,
      password: crypto.randomBytes(24).toString("hex"),
      isEmailVerified: Boolean(profile?.email_verified),
    });
  } else if (profile?.email_verified && !buyer.isEmailVerified) {
    buyer.isEmailVerified = true;
    await buyer.save();
  }

  await ensureBuyerWallet(buyer._id);

  const buyerToken = signToken(buyer._id);
  res.cookie("buyer_token", buyerToken, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  const redirectPath =
    typeof parsedState.redirectUrl === "string" && parsedState.redirectUrl.startsWith("/")
      ? parsedState.redirectUrl
      : "/marketplace/buyer/orders";

  return res.redirect(`${frontendBaseUrl}${redirectPath}`);
});

module.exports = {
  registerBuyer,
  loginBuyer,
  logoutBuyer,
  getBuyerMe,
  startGoogleAuth,
  handleGoogleAuthCallback,
};
