import React, { useState, useEffect, useRef } from "react";
import PaymentInterface from "./PaymentInterface";
import "./subpage.css";

export default function SubscribePage() {
  const [planSelected, setPlanSelected] = useState(false);
  const [amount, setAmount] = useState(0);

  const formatter = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  const getPlanName = (amount) => {
    switch (amount) {
      case 5000:
        return "Basic";
      case 10000:
        return "Standard";
      case 15000:
        return "Professional";
      default:
        return "";
    }
  };

  return (
    <div className="subscribe-container">
      <h1>Select a plan</h1>
      <div className="subscribe-grid-items">
        <div className="item">
          <h3>Basic</h3>
          <div className="item-text">
            <p>
              Discover the essentials with our Basic Plan for startups and small
              businesses.
            </p>
            <h1>
              {formatter(5000)} <span>monthly</span>
            </h1>
          </div>
          <div className="choose-btn">
            <span
              onClick={() => {
                setPlanSelected(true);
                setAmount(5000);
              }}
            >
              Choose
            </span>
          </div>
        </div>
        <div className="item">
          <h3>Standard</h3>
          <div className="item-text">
            <p>
              Upgrade to our Standard Plan and unlock a comprehensive set of
              features.
            </p>
            <h1>
              {formatter(10000)} <span>monthly</span>
            </h1>
          </div>
          <div className="choose-btn">
            <span
              onClick={() => {
                setPlanSelected(true);
                setAmount(10000);
              }}
            >
              Choose
            </span>
          </div>
        </div>
        <div className="item">
          <h3>Professional</h3>
          <div className="item-text">
            <p>
              Experience the pinnacle of inventory management with our
              Professional Plan.
            </p>
            <h1>
              {formatter(15000)} <span>monthly</span>
            </h1>
          </div>
          <div className="choose-btn">
            <span
              onClick={() => {
                setPlanSelected(true);
                setAmount(15000);
              }}
            >
              Choose
            </span>
          </div>
        </div>
      </div>

      {planSelected && (
        <PaymentInterface setPlanSelected={setPlanSelected} amount={amount} plan={getPlanName(amount)}/>
      )}
    </div>
  );
}
