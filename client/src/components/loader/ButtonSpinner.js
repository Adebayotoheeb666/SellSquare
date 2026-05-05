import React from "react";
import "./ButtonSpinner.scss";

const ButtonSpinner = ({ size = "16px", color = "currentColor" }) => {
  return (
    <svg
      className="button-spinner"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="10 20"
      />
    </svg>
  );
};

export default ButtonSpinner;
