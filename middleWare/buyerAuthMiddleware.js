const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const Buyer = require("../models/buyerModel");

// Protect routes for authenticated buyers
const protectBuyer = asyncHandler(async (req, res, next) => {
  let token = req.cookies.buyer_token;

  // Check Authorization header as fallback
  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    res.status(401);
    throw new Error("Not authorised as buyer");
  }

  try {
    const decoded = jwt.verify(token, process.env.BUYER_JWT_SECRET);
    req.buyer = await Buyer.findById(decoded.buyerId).select("-password");

    if (!req.buyer) {
      res.status(401);
      throw new Error("Buyer not found");
    }

    next();
  } catch (error) {
    res.status(401);
    throw new Error("Not authorised as buyer");
  }
});

module.exports = { protectBuyer };
