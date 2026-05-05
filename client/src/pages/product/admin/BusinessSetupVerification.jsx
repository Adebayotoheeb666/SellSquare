import React, { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchAllKYCs,
  verifyKYC,
  selectAllKYCs,
  selectKYCLoading,
  selectKYCError,
  selectKYCVerifying,
  selectKYCPagination,
} from "../../../redux/features/kyc/kycSlice";
import { useAsyncToast } from "../../../customHook/useAsyncToast";

const BusinessSetupVerification = () => {
  const dispatch = useDispatch();
  const { executeWithToast } = useAsyncToast();
  
  const kycs = useSelector(selectAllKYCs);
  const loading = useSelector(selectKYCLoading);
  const error = useSelector(selectKYCError);
  const verifying = useSelector(selectKYCVerifying);
  const pagination = useSelector(selectKYCPagination);

  const [statusFilter, setStatusFilter] = useState("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedKYC, setExpandedKYC] = useState(null);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const verifyFormRef = useRef(null);

  const normalizeKyc = (kyc) => {
    const business = kyc?.business || {};
    const normalizedStatus = kyc?.status === "submitted" ? "pending" : kyc?.status;
    return {
      ...kyc,
      status: normalizedStatus,
      displayStatus: kyc?.status || normalizedStatus,
      businessId: business?._id || kyc?.businessId || kyc?.business,
      businessName: kyc?.businessName || business?.businessName || "Unknown Business",
      businessEmail: kyc?.businessEmail || business?.businessEmail || "N/A",
      businessPhone: kyc?.businessPhone || business?.phone || "N/A",
      businessType: kyc?.businessType || business?.industry || "N/A",
      registrationNumber: kyc?.registrationNumber || kyc?.businessRegNumber || kyc?.businessRegistrationNumber || "N/A",
      taxId: kyc?.taxId || "N/A",
      ownerName: kyc?.businessOwner?.name || kyc?.ownerFullName || "N/A",
      ownerEmail: kyc?.businessOwner?.email || business?.businessEmail || "N/A",
      ownerPhone: kyc?.businessOwner?.phone || "N/A",
      submittedDate: kyc?.submittedAt || kyc?.createdAt,
      addressText:
        kyc?.businessAddress && typeof kyc.businessAddress === "object"
          ? [kyc.businessAddress.street, kyc.businessAddress.city, kyc.businessAddress.state]
              .filter(Boolean)
              .join(", ")
          : (kyc?.businessAddress || "N/A"),
    };
  };

  useEffect(() => {
    dispatch(
      fetchAllKYCs({
        status: statusFilter === "all" ? "all" : statusFilter,
        page: currentPage,
        limit: 20,
      })
    );
  }, [dispatch, statusFilter, currentPage]);

  const handleApprove = async (kycId) => {
    if (!verificationNotes.trim()) {
      alert("Please enter verification notes");
      return;
    }

    await executeWithToast(
      dispatch(
        verifyKYC({
          kycId,
          approved: true,
          verificationNotes: verificationNotes.trim(),
        })
      ),
      {
        pending: "Approving KYC...",
        success: "KYC approved successfully",
        error: "Failed to approve KYC",
      }
    );

    setExpandedKYC(null);
    setVerificationNotes("");
  };

  const handleReject = async (kycId) => {
    if (!rejectionReason.trim()) {
      alert("Please enter rejection reason");
      return;
    }

    await executeWithToast(
      dispatch(
        verifyKYC({
          kycId,
          approved: false,
          rejectionReason: rejectionReason.trim(),
        })
      ),
      {
        pending: "Rejecting KYC...",
        success: "KYC rejected successfully",
        error: "Failed to reject KYC",
      }
    );

    setExpandedKYC(null);
    setRejectionReason("");
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "approved":
        return "status-approved";
      case "rejected":
        return "status-rejected";
      case "pending":
      default:
        return "status-pending";
    }
  };

  return (
    <div className="setup_verification_panel">
      <div className="setup_verification_header">
        <div>
          <h2>Business Setup Verification</h2>
          <p>Review and verify business KYC (Know Your Customer) submissions</p>
        </div>
        <button
          className="refresh_btn"
          onClick={() =>
            dispatch(
              fetchAllKYCs({
                status: statusFilter === "all" ? "all" : statusFilter,
                page: currentPage,
                limit: 20,
              })
            )
          }
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Status Filter */}
      <div className="kyc_filters">
        <button
          className={`filter_chip ${statusFilter === "all" ? "active" : ""}`}
          onClick={() => {
            setStatusFilter("all");
            setCurrentPage(1);
          }}
        >
          All
        </button>
        <button
          className={`filter_chip ${statusFilter === "pending" ? "active" : ""}`}
          onClick={() => {
            setStatusFilter("pending");
            setCurrentPage(1);
          }}
        >
          Pending
        </button>
        <button
          className={`filter_chip ${statusFilter === "approved" ? "active" : ""}`}
          onClick={() => {
            setStatusFilter("approved");
            setCurrentPage(1);
          }}
        >
          Approved
        </button>
        <button
          className={`filter_chip ${statusFilter === "rejected" ? "active" : ""}`}
          onClick={() => {
            setStatusFilter("rejected");
            setCurrentPage(1);
          }}
        >
          Rejected
        </button>
      </div>

      {/* KYC List */}
      {loading && kycs.length === 0 ? (
        <div className="kyc_empty_state">
          <p>Loading KYC submissions...</p>
        </div>
      ) : error ? (
        <div className="kyc_error_state">
          <p>Error loading KYCs: {error}</p>
        </div>
      ) : kycs.length === 0 ? (
        <div className="kyc_empty_state">
          <p>No KYC submissions to review</p>
        </div>
      ) : (
        <div className="kyc_list">
          {kycs.map((rawKyc) => {
            const kyc = normalizeKyc(rawKyc);
            return (
            <div
              key={kyc._id}
              className={`kyc_card ${expandedKYC === kyc._id ? "expanded" : ""}`}
            >
              <div
                className="kyc_card_header"
                onClick={() =>
                  setExpandedKYC(expandedKYC === kyc._id ? null : kyc._id)
                }
              >
                <div className="kyc_card_info">
                  <h3>{kyc.businessName}</h3>
                  <p className="kyc_business_details">
                    {kyc.businessEmail} · {kyc.businessPhone}
                  </p>
                  <p className="kyc_owner_details">
                    Owner: {kyc.ownerName} ({kyc.ownerEmail})
                  </p>
                </div>
                <div className="kyc_card_meta">
                  <span className={`kyc_status_badge ${getStatusBadgeClass(kyc.status)}`}>
                    {kyc.displayStatus?.charAt(0).toUpperCase() + kyc.displayStatus?.slice(1)}
                  </span>
                  <span className="kyc_submitted_date">
                    Submitted {formatDate(kyc.submittedDate)}
                  </span>
                </div>
                <button className="expand_toggle">
                  {expandedKYC === kyc._id ? "−" : "+"}
                </button>
              </div>

              {expandedKYC === kyc._id && (
                <div className="kyc_card_details">
                  {/* Business Information */}
                  <div className="kyc_section">
                    <h4>Business Information</h4>
                    <div className="kyc_field_group">
                      <div className="kyc_field">
                        <label>Business Name</label>
                        <p>{kyc.businessName}</p>
                      </div>
                      <div className="kyc_field">
                        <label>Business Type</label>
                        <p>{kyc.businessType}</p>
                      </div>
                      <div className="kyc_field">
                        <label>Registration Number</label>
                        <p>{kyc.registrationNumber}</p>
                      </div>
                      <div className="kyc_field">
                        <label>Tax ID</label>
                        <p>{kyc.taxId}</p>
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="kyc_section">
                    <h4>Contact Information</h4>
                    <div className="kyc_field_group">
                      <div className="kyc_field">
                        <label>Business Email</label>
                        <p>{kyc.businessEmail}</p>
                      </div>
                      <div className="kyc_field">
                        <label>Business Phone</label>
                        <p>{kyc.businessPhone}</p>
                      </div>
                      <div className="kyc_field">
                        <label>Business Address</label>
                        <p>{kyc.addressText}</p>
                      </div>
                    </div>
                  </div>

                  {/* Owner Information */}
                  <div className="kyc_section">
                    <h4>Owner Information</h4>
                    <div className="kyc_field_group">
                      <div className="kyc_field">
                        <label>Owner Name</label>
                        <p>{kyc.ownerName}</p>
                      </div>
                      <div className="kyc_field">
                        <label>Owner Email</label>
                        <p>{kyc.ownerEmail}</p>
                      </div>
                      <div className="kyc_field">
                        <label>Owner Phone</label>
                        <p>{kyc.ownerPhone}</p>
                      </div>
                    </div>
                  </div>

                  {/* Documents */}
                  {kyc.documents && kyc.documents.length > 0 && (
                    <div className="kyc_section">
                      <h4>Documents</h4>
                      <div className="kyc_documents">
                        {kyc.documents.map((doc, idx) => (
                          <a
                            key={idx}
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="kyc_document_link"
                          >
                            📄 {doc.type || `Document ${idx + 1}`}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Verification History */}
                  {kyc.verificationHistory && kyc.verificationHistory.length > 0 && (
                    <div className="kyc_section">
                      <h4>Verification History</h4>
                      <div className="kyc_history">
                        {kyc.verificationHistory.map((entry, idx) => (
                          <div key={idx} className="kyc_history_entry">
                            <div className="history_status">
                              <span className={`status_badge ${getStatusBadgeClass(entry.status)}`}>
                                {entry.status}
                              </span>
                              <span className="history_date">
                                {formatDate(entry.verifiedAt)}
                              </span>
                            </div>
                            {entry.notes && <p className="history_notes">{entry.notes}</p>}
                            {entry.rejectionReason && (
                              <p className="history_rejection">
                                Reason: {entry.rejectionReason}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Verification Actions */}
                  {kyc.status === "pending" && (
                    <div className="kyc_verification_form" ref={verifyFormRef}>
                      <h4>Verification Decision</h4>

                      <div className="kyc_form_section">
                        <label htmlFor={`verify-notes-${kyc._id}`}>
                          Verification Notes *
                        </label>
                        <textarea
                          id={`verify-notes-${kyc._id}`}
                          placeholder="Enter verification notes for admin records"
                          value={verificationNotes}
                          onChange={(e) => setVerificationNotes(e.target.value)}
                          rows="3"
                          disabled={verifying}
                        />
                      </div>

                      <div className="kyc_form_section">
                        <label htmlFor={`rejection-reason-${kyc._id}`}>
                          Rejection Reason (if rejecting) *
                        </label>
                        <textarea
                          id={`rejection-reason-${kyc._id}`}
                          placeholder="Explain why this KYC is being rejected (visible to business owner)"
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          rows="3"
                          disabled={verifying}
                        />
                      </div>

                      <div className="kyc_form_actions">
                        <button
                          className="approve_btn"
                          onClick={() => handleApprove(kyc.businessId || kyc._id)}
                          disabled={verifying}
                        >
                          {verifying ? "Processing..." : "Approve"}
                        </button>
                        <button
                          className="reject_btn"
                          onClick={() => handleReject(kyc.businessId || kyc._id)}
                          disabled={verifying}
                        >
                          {verifying ? "Processing..." : "Reject"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="kyc_pagination">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Previous
          </button>
          <span className="pagination_info">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            disabled={currentPage === pagination.pages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default BusinessSetupVerification;
