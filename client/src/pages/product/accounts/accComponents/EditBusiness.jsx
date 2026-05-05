import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { updateBusiness, validateEmail } from "../../../../services/authService";
import { useDispatch, useSelector } from "react-redux";
import { SET_NAME, SET_BUSINESS, selectLoggedInBusinessOwner, selectUser } from "../../../../redux/features/auth/authSlice";
import { useAsyncToast } from "../../../../customHook/useAsyncToast";
import "./editBusiness.css";

// SVG Icon Components
const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 4C4.5 4 2 10 2 10C2 10 4.5 16 10 16C15.5 16 18 10 18 10C18 10 15.5 4 10 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 15C19 15.5304 18.7893 16.0391 18.4142 16.4142C18.0391 16.7893 17.5304 17 17 17H3C2.46957 17 1.96086 16.7893 1.58579 16.4142C1.21071 16.0391 1 15.5304 1 15V6C1 5.46957 1.21071 4.96086 1.58579 4.58579C1.96086 4.21071 2.46957 4 3 4H6L8 1H12L14 4H17C17.5304 4 18.0391 4.21071 18.4142 4.58579C18.7893 4.96086 19 5.46957 19 6V15Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EditBusiness = ({ business, handleCancel }) => {
  const dispatch = useDispatch();
  const { executeWithToast } = useAsyncToast();
  const [formData, setformData] = useState(business || {});
  const [selectedImage, setSelectedImage] = useState(null);
  const [profileImage, setProfileImage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const currentUser = useSelector(selectUser);
  const admin = useSelector(selectLoggedInBusinessOwner);

  const fileInputRef = useRef(null);

  // Keep form data in sync when business prop updates
  useEffect(() => {
    setformData(business || {});
  }, [business]);

  const {
    businessName = "",
    businessEmail = "",
    ownerFirstName = "",
    ownerLastName = "",
    ownerEmail = "",
    ownerPassword = "",
    businessAddress = "",
    businessPhone = "",
    industry = "",
    photo = "",
    country = "",
  } = formData || {};

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setformData({ ...formData, [name]: value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    // console.log(file)

    if (file) {
      setSelectedImage(URL.createObjectURL(file));
      setProfileImage(e.target.files[0]);
      setformData({ ...formData, image: file });
    }
  };

  const handlePencilClick = () => {
    fileInputRef.current.click();
  };

  const register = async (e) => {
    e.preventDefault();

    if (!validateEmail(businessEmail)) {
      return toast.error("Please enter a valid email");
    }

    try {
      await executeWithToast(
        (async () => {
          let imageURL;
          if (
            profileImage &&
            (profileImage.type === "image/jpeg" ||
              profileImage.type === "image/jpg" ||
              profileImage.type === "image/png")
          ) {
            const image = new FormData();
            image.append("file", profileImage);
            image.append("cloud_name", "dfrwntkjm");
            image.append("upload_preset", "hqq7lql7");

            const response = await fetch(
              "https://api.cloudinary.com/v1_1/dfrwntkjm/image/upload",
              { method: "post", body: image }
            );
            const imgData = await response.json();
            imageURL = imgData.url.toString();
          }

          const userData = {
            businessName,
            businessEmail,
            ownerFirstName,
            ownerLastName,
            ownerEmail,
            businessAddress,
            businessPhone,
            ownerPassword,
            industry,
            country,
            photo: profileImage ? imageURL : photo,
          };

          const data = await updateBusiness(userData);

          // Update Redux state with all fields from backend response
          if (data) {
            await dispatch(SET_NAME(data.businessName));
            await dispatch(SET_BUSINESS(data));
          }

          handleCancel();
        })(),
        {
          loading: "Updating business details...",
          success: "Business details updated successfully!",
          error: "Failed to update business details.",
        }
      );
    } catch (error) {
      console.error("Update business error:", error);
    }
  };

  return (
    <>
      {admin || currentUser?.permissions?.grantPermissions ? (
        <div className="edit-business-modal">
          <div className="edit-container">
            <div className="edit-header">
              <h1>Edit Business Profile</h1>
              <p>Update your business information and settings</p>
            </div>

            <form onSubmit={(e) => register(e)} className="edit-form">
              <input
                type="file"
                accept="image/*"
                name="image"
                onChange={handleImageChange}
                ref={fileInputRef}
                style={{ display: "none" }}
              />

              <div className="form-section">
                <div className="logo-section">
                  <div className="logo-container">
                    <img src={selectedImage ? selectedImage : photo} alt="Business logo" />
                  </div>
                  <button type="button" className="logo-btn" onClick={handlePencilClick}>
                    <CameraIcon />
                    Upload Logo
                  </button>
                  <p className="logo-hint">PNG, JPEG, or JPG (recommended: square)</p>
                </div>
              </div>

              <div className="form-section">
                <h2>Owner Information</h2>
                <div className="form-row">
                  <label className="form-field">
                    <span className="label-text">First Name*</span>
                    <input
                      type="text"
                      placeholder="Enter first name"
                      required
                      name="ownerFirstName"
                      value={ownerFirstName}
                      onChange={handleInputChange}
                    />
                  </label>
                  <label className="form-field">
                    <span className="label-text">Last Name*</span>
                    <input
                      type="text"
                      placeholder="Enter last name"
                      required
                      name="ownerLastName"
                      value={ownerLastName}
                      onChange={handleInputChange}
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label className="form-field">
                    <span className="label-text">Email*</span>
                    <input
                      type="email"
                      placeholder="owner@example.com"
                      required
                      name="ownerEmail"
                      value={ownerEmail}
                      onChange={handleInputChange}
                    />
                  </label>
                  <label className="form-field password-field">
                    <span className="label-text">Password*</span>
                    <div className="password-input-wrapper">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Hidden for security"
                        required
                        name="ownerPassword"
                        disabled
                        value={ownerPassword}
                        onChange={handleInputChange}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="toggle-password"
                        aria-label="Toggle password visibility"
                      >
                        {!showPassword && <span className="eye-line"></span>}
                        <EyeIcon />
                      </button>
                    </div>
                  </label>
                </div>
              </div>

              <div className="form-section">
                <h2>Business Information</h2>
                <div className="form-row">
                  <label className="form-field">
                    <span className="label-text">Business Name*</span>
                    <input
                      type="text"
                      placeholder="Your business name"
                      required
                      name="businessName"
                      value={businessName}
                      onChange={handleInputChange}
                    />
                  </label>
                  <label className="form-field">
                    <span className="label-text">Business Email*</span>
                    <input
                      type="email"
                      placeholder="business@example.com"
                      required
                      name="businessEmail"
                      value={businessEmail}
                      onChange={handleInputChange}
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label className="form-field">
                    <span className="label-text">Business Address*</span>
                    <input
                      type="text"
                      placeholder="Street address"
                      required
                      name="businessAddress"
                      value={businessAddress}
                      onChange={handleInputChange}
                    />
                  </label>
                  <label className="form-field">
                    <span className="label-text">Business Phone*</span>
                    <input
                      type="text"
                      placeholder="+1234567890"
                      required
                      name="businessPhone"
                      value={businessPhone}
                      onChange={handleInputChange}
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label className="form-field">
                    <span className="label-text">Industry*</span>
                    <input
                      type="text"
                      placeholder="e.g., Technology, Retail"
                      required
                      name="industry"
                      value={industry}
                      onChange={handleInputChange}
                    />
                  </label>
                  <label className="form-field">
                    <span className="label-text">Country*</span>
                    <input
                      type="text"
                      placeholder="e.g., Nigeria"
                      required
                      name="country"
                      value={country}
                      onChange={handleInputChange}
                    />
                  </label>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => handleCancel()} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="business-profile-item stores">
          <h3>Unauthorized</h3>
        </div>
      )}
    </>
  );
};

export default EditBusiness;
