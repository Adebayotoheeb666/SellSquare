import React from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectBusiness } from "../../../../redux/features/auth/authSlice";
import moment from "moment";

// Edit Icon SVG Component
const EditIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 2L16 5L6 15H3V12L13 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11 4L14 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function Subscription() {
  const business = useSelector(selectBusiness);

  // const getNextDueDate = () => {
  //   const monthId = business?.subscription
  //     ? new Date(business.subscription.nextDueDate).getMonth()
  //     : null;
  //   const year = business?.subscription
  //     ? new Date(business.subscription.nextDueDate).getFullYear()
  //     : null;

  //   const months = [
  //     "January",
  //     "February",
  //     "March",
  //     "April",
  //     "May",
  //     "June",
  //     "July",
  //     "August",
  //     "September",
  //     "October",
  //     "November",
  //     "December",
  //   ];

  //   const dueDate = months[monthId] + ", " + year;
  //   return dueDate;
  // };

  const getNextDueDate = () => {
    if (!business?.subscription?.nextDueDate) return null;

    return moment(business.subscription.nextDueDate).format("MMMM, D YYYY");
  };

  // console.log("business", business);
  return (
    <div className="business-profile-item">
      <div>
        <h3>Subscription</h3>
        <div className="item-container">
          <div className="item-name subscription-plan">
            <div>
              <h3>Current Plan</h3>
              <h1>
                {business?.subscription
                  ? business.subscription.plan
                  : "Professional"}
              </h1>
            </div>
            <div>
              <h4>Next Due Date</h4>
              <h6>{getNextDueDate()}</h6>
            </div>
          </div>
          <div className="item-action upgrade">
            <Link to="/accounts/subscribe">Upgrade</Link>
          </div>
        </div>
        <br />
        <div className="item-container">
          <div className="item-name">
            <h3>
              Kindly pay your subscription fee to the following account and send
              proof of payment to 08065109764 on WhatsApp for confirmation.
            </h3>
            {/* {business?.subscription
                ? business.subscription.paymentMethod
                : "Visa 1234"} */}
            <h3>Bank Name: Providus Bank</h3>
            <h3>Account Name: AFOLABI OPEYEMI</h3>
            <h3>Account Number: 6504236709</h3>
          </div>
          <div className="item-action upgrade">
            <Link to="/accounts/subscribe">Edit</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
