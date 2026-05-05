import React from "react";
import { Link } from "react-router-dom";
import "./success.css";

// Success Check Icon SVG Component
const SuccessCheckIcon = () => (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="38" fill="#4CAF50" stroke="#4CAF50" strokeWidth="4" />
    <path d="M25 40L35 50L55 30" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function SuccessRegistration({ }) {
  return (
    <div className="business-reg-success">
      <div className="success-registration">
        <SuccessCheckIcon />
        <div className="success-msg">
          <h1>Registration Completed</h1>
          <p>You have completed your registration. Please Log in.</p>
        </div>
        <button>
          <Link className="complete-btn" to="/login">Login</Link>
        </button>
      </div>
    </div>
  );
}
