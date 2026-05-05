import React, { useRef, useState } from "react";
import styles from "./auth.scss";
import { toast } from "sonner";
import { registerBusiness, validateEmail } from "../../../services/authService";
import { useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { SET_LOGIN, SET_NAME } from "../../../redux/features/auth/authSlice";
import { useAsyncToast } from "../../../customHook/useAsyncToast";
import "./signup.css";
import { logoutBuyer } from "../../../redux/features/buyerAuth/buyerAuthSlice";
import Personal from "./registerComponents/Personal";
import Business from "./registerComponents/Business";
import { Helmet } from "react-helmet";

// SVG Icon Components
const PersonalIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="12"
      cy="7"
      r="4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BusinessIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 22V12H15V22"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const VerificationIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.7088 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M22 4L12 14.01L9 11.01"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CameraIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M19 15C19 15.5304 18.7893 16.0391 18.4142 16.4142C18.0391 16.7893 17.5304 17 17 17H3C2.46957 17 1.96086 16.7893 1.58579 16.4142C1.21071 16.0391 1 15.5304 1 15V6C1 5.46957 1.21071 4.96086 1.58579 4.58579C1.96086 4.21071 2.46957 4 3 4H6L8 1H12L14 4H17C17.5304 4 18.0391 4.21071 18.4142 4.58579C18.7893 4.96086 19 5.46957 19 6V15Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="10"
      cy="10"
      r="3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BackArrowIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M15 10H5M5 10L10 15M5 10L10 5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ForwardArrowIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5 10H15M15 10L10 5M15 10L10 15"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PlaceholderImageIcon = () => (
  <svg
    width="100"
    height="100"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="100" height="100" rx="10" fill="#f0f0f0" />
    <path
      d="M40 50L50 60L70 40"
      stroke="#999"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <text x="50" y="80" fontSize="12" fill="#666" textAnchor="middle">
      Logo
    </text>
  </svg>
);

const initialState = {
  businessName: "",
  businessEmail: "",
  ownerFirstName: "",
  ownerLastName: "",
  ownerEmail: "",
  ownerPassword: "",
  industry: "",
  country: "",
  image: {},
};

const Register = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { executeWithToast } = useAsyncToast();
  const [formData, setformData] = useState(initialState);
  const [stage, setStage] = useState("personal");
  const [selectedImage, setSelectedImage] = useState(null);
  const [profileImage, setProfileImage] = useState("");
  const [isAgreementChecked, setIsAgreementChecked] = useState(false);
  const fileInputRef = useRef(null);

  const {
    businessName,
    businessEmail,
    ownerFirstName,
    ownerLastName,
    ownerEmail,
    ownerPassword,
    businessAddress,
    businessPhone,
    industry,
    country,
  } = formData;

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Convert email fields to lowercase before setting form data
    if (name === "businessEmail" || name === "ownerEmail") {
      setformData({ ...formData, [name]: value.toLowerCase() });
    } else {
      setformData({ ...formData, [name]: value });
    }
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

    if (
      !businessName ||
      !businessEmail ||
      !ownerFirstName ||
      !ownerLastName ||
      !ownerEmail ||
      !ownerPassword
    ) {
      return toast.error("All fields are required");
    }
    if (ownerPassword.length < 6) {
      return toast.error("Passwords must be up to 6 characters");
    }
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

          const businessData = {
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
            photo: profileImage
              ? imageURL
              : "https://i.ibb.co/4pDNDk1/avatar.png",
          };

          const data = await registerBusiness(businessData);
          // Clear any existing buyer session
          await dispatch(logoutBuyer());
          
          await dispatch(SET_LOGIN(true));
          await dispatch(SET_NAME(data.businessName));
          navigate("/register/success");
        })(),
        {
          loading: "Creating your account...",
          success: "Registration successful!",
          error: "Registration failed. Please try again.",
        }
      );
    } catch (error) {
      console.error("Registration error:", error);
    }
  };

  const handleNextStage = () => {
    if (stage === "personal") {
      // Check if personal stage fields are filled
      if (ownerFirstName && ownerLastName && ownerEmail && ownerPassword) {
        setStage("business");
      } else {
        toast.error("Please fill in all personal information.");
      }
    }
    if (stage === "business") {
      // Check if business stage fields are filled
      if (businessName && businessEmail) {
        setStage("verification");
      } else {
        toast.error("Please fill in all business information.");
      }
    }
    if (stage === "verification") {
      setStage("submit");
    }
    // No need to check for verification stage, as it's the last stage
  };

  const handlePrevStage = () => {
    if (stage === "submit") {
      setStage("verification");
    }
    if (stage === "verification") {
      setStage("business");
    }
    if (stage === "business") {
      setStage("personal");
    }
  };

  const handleAgreement = (e) => {
    setIsAgreementChecked(e.target.checked);
  };

  return (
    <>
      {/* Loader removed - using toast notifications instead */}
      <Helmet>
        <title>
          Register Your Business | Sell Square - Free Cloud Inventory Management
        </title>
        <meta
          name="description"
          content="Start managing your business efficiently with Sell Square. Free cloud-based inventory management, POS system, sales tracking, customer management, and team collaboration. Perfect for SMEs, retailers, and wholesalers."
        />
        <meta
          name="keywords"
          content="register business inventory software, free inventory management, cloud POS system, SME business management, retail management software, warehouse management, sales tracking software, business registration, inventory system signup"
        />
        <meta name="author" content="Sell Square" />
        <meta name="robots" content="index, follow" />
        <meta
          property="og:title"
          content="Register Your Business | Sell Square - Start Free"
        />
        <meta
          property="og:description"
          content="Join thousands of businesses using Sell Square. Get real-time inventory tracking, automated sales recording, customer management, and business analytics. Free plan available!"
        />
        <meta property="og:type" content="website" />
        <meta
          property="og:url"
          content="https://www.sellsquarehub.com/register"
        />
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
          content="Register Your Business | Sell Square"
        />
        <meta
          name="twitter:description"
          content="Start managing your business efficiently. Free cloud-based inventory management for SMEs."
        />
        <meta
          name="twitter:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <link rel="canonical" href="https://www.sellsquarehub.com/register" />
      </Helmet>
      <div className="sign-up-businesss">
        <div className="sign-up-business-header">
          <h1>Setting up Your Business Account</h1>
          <p>
            Already created an account? <Link to="/login">Login</Link>
          </p>
        </div>
        <div className="business-informations">
          <div className="sign-up-cards">
            <div className="sign-up-card">
              <div
                className={
                  stage === "personal"
                    ? "sign-up-card-icon active-icon-card"
                    : "sign-up-card-icon"
                }
              >
                <PersonalIcon />
              </div>
              <span>Personal</span>
            </div>
            <div className="sign-up-lines"></div>
            <div className="sign-up-card">
              <div
                className={
                  stage === "business"
                    ? "sign-up-card-icon active-icon-card"
                    : "sign-up-card-icon"
                }
              >
                <BusinessIcon />
              </div>
              <span>Business</span>
            </div>
            <div className="sign-up-lines"></div>
            <div className="sign-up-card">
              <div
                className={
                  stage === "verification"
                    ? "sign-up-card-icon active-icon-card"
                    : "sign-up-card-icon"
                }
              >
                <VerificationIcon />
              </div>
              <span>Verification</span>
            </div>
          </div>
          <div className="company-logo">
            {stage !== "verification" && stage !== "submit" ? (
              <>
                <div className="company-logo-icon">
                  {selectedImage ? (
                    <img src={selectedImage} alt="company logo" />
                  ) : (
                    <PlaceholderImageIcon />
                  )}
                  <div
                    className="company-logo-icon-pencil"
                    onClick={handlePencilClick}
                  >
                    <CameraIcon />
                    {/* </div> */}
                  </div>
                </div>
              </>
            ) : (
              ""
            )}
          </div>
          {stage !== "verification" && stage !== "submit" ? (
            <h6 className="center-text">Accepts: PNG, JPEG and JPG only</h6>
          ) : null}
        </div>

        <div className="sign-up-actions">
          <div className="sign-up-forms">
            <form
              onSubmit={(e) =>
                stage === "submit" ? register(e) : e.preventDefault()
              }
              method="post"
              enctype="multipart/form-data"
            >
              <input
                type="file"
                accept="image/*"
                name="image"
                onChange={handleImageChange}
                style={{ display: "none" }}
                ref={fileInputRef}
              />
              {stage === "personal" && (
                <Personal
                  handleInputChange={handleInputChange}
                  ownerFirstName={ownerFirstName}
                  ownerLastName={ownerLastName}
                  ownerEmail={ownerEmail}
                  ownerPassword={ownerPassword}
                />
              )}

              {stage === "business" && (
                <Business
                  handleInputChange={handleInputChange}
                  businessName={businessName}
                  businessEmail={businessEmail}
                  businessAddress={businessAddress}
                  businessPhone={businessPhone}
                  industry={industry}
                  country={country}
                />
              )}

              {stage === "verification" && (
                <div className="verify-informations">
                  <div>
                    <h3>
                      Kindly verify all passwords and other login informations
                      before submiting this form.
                    </h3>
                    <div className="agreement_checkbox">
                      <input
                        onChange={(e) => handleAgreement(e)}
                        type="checkbox"
                        checked={isAgreementChecked}
                      />
                      <p>
                        I have read and agreed to GNLIFE Inventory's &nbsp;
                        <a target="_blank" href="/terms-and-agreement">
                          Terms and conditions
                        </a>{" "}
                        &nbsp; and &nbsp;
                        <a target="_blank" href="/our-policy">
                          privacy policy
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {stage === "submit" && (
                <div className="verify-informations">
                  <div>
                    <h3>
                      Kindly verify all passwords and other login informations
                      before submiting this form.
                    </h3>
                    <div className="agreement_checkbox">
                      <input
                        onChange={(e) => handleAgreement(e)}
                        type="checkbox"
                        checked={isAgreementChecked}
                      />
                      <p>
                        I have read and agreed to GNLIFE Inventory's{" "}
                        <Link to="/terms-and-agreement">
                          Terms and conditions
                        </Link>
                        <Link to="/our-policy">privacy policy</Link> and{" "}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="sign-up-buttons">
                {stage === "personal" ? (
                  <button
                    onClick={handlePrevStage}
                    type="button"
                    className="go-back"
                    disabled
                  >
                    <BackArrowIcon />
                    Go Back
                  </button>
                ) : (
                  <button
                    onClick={handlePrevStage}
                    type="button"
                    className="go-back"
                  >
                    <BackArrowIcon />
                    Go Back
                  </button>
                )}

                {/* {
                  stage === "verification" && <button
                    onClick={handleNextStage}
                    type="submit"
                    className="proceed"
                  >
                    Submit <ForwardArrowIcon />
                  </button>
                } */}

                <button
                  onClick={handleNextStage}
                  type={stage === "submit" ? "submit" : "button"}
                  className={`proceed ${
                    (stage === "verification" || stage === "submit") &&
                    isAgreementChecked === false
                      ? "disabled_bg"
                      : ""
                  }`}
                  disabled={
                    (stage === "verification" || stage === "submit") &&
                    isAgreementChecked === false
                      ? true
                      : false
                  }
                >
                  {stage === "verification" || stage === "submit"
                    ? "Submit"
                    : "Proceed"}
                  <ForwardArrowIcon />
                </button>

                {/* {stage === "submit" ? (
                  <button
                    onClick={handleNextStage}
                    type="submit"
                    className="proceed"
                  >
                    Submit <img src={forwardarrow} alt="proceed" />
                  </button>
                ) : (
                  <button
                    onClick={handleNextStage}
                    type="button"
                    className="proceed"
                  >
                    Proceed <img src={forwardarrow} alt="proceed" />
                  </button>
                )} */}
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default Register;
