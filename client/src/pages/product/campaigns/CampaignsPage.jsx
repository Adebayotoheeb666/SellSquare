import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAsyncToast } from "../../../customHook/useAsyncToast";
import CampaignManager from "./CampaignManager";
import "./campaigns.css";

const CampaignsPage = () => {
  const navigate = useNavigate();
  const { showToast } = useAsyncToast();
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");

  // Fetch campaigns and templates
  useEffect(() => {
    fetchCampaigns();
    fetchTemplates();
  }, []);

  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      const url = filterStatus ? `/api/campaigns?status=${filterStatus}` : "/api/campaigns";
      const response = await fetch(url);

      if (!response.ok) throw new Error("Failed to fetch campaigns");

      const data = await response.json();
      setCampaigns(data.data || []);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/templates");

      if (!response.ok) throw new Error("Failed to fetch templates");

      const data = await response.json();
      setTemplates(data.data || []);
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  const handleSaveCampaign = async (campaignData) => {
    setIsLoading(true);
    try {
      const url = selectedCampaign
        ? `/api/campaigns/${selectedCampaign._id}`
        : "/api/campaigns";
      const method = selectedCampaign ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaignData),
      });

      if (!response.ok) throw new Error("Failed to save campaign");

      showToast(
        selectedCampaign ? "Campaign updated successfully" : "Campaign created successfully",
        "success"
      );

      setShowManager(false);
      setSelectedCampaign(null);
      fetchCampaigns();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCampaign = async (campaignId) => {
    if (!window.confirm("Are you sure you want to delete this campaign?")) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete campaign");

      showToast("Campaign deleted successfully", "success");
      fetchCampaigns();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteCampaign = async (campaignId) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/execute`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to execute campaign");

      showToast("Campaign execution started", "success");
      fetchCampaigns();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (campaignId, newStatus) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("Failed to update campaign status");

      showToast("Campaign status updated", "success");
      fetchCampaigns();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: "#fff3e0",
      active: "#e8f5e9",
      paused: "#f3e5f5",
      completed: "#e3f2fd",
      failed: "#ffebee",
    };
    return colors[status] || "#f0f0f0";
  };

  const getStatusTextColor = (status) => {
    const colors = {
      draft: "#e65100",
      active: "#295f2d",
      paused: "#6a1b9a",
      completed: "#0277bd",
      failed: "#d32f2f",
    };
    return colors[status] || "#666";
  };

  const filteredCampaigns = filterStatus
    ? campaigns.filter((c) => c.status === filterStatus)
    : campaigns;

  if (showManager) {
    return (
      <div className="campaigns-container">
        <div style={{ marginBottom: "20px" }}>
          <button
            className="btn-secondary"
            onClick={() => {
              setShowManager(false);
              setSelectedCampaign(null);
            }}
            style={{ marginBottom: "20px" }}
          >
            ← Back to Campaigns
          </button>
        </div>
        <CampaignManager
          onSave={handleSaveCampaign}
          initialCampaign={selectedCampaign}
          templates={templates}
          isLoading={isLoading}
        />
      </div>
    );
  }

  return (
    <div className="campaigns-container">
      <div className="campaigns-header">
        <h1>Automation Campaigns</h1>
        <button
          className="btn-primary"
          onClick={() => {
            setSelectedCampaign(null);
            setShowManager(true);
          }}
        >
          + Create Campaign
        </button>
      </div>

      <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
        <button
          className={`btn-small ${!filterStatus ? "active" : ""}`}
          onClick={() => {
            setFilterStatus("");
            fetchCampaigns();
          }}
        >
          All Campaigns
        </button>
        <button
          className={`btn-small ${filterStatus === "draft" ? "active" : ""}`}
          onClick={() => setFilterStatus("draft")}
        >
          Draft
        </button>
        <button
          className={`btn-small ${filterStatus === "active" ? "active" : ""}`}
          onClick={() => setFilterStatus("active")}
        >
          Active
        </button>
        <button
          className={`btn-small ${filterStatus === "paused" ? "active" : ""}`}
          onClick={() => setFilterStatus("paused")}
        >
          Paused
        </button>
      </div>

      {isLoading && <p style={{ textAlign: "center" }}>Loading...</p>}

      {!isLoading && filteredCampaigns.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            background: "#f9f9f9",
            borderRadius: "8px",
          }}
        >
          <p style={{ color: "#666", marginBottom: "20px" }}>No campaigns yet</p>
          <button
            className="btn-primary"
            onClick={() => {
              setSelectedCampaign(null);
              setShowManager(true);
            }}
          >
            Create Your First Campaign
          </button>
        </div>
      ) : (
        <div className="campaigns-list">
          {filteredCampaigns.map((campaign) => (
            <div key={campaign._id} className="campaign-card">
              <div className="campaign-card-info">
                <h3>{campaign.name}</h3>
                {campaign.description && <p>{campaign.description}</p>}
                <p style={{ fontSize: "12px", color: "#999" }}>
                  Type: {campaign.type.toUpperCase()} • Channels: {campaign.channels.length}
                </p>
              </div>

              <div style={{ textAlign: "center" }}>
                <div
                  className="campaign-status"
                  style={{
                    background: getStatusColor(campaign.status),
                    color: getStatusTextColor(campaign.status),
                  }}
                >
                  {campaign.status.toUpperCase()}
                </div>
                {campaign.stats && (
                  <div style={{ marginTop: "10px", fontSize: "12px", color: "#666" }}>
                    <p style={{ margin: "4px 0" }}>Sent: {campaign.stats.totalSent}</p>
                    <p style={{ margin: "4px 0" }}>Failed: {campaign.stats.totalFailed}</p>
                  </div>
                )}
              </div>

              <div className="campaign-card-actions">
                <select
                  value={campaign.status}
                  onChange={(e) => handleStatusChange(campaign._id, e.target.value)}
                  disabled={isLoading}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "4px",
                    border: "1px solid #ddd",
                    fontSize: "12px",
                  }}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>

                {campaign.type === "manual" && campaign.status === "active" && (
                  <button
                    className="btn-small"
                    onClick={() => handleExecuteCampaign(campaign._id)}
                  >
                    Execute
                  </button>
                )}

                <button
                  className="btn-small"
                  onClick={() => {
                    setSelectedCampaign(campaign);
                    setShowManager(true);
                  }}
                >
                  Edit
                </button>

                <button
                  className="btn-small"
                  onClick={() => navigate(`/campaigns/${campaign._id}/analytics`)}
                >
                  Analytics
                </button>

                <button
                  className="btn-small"
                  style={{ background: "#ffebee", color: "#d32f2f" }}
                  onClick={() => handleDeleteCampaign(campaign._id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CampaignsPage;
