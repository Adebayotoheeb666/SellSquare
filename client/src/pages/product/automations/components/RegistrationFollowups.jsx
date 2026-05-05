import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import {
  fetchRegistrationFollowups,
  selectRegistrationFollowups,
  selectAutomationLoading,
} from "../../../../redux/features/automation/automationSlice";
import "./registrationFollowups.css";

const RegistrationFollowups = () => {
  const dispatch = useDispatch();
  const followups = useSelector(selectRegistrationFollowups);
  const isLoading = useSelector(selectAutomationLoading);
  const [selectedFollowup, setSelectedFollowup] = useState(null);
  const [filter, setFilter] = useState("in_sequence");

  useEffect(() => {
    dispatch(fetchRegistrationFollowups({ status: filter }));
  }, [dispatch, filter]);

  const getStatusBadge = (status) => {
    const statuses = {
      in_sequence: "badge-in-progress",
      completed: "badge-completed",
      paused: "badge-paused",
      unsubscribed: "badge-unsubscribed",
      converted: "badge-converted",
    };
    return statuses[status] || "badge-default";
  };

  const renderFollowupCard = (followup) => (
    <div key={followup._id} className="followup-card">
      <div className="followup-header">
        <div>
          <h4>{followup.contactName}</h4>
          <p className="followup-business">{followup.businessName}</p>
        </div>
        <span className={`followup-status ${getStatusBadge(followup.status)}`}>
          {followup.status}
        </span>
      </div>

      <div className="followup-contact">
        <p>
          <strong>Email:</strong> {followup.contactEmail}
        </p>
        {followup.contactPhone && (
          <p>
            <strong>Phone:</strong> {followup.contactPhone}
          </p>
        )}
      </div>

      <div className="followup-metrics">
        <div className="metric">
          <span className="metric-label">Emails Sent:</span>
          <span className="metric-value">{followup.engagementMetrics?.totalEmailsSent || 0}</span>
        </div>
        <div className="metric">
          <span className="metric-label">WhatsApp Sent:</span>
          <span className="metric-value">{followup.engagementMetrics?.whatsappMessagesSent || 0}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Links Clicked:</span>
          <span className="metric-value">{followup.engagementMetrics?.linksClicked || 0}</span>
        </div>
      </div>

      {followup.engagementMetrics?.converted && (
        <div className="converted-badge">
          <strong>✓ Converted</strong>
        </div>
      )}

      <div className="followup-sequence">
        <h5>Follow-up Sequence</h5>
        <div className="sequence-items">
          {followup.followupSequence?.map((item, idx) => (
            <div key={idx} className={`sequence-item sequence-${item.status}`}>
              <span className="sequence-type">{item.channel}</span>
              <span className="sequence-status">{item.status}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        className="expand-button"
        onClick={() => setSelectedFollowup(selectedFollowup === followup._id ? null : followup._id)}
      >
        {selectedFollowup === followup._id ? "Hide Details" : "Show Details"}
      </button>

      {selectedFollowup === followup._id && (
        <div className="followup-details">
          <h5>Interactions</h5>
          <div className="interactions-list">
            {followup.interactions?.map((interaction, idx) => (
              <div key={idx} className="interaction-item">
                <span className="interaction-type">{interaction.type}</span>
                <span className="interaction-time">
                  {new Date(interaction.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {followup.assignedCampaigns?.length > 0 && (
            <div className="assigned-campaigns">
              <h5>Assigned Campaigns</h5>
              <ul>
                {followup.assignedCampaigns.map((campaign, idx) => (
                  <li key={idx}>{campaign.campaignName}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="registration-followups-container">
      <div className="followups-header">
        <h2>Registration Follow-ups</h2>
        <div className="filter-group">
          <label>Status:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="in_sequence">In Sequence</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
            <option value="converted">Converted</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-state">Loading follow-ups...</div>
      ) : followups.length === 0 ? (
        <div className="empty-state">
          <p>No follow-ups found with status: {filter}</p>
        </div>
      ) : (
        <div className="followups-grid">
          {followups.map((followup) => renderFollowupCard(followup))}
        </div>
      )}
    </div>
  );
};

export default RegistrationFollowups;
