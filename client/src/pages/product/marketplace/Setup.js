import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import {
  fetchMarketplaceKYCStatus,
  submitMarketplaceKYC,
  generateMarketplaceStoreToken,
  selectKYC,
  selectKYCLoading,
  selectKYCError,
  selectKYCSubmitting,
  clearKYCError,
} from "../../../redux/features/kyc/kycSlice";
import kycService from "../../../services/kycService"; // kept for potential direct service calls
import "./Setup.css";

/**
 * Marketplace Setup Component (Phase 2)
 * Handles KYC submission and store token generation
 */
const Setup = () => {
  const dispatch = useDispatch();
  const kyc = useSelector(selectKYC);
  const loading = useSelector(selectKYCLoading);
  const error = useSelector(selectKYCError);
  const submitting = useSelector(selectKYCSubmitting);

  const [formData, setFormData] = useState({
    ownerFullName: "",
    ownerNationalIdNumber: "",
    businessRegNumber: "",
    businessAddress: {
      street: "",
      city: "",
      state: "",
    },
    bankAccountName: "",
    bankAccountNumber: "",
    bankName: "",
    ownerIdDocument: null,
    businessRegDocument: null,
  });

  const [storeToken, setStoreToken] = useState(null);
  const [storeUrl, setStoreUrl] = useState(null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load KYC status on mount
  useEffect(() => {
    dispatch(fetchMarketplaceKYCStatus());
  }, [dispatch]);

  // Pre-fill form with existing data if available
  useEffect(() => {
    if (kyc && kyc.ownerFullName) {
      setFormData({
        ownerFullName: kyc.ownerFullName || "",
        ownerNationalIdNumber: kyc.ownerNationalIdNumber || "",
        businessRegNumber: kyc.businessRegNumber || "",
        businessAddress: {
          street: kyc.businessAddress?.street || "",
          city: kyc.businessAddress?.city || "",
          state: kyc.businessAddress?.state || "",
        },
        bankAccountName: kyc.bankAccountName || "",
        bankAccountNumber: kyc.bankAccountNumber || "",
        bankName: kyc.bankName || "",
        ownerIdDocument: null,
        businessRegDocument: null,
      });
    }

    if (kyc && kyc.storeToken) {
      setStoreToken(kyc.storeToken);
      setStoreUrl(
        `${window.location.origin}/marketplace/store/${kyc.storeToken}`
      );
    }
  }, [kyc]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name.startsWith("address_")) {
      const addressField = name.replace("address_", "");
      setFormData((prev) => ({
        ...prev,
        businessAddress: {
          ...prev.businessAddress,
          [addressField]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files && files[0] ? files[0] : null,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (
      !formData.ownerFullName.trim() ||
      !formData.ownerNationalIdNumber.trim() ||
      !formData.businessRegNumber.trim()
    ) {
      toast.error("Please fill in all owner and business information");
      return;
    }

    if (
      !formData.businessAddress.street.trim() ||
      !formData.businessAddress.city.trim() ||
      !formData.businessAddress.state.trim()
    ) {
      toast.error("Please fill in complete address information");
      return;
    }

    if (
      !formData.bankAccountName.trim() ||
      !formData.bankAccountNumber.trim() ||
      !formData.bankName.trim()
    ) {
      toast.error("Please fill in complete bank account information");
      return;
    }

    try {
      const payload = new FormData();
      payload.append("ownerFullName", formData.ownerFullName.trim());
      payload.append("ownerNationalIdNumber", formData.ownerNationalIdNumber.trim());
      payload.append("businessRegNumber", formData.businessRegNumber.trim());
      payload.append("businessAddress", JSON.stringify(formData.businessAddress));
      payload.append("bankAccountName", formData.bankAccountName.trim());
      payload.append("bankAccountNumber", formData.bankAccountNumber.trim());
      payload.append("bankName", formData.bankName.trim());
      if (formData.ownerIdDocument) {
        payload.append("ownerIdDocument", formData.ownerIdDocument);
      }
      if (formData.businessRegDocument) {
        payload.append("businessRegDocument", formData.businessRegDocument);
      }

      const result = await dispatch(submitMarketplaceKYC(payload)).unwrap();
      toast.success(
        "KYC submitted successfully! Awaiting admin review. We'll notify you once the review is complete."
      );
    } catch (err) {
      const errorMsg = typeof err === "string" ? err : "Failed to submit KYC";
      toast.error(errorMsg);
    }
  };

  const handleGenerateStoreToken = async () => {
    setGeneratingToken(true);
    try {
      const result = await dispatch(
        generateMarketplaceStoreToken()
      ).unwrap();

      if (result.storeToken && result.storeUrl) {
        setStoreToken(result.storeToken);
        setStoreUrl(result.storeUrl);
        toast.success("Store link generated successfully!");
      }
    } catch (err) {
      const errorMsg = typeof err === "string" ? err : "Failed to generate store token";
      toast.error(errorMsg);
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleCopyLink = () => {
    if (storeUrl) {
      navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      toast.success("Store link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="setup-page">
        <div className="setup-container">
          <div className="loading-state">
            <p>Loading your KYC information...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-page">
      <div className="setup-container">
        <div className="setup-header">
          <h1>Marketplace Setup & KYC Verification</h1>
          <p>
            Complete your KYC verification to unlock marketplace features and get a
            store link to share with buyers
          </p>
        </div>

        {/* Status Banners */}
        {kyc?.status === "approved" && (
          <div className="status-banner status-approved">
            <span className="banner-icon">✓</span>
            <div className="banner-content">
              <h3>Your Business is Approved</h3>
              <p>Congratulations! Your marketplace KYC has been approved.</p>
            </div>
          </div>
        )}

        {kyc?.status === "submitted" && (
          <div className="status-banner status-pending">
            <span className="banner-icon">⏳</span>
            <div className="banner-content">
              <h3>Documents Submitted</h3>
              <p>Your KYC submission is being reviewed. We'll notify you once the review is complete.</p>
            </div>
          </div>
        )}

        {kyc?.status === "under_review" && (
          <div className="status-banner status-pending">
            <span className="banner-icon">⏳</span>
            <div className="banner-content">
              <h3>Under Review</h3>
              <p>Your KYC documents are currently under review by our admin team.</p>
            </div>
          </div>
        )}

        {kyc?.status === "rejected" && (
          <div className="status-banner status-rejected">
            <span className="banner-icon">✕</span>
            <div className="banner-content">
              <h3>Submission Rejected</h3>
              <p>{kyc.rejectionReason || "Please resubmit with the required information."}</p>
              <p style={{ marginTop: "8px", fontSize: "12px" }}>
                You can resubmit your KYC below with the corrected information.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="error-banner">
            <p>
              {error.includes("non-JSON") || error.includes("Malformed") || error.includes("token")
                ? "Unable to connect to the server. Please check your connection and try refreshing."
                : error}
            </p>
            <button
              className="dismiss-btn"
              onClick={() => dispatch(clearKYCError())}
            >
              ✕
            </button>
          </div>
        )}

        {/* State A: KYC Form (Not Approved) */}
        {kyc?.status !== "approved" && (
          <form className="kyc-form" onSubmit={handleSubmit}>
            {/* Owner Information Section */}
            <section className="form-section">
              <h2>Owner Information</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="ownerFullName">Full Name *</label>
                  <input
                    type="text"
                    id="ownerFullName"
                    name="ownerFullName"
                    placeholder="Enter your full name"
                    value={formData.ownerFullName}
                    onChange={handleInputChange}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="ownerNationalIdNumber">National ID Number *</label>
                  <input
                    type="text"
                    id="ownerNationalIdNumber"
                    name="ownerNationalIdNumber"
                    placeholder="e.g., BVN or NIN"
                    value={formData.ownerNationalIdNumber}
                    onChange={handleInputChange}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="form-group full-width">
                  <label htmlFor="ownerIdDocument">Owner ID Document</label>
                  <input
                    type="file"
                    id="ownerIdDocument"
                    name="ownerIdDocument"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={submitting}
                  />
                  {kyc?.ownerIdDocumentUrl ? (
                    <small>Document on file: {kyc.ownerIdDocumentUrl}</small>
                  ) : null}
                </div>
              </div>
            </section>

            {/* Business Information Section */}
            <section className="form-section">
              <h2>Business Information</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="businessRegNumber">Registration Number *</label>
                  <input
                    type="text"
                    id="businessRegNumber"
                    name="businessRegNumber"
                    placeholder="e.g., BRN123456789"
                    value={formData.businessRegNumber}
                    onChange={handleInputChange}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="form-group full-width">
                  <label htmlFor="businessRegDocument">Business Registration Document</label>
                  <input
                    type="file"
                    id="businessRegDocument"
                    name="businessRegDocument"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={submitting}
                  />
                  {kyc?.businessRegDocumentUrl ? (
                    <small>Document on file: {kyc.businessRegDocumentUrl}</small>
                  ) : null}
                </div>
              </div>
            </section>

            {/* Address Information Section */}
            <section className="form-section">
              <h2>Business Address</h2>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label htmlFor="address_street">Street Address *</label>
                  <input
                    type="text"
                    id="address_street"
                    name="address_street"
                    placeholder="e.g., 123 Business Street"
                    value={formData.businessAddress.street}
                    onChange={handleInputChange}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="address_city">City *</label>
                  <input
                    type="text"
                    id="address_city"
                    name="address_city"
                    placeholder="e.g., Lagos"
                    value={formData.businessAddress.city}
                    onChange={handleInputChange}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="address_state">State *</label>
                  <input
                    type="text"
                    id="address_state"
                    name="address_state"
                    placeholder="e.g., Lagos"
                    value={formData.businessAddress.state}
                    onChange={handleInputChange}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>
            </section>

            {/* Bank Information Section */}
            <section className="form-section">
              <h2>Bank Account Information</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="bankName">Bank Name *</label>
                  <input
                    type="text"
                    id="bankName"
                    name="bankName"
                    placeholder="e.g., Zenith Bank, GTBank"
                    value={formData.bankName}
                    onChange={handleInputChange}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="bankAccountNumber">Account Number *</label>
                  <input
                    type="text"
                    id="bankAccountNumber"
                    name="bankAccountNumber"
                    placeholder="10-digit account number"
                    value={formData.bankAccountNumber}
                    onChange={handleInputChange}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="form-group full-width">
                  <label htmlFor="bankAccountName">Account Name *</label>
                  <input
                    type="text"
                    id="bankAccountName"
                    name="bankAccountName"
                    placeholder="Name as it appears in the bank"
                    value={formData.bankAccountName}
                    onChange={handleInputChange}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>
            </section>

            <button
              type="submit"
              className="submit-button"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit KYC"}
            </button>
          </form>
        )}

        {/* State B: Store Link (Visible always, gated by approval) */}
        <div className="store-link-section">
          <div className="store-link-card">
            <h2>Your Marketplace Store</h2>
            <p>
              {kyc?.status === "approved"
                ? "Your store is now live on the SellSquare marketplace. Share your unique store link with customers to showcase your products."
                : "Your store link will be available once your marketplace KYC is approved."}
            </p>

            <button
              className="generate-button"
              onClick={handleGenerateStoreToken}
              disabled={kyc?.status !== "approved" || generatingToken || storeToken}
              title={
                kyc?.status !== "approved"
                  ? "KYC approval is required before generating a store link"
                  : ""
              }
            >
              {kyc?.status !== "approved"
                ? "Generate Store Link (Pending Approval)"
                : generatingToken
                  ? "Generating..."
                  : storeToken
                    ? "Link Generated"
                    : "Generate Store Link"}
            </button>

            {storeUrl && (
              <div className="store-link-display">
                <label>Your Store Link:</label>
                <div className="store-link-input-group">
                  <input
                    type="text"
                    value={storeUrl}
                    readOnly
                    className="store-link-input"
                  />
                  <button
                    type="button"
                    className="copy-button"
                    onClick={handleCopyLink}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p className="store-link-help">
                  This link displays only your products to buyers
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Setup;
