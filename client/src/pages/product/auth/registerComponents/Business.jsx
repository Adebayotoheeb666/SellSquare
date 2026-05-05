import React, { useState } from "react";

// Eye Icon SVG Component
const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 4C4.5 4 2 10 2 10C2 10 4.5 16 10 16C15.5 16 18 10 18 10C18 10 15.5 4 10 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function Business({
  handleInputChange,
  businessName,
  businessEmail,
  businessAddress,
  businessPhone,
  industry,
  country,
}) {

  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="sign-up-forms-1">
      <div className="sign-up-form-field">
        <div>
          <label>Business Name*</label>
          <input
            type="text"
            placeholder="chemicals ltd"
            required
            name="businessName"
            value={businessName}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label>Business Email*</label>
          <input
            type="email"
            placeholder="business@gmail.com"
            required
            name="businessEmail"
            value={businessEmail}
            onChange={handleInputChange}
          />
        </div>
      </div>
      <div className="sign-up-form-field">
        <div>
          <label>Business Address*</label>
          <input
            type="text"
            placeholder="landmark, street ..."
            required
            name="businessAddress"
            value={businessAddress}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label>Business Phone*</label>
          <input
            type="text"
            placeholder="+2348065109764"
            required
            name="businessPhone"
            value={businessPhone}
            onChange={handleInputChange}
          />
        </div>
      </div>
      <div className="sign-up-form-field">
        <div>
          <label>Industry*</label>
          <input
            type="text"
            placeholder="Technology"
            required
            name="industry"
            value={industry}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label>Country*</label>
          <input
            type="text"
            placeholder="Nigeria"
            required
            name="country"
            value={country}
            onChange={handleInputChange}
          />
        </div>
      </div>
    </div>
  );
}
