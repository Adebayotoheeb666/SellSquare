import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getCart } from "../../../redux/features/cart/cartSlice";
import "./cart.css";
import {
  selectIsLoggedIn,
  selectUser,
} from "../../../redux/features/auth/authSlice";
import CartDetails from "../../../components/cartDetails/CartDetails";
import { Helmet } from "react-helmet";
import { useShouldFetch } from "../../../customHook/useDataBootstrap";
import {
  BOOTSTRAP_DATA,
  selectIsBootstrapped,
} from "../../../redux/features/dataCache/dataCacheSlice";

export default function Cart() {
  const dispatch = useDispatch();
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const user = useSelector(selectUser);
  const isBootstrapped = useSelector(selectIsBootstrapped);

  const userCheckingOut = {
    name: user.name,
    email: user.email,
  };

  const { cart, isCartLoading } = useSelector((state) => state.cart);

  // Only fetch if cart wasn't bootstrapped
  const { shouldFetch: shouldFetchCart, markFetched: markCartFetched } =
    useShouldFetch(BOOTSTRAP_DATA.CART);

  useEffect(() => {
    // Only fetch cart if it wasn't already loaded during bootstrap
    if (isLoggedIn && !isBootstrapped && shouldFetchCart && user?.email) {
      dispatch(getCart(user.email)).then(() => {
        markCartFetched();
      });
    }
  }, [
    dispatch,
    isLoggedIn,
    isBootstrapped,
    shouldFetchCart,
    user?.email,
    markCartFetched,
  ]);

  return (
    <div>
      <Helmet>
        <title>Cart & Checkout | Sell Square - Fast POS System</title>
        <meta
          name="description"
          content="Fast and intuitive Point of Sale (POS) system. Record sales, manage cart items, track payments (cash, POS, transfer, part payment), handle customer information, and generate professional receipts instantly."
        />
        <meta
          name="keywords"
          content="POS system, point of sale, checkout system, sales recording, cart management, payment tracking, receipt generation, business checkout, retail POS, customer management"
        />
        <meta name="author" content="Sell Square" />
        <meta name="robots" content="index, follow" />
        <meta
          property="og:title"
          content="Cart & Checkout | Sell Square POS System"
        />
        <meta
          property="og:description"
          content="Streamline your sales process with our fast POS system. Track multiple payment methods, manage customer details, and generate receipts automatically."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.sellsquarehub.com/cart" />
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
          content="Cart & Checkout | Sell Square POS"
        />
        <meta
          name="twitter:description"
          content="Fast checkout, multiple payment methods, instant receipts. Streamline your sales process."
        />
        <meta
          name="twitter:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <link rel="canonical" href="https://www.sellsquarehub.com/cart" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Sell Square POS System",
            applicationCategory: "BusinessApplication",
            description:
              "Fast and intuitive Point of Sale system for SMEs. Record sales, track payments, and generate receipts.",
            url: "https://www.sellsquarehub.com/cart",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
          })}
        </script>
      </Helmet>
      {isLoggedIn ? (
        <CartDetails
          cart={cart}
          isLoading={isCartLoading}
          user={userCheckingOut}
        />
      ) : (
        <div className="guest-login-prompt">
          <h2>Please log in to your buyer dashboard to view checkout details.</h2>
        </div>
      )}
    </div>
  );
}
