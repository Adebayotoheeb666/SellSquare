import React, { useState } from "react";
import { useSelector } from "react-redux";
import {
  selectBusiness,
  selectBusinessAddress,
  selectLoggedInBusinessOwner,
  selectName,
  selectUser,
} from "../../../../redux/features/auth/authSlice";
import EditBusiness from "./EditBusiness";

// Icon Components
const EditIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 2L16 5L6 15H3V12L13 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11 4L14 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BusinessIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LocationIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EmailIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M22 6L12 13L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 16.92V19.92C22 20.49 21.54 20.97 20.97 21C20.72 21.01 20.47 21.02 20.22 21.02C10.44 21.02 2.48 13.06 2.48 3.28C2.48 3.03 2.49 2.78 2.5 2.53C2.53 1.96 3.01 1.5 3.58 1.5H6.58C7.13 1.5 7.59 1.94 7.64 2.48C7.74 3.56 7.93 4.62 8.22 5.64C8.36 6.14 8.2 6.67 7.82 7.02L6.23 8.61C7.77 11.59 10.38 14.2 13.36 15.74L14.95 14.15C15.3 13.77 15.83 13.61 16.33 13.75C17.35 14.04 18.41 14.23 19.49 14.33C20.03 14.38 20.47 14.85 20.47 15.4V18.4C20.48 18.93 20.45 19.45 20.39 19.95C20.35 20.52 19.87 20.98 19.3 21C18.97 21.01 18.64 21.02 18.31 21.02" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function BusinessProfile() {
  const business = useSelector(selectBusiness);
  const name = useSelector(selectName);
  const businessAddress = useSelector(selectBusinessAddress);
  const currentUser = useSelector(selectUser);
  const admin = useSelector(selectLoggedInBusinessOwner);
  const [editBusinessModal, setEditBusinessModal] = useState(false);

  const canEdit = admin || currentUser?.permissions?.grantPermissions;
  const closeModal = () => setEditBusinessModal(false);

  return (
    <div className="business-profile-modern">
      {editBusinessModal && (
        <div className="edit-business-modal" onClick={closeModal}>
          <div
            className="edit-business-modal__card"
            onClick={(e) => e.stopPropagation()}
          >
            <EditBusiness
              business={business}
              handleCancel={closeModal}
            />
          </div>
        </div>
      )}

      {/* Header Card with Business Logo and Name */}
      <div className="profile-header-card">
        <div className="profile-header-content">
          <div className="profile-logo-wrapper">
            <img src={business?.photo} alt="Business Logo" className="profile-logo" />
            <div className="logo-badge">
              <BusinessIcon />
            </div>
          </div>
          <div className="profile-header-info">
            <h1 className="business-name">{name}</h1>
            <p className="business-industry">
              <span className="industry-badge">{business?.industry}</span>
            </p>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => setEditBusinessModal(true)}
            className="edit-profile-btn"
          >
            <EditIcon />
            <span>Edit Profile</span>
          </button>
        )}
      </div>

      {/* Business Information Grid */}
      <div className="profile-info-grid">
        {/* Business Details Card */}
        <div className="info-card">
          <div className="info-card-header">
            <BusinessIcon />
            <h3>Business Information</h3>
          </div>
          <div className="info-card-body">
            <div className="info-row">
              <span className="info-label">Business Name</span>
              <span className="info-value">{name}</span>
            </div>
            <div className="info-row">
              <EmailIcon />
              <div className="info-text">
                <span className="info-label">Business Email</span>
                <span className="info-value">{business?.businessEmail}</span>
              </div>
            </div>
            <div className="info-row">
              <PhoneIcon />
              <div className="info-text">
                <span className="info-label">Phone Number</span>
                <span className="info-value">{business?.businessPhone || 'Not provided'}</span>
              </div>
            </div>
            <div className="info-row">
              <LocationIcon />
              <div className="info-text">
                <span className="info-label">Address</span>
                <span className="info-value">{businessAddress}</span>
              </div>
            </div>
            <div className="info-row">
              <span className="info-label">Country</span>
              <span className="info-value">{business?.country}</span>
            </div>
          </div>
        </div>

        {/* Owner Information Card */}
        <div className="info-card">
          <div className="info-card-header">
            <UserIcon />
            <h3>Owner Information</h3>
          </div>
          <div className="info-card-body">
            <div className="info-row">
              <span className="info-label">Full Name</span>
              <span className="info-value">
                {business?.ownerFirstName} {business?.ownerLastName}
              </span>
            </div>
            <div className="info-row">
              <EmailIcon />
              <div className="info-text">
                <span className="info-label">Email Address</span>
                <span className="info-value">{business?.ownerEmail}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
