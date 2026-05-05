import React, { useEffect, useState, useRef } from "react";
import cardIcon from "../../../../assets/home/card-icon.svg";
import logo from "../../../../assets/logo2.png";
import "./subpage.css";
import axios from "axios";
import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { SET_BUSINESS } from "../../../../redux/features/auth/authSlice";
import { updateSubscription } from "../../../../services/authService";

export default function PaymentInterface({ setPlanSelected, amount, plan }) {
  const payContainerRef = useRef(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate()

  const handleClickOutside = (event) => {
    if (
      payContainerRef.current &&
      !payContainerRef.current.contains(event.target)
    ) {
      setPlanSelected(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const config = {
    public_key: process.env.REACT_APP_FLUTTERWAVE_PUBLIC_KEY,
    tx_ref: Date.now(),
    amount: amount,
    currency: "NGN",
    payment_options: "card,mobilemoney,ussd",
    customer: {
      email: userEmail,
      phone_number: userPhone,
      name: userName,
    },
    customizations: {
      title: "GNLIFE TECH NETWORK",
      description: "Subscription for inventory software",
      logo: "https://res.cloudinary.com/dfrwntkjm/image/upload/v1721347620/logo_qbgiqq.png",
    },
  };

  const handleFlutterPayment = useFlutterwave(config);

  const handlePayment = async (e) => {
    e.preventDefault();

    handleFlutterPayment({
      callback: async (response) => {
        console.log(response);
        const formData = {
          plan: plan,
          subscriptionType: "recurring",
        }

        if (response.status === "completed") {
          const businessInfo = await updateSubscription(formData);
          dispatch(SET_BUSINESS(businessInfo));
        }

        closePaymentModal();
        setPlanSelected(false);
        navigate("/accounts/subscription");
      },
      onClose: () => {
        alert("Kindly complete payment to continue using the software")
      },
    });

    console.log("Payment clicked for:", amount);
  };

  const formatter = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  return (
    <div className="payment-interface">
      <div className="pay-container" ref={payContainerRef}>
        <div className="pay-left-nav">
          <h3>Pay with</h3>
          <hr />
          <div className="card-icon-container">
            <img src={cardIcon} alt="card" />
            <h5>Flutterwave</h5>
          </div>
        </div>
        <div className="pay-main-content">
          <div className="pay-main-header">
            <div className="logo">
              <img src={logo} alt="logo" />
              <h3>GNLife Inventory</h3>
            </div>
            <div className="company-pay-info">
              <h3>GNLife Tech Network</h3>
              <h1>
                Pay <span>{formatter(amount)}</span>
              </h1>
            </div>
          </div>
          <hr />
          <h1>Enter your details to pay</h1>

          <form onSubmit={(e) => handlePayment(e)}>
            <div className="pay-form">
              <div className="form-field">
                <div className="">
                  <label htmlFor="email">Business Email *</label>
                  <input
                    onChange={(e) => setUserEmail(e.target.value)}
                    type="email"
                    name="email"
                    required
                  />
                </div>
              </div>
              <div className="form-field">
                <div className="">
                  <label htmlFor="name">Name *</label>
                  <input
                    onChange={(e) => setUserName(e.target.value)}
                    type="text"
                    name="name"
                    required
                  />
                </div>
                <div className="">
                  <label htmlFor="phone">Phone *</label>
                  <input
                    onChange={(e) => setUserPhone(e.target.value)}
                    type="tel"
                    name="phone"
                    required
                  />
                </div>
              </div>
              <div className="form-field">
                <div className="">
                  <input type="submit" value={`Pay ${formatter(amount)}`} />
                </div>
              </div>
            </div>
          </form>

          <p>Your card information is secured.</p>
        </div>
      </div>
    </div>
  );
}
