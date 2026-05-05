import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import {
  fetchCampaigns,
  createCampaign,
  selectCampaigns,
  selectAutomationLoading,
} from "../../../../redux/features/automation/automationSlice";
import "./followupCampaigns.css";

const FollowupCampaigns = () => {
  const dispatch = useDispatch();
  const campaigns = useSelector(selectCampaigns);
  const isLoading = useSelector(selectAutomationLoading);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "registration_welcome",
    channels: ["email"],
  });

  useEffect(() => {
    dispatch(fetchCampaigns());
  }, [dispatch]);

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Campaign name is required");
      return;
    }

    try {
      await dispatch(createCampaign(formData)).unwrap();
      toast.success("Campaign created successfully");
      setShowCreateModal(false);
      setFormData({
        name: "",
        description: "",
        type: "registration_welcome",
        channels: ["email"],
      });
    } catch (error) {
      toast.error(error || "Failed to create campaign");
    }
  };

  const toggleChannel = (channel) => {
    setFormData((prev) => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter((c) => c !== channel)
        : [...prev.channels, channel],
    }));
  };

  const getStatusClass = (status) => {
    const classes = {
      active: "status-active",
      paused: "status-paused",
      draft: "status-draft",
      completed: "status-completed",
      archived: "status-archived",
    };
    return classes[status] || "";
  };

  return (
    <div className="followup-campaigns-container">
      <div className="campaigns-header">
        <h2>Follow-up Campaigns</h2>
        <button
          className="create-campaign-button"
          onClick={() => setShowCreateModal(true)}
        >
          Create Campaign
        </button>
      </div>

      {isLoading ? (
        <div className="loading-state">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className="empty-state">
          <p>No campaigns found. Create your first follow-up campaign to get started.</p>
        </div>
      ) : (
        <div className="campaigns-list">
          {campaigns.map((campaign) => (
            <div key={campaign._id} className="campaign-card">
              <div className="campaign-card-header">
                <div className="campaign-title-area">
                  <h3>{campaign.name}</h3>
                  <span className={`campaign-status-badge ${getStatusClass(campaign.status)}`}>
                    {campaign.status}
                  </span>
                </div>
                <div className="campaign-channels">
                  {campaign.channels?.map((channel) => (
                    <span key={channel} className={`channel-pill ${channel}`}>
                      {channel}
                    </span>
                  ))}
                </div>
              </div>
              <p className="campaign-desc">{campaign.description}</p>

              <div className="campaign-metrics-summary">
                <div className="summary-item">
                  <span className="label">Recipients:</span>
                  <span className="value">{campaign.metrics?.totalRecipientsAdded || 0}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Sent:</span>
                  <span className="value">{campaign.metrics?.totalMessagesSent || 0}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Open Rate:</span>
                  <span className="value">{campaign.performance?.emailOpenRate || 0}%</span>
                </div>
                <div className="summary-item">
                  <span className="label">Conv. Rate:</span>
                  <span className="value">{campaign.performance?.conversionRate || 0}%</span>
                </div>
              </div>

              <div className="campaign-actions">
                <button className="campaign-link-button">View Details</button>
                {campaign.status === "paused" && (
                  <button className="campaign-link-button success">Resume</button>
                )}
                {campaign.status === "active" && (
                  <button className="campaign-link-button warning">Pause</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Campaign</h3>
            <form onSubmit={handleCreateCampaign}>
              <div className="form-group">
                <label>Campaign Name*</label>
                <input
                  type="text"
                  placeholder="e.g. Welcome Sequence"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  placeholder="What is this campaign for?"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Campaign Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="registration_welcome">Registration Welcome</option>
                  <option value="onboarding">Onboarding</option>
                  <option value="re_engagement">Re-engagement</option>
                  <option value="promotional">Promotional</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="form-group">
                <label>Channels</label>
                <div className="channel-selectors">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.channels.includes("email")}
                      onChange={() => toggleChannel("email")}
                    />
                    Email
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.channels.includes("whatsapp")}
                      onChange={() => toggleChannel("whatsapp")}
                    />
                    WhatsApp
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="action-button button-confirm">
                  Create Campaign
                </button>
                <button
                  type="button"
                  className="action-button button-cancel"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FollowupCampaigns;
