const requireBusinessOwner = (req, res, next) => {
  if (!req.user?.businessOwnerLoggedIn) {
    return res.status(403).json({
      message: "Only the business owner can perform this action",
    });
  }

  return next();
};

module.exports = requireBusinessOwner;
