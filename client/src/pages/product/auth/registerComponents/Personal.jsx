import React, { useState } from "react";

// Eye Icon SVG Component
const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 4C4.5 4 2 10 2 10C2 10 4.5 16 10 16C15.5 16 18 10 18 10C18 10 15.5 4 10 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function Personal({
  handleInputChange,
  ownerFirstName,
  ownerLastName,
  ownerEmail,
  ownerPassword,
}) {

  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="sign-up-forms-1">
      <div className="sign-up-form-field">
        <div>
          <label>First Name*</label>
          <input
            type="text"
            placeholder="Will"
            required
            name="ownerFirstName"
            value={ownerFirstName}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label>Last Name*</label>
          <input
            type="text"
            placeholder="Smith"
            required
            name="ownerLastName"
            value={ownerLastName}
            onChange={handleInputChange}
          />
        </div>
      </div>
      <div className="sign-up-form-field">
        <div>
          <label>Email*</label>
          <input
            type="email"
            placeholder="you@gmail.com"
            required
            name="ownerEmail"
            value={ownerEmail}
            onChange={handleInputChange}
          />
        </div>
        <div className="password-input">
          <label>Password*</label>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="*********"
            required
            name="ownerPassword"
            value={ownerPassword}
            onChange={handleInputChange}
          />
          <div onClick={() => setShowPassword(!showPassword)} className="show-password">
            {!showPassword && <div className="cross-line"></div>}
            <EyeIcon />
          </div>
        </div>
      </div>
    </div>
  );
}
