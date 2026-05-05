import React, { useState } from "react";
import { useDispatch } from "react-redux";
import {
  approveContentIdea,
  rejectContentIdea,
  scheduleContentIdea,
} from "../../../../redux/features/automation/automationSlice";
import { useAsyncToast } from "../../../../customHook/useAsyncToast";

const ContentIdeasPanel = ({ contentIdeas, isLoading }) => {
  const dispatch = useDispatch();
  const { executeWithToast } = useAsyncToast();
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [filterStatus, setFilterStatus] = useState("pending_approval");
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    platforms: ["tiktok", "instagram"],
    scheduledDate: new Date().toISOString().split("T")[0],
  });

  const filteredIdeas = contentIdeas.filter(
    (idea) => !filterStatus || idea.status === filterStatus
  );

  const handleApproveIdea = (ideaId) => {
    executeWithToast(
      dispatch(approveContentIdea({ ideaId, notes: "Approved by admin" })),
      {
        loading: "Approving content...",
        success: "Content approved",
        error: "Failed to approve content",
      }
    );
  };

  const handleRejectIdea = (ideaId) => {
    const reason = prompt("Enter rejection reason:");
    if (reason) {
      executeWithToast(
        dispatch(rejectContentIdea({ ideaId, reason })),
        {
          loading: "Rejecting content...",
          success: "Content rejected",
          error: "Failed to reject content",
        }
      );
    }
  };

  const handleScheduleIdea = (ideaId) => {
    setSelectedIdea(ideaId);
    setShowScheduleForm(true);
  };

  const submitSchedule = () => {
    if (selectedIdea) {
      executeWithToast(
        dispatch(
          scheduleContentIdea({
            ideaId: selectedIdea,
            platforms: scheduleData.platforms,
            scheduledDate: scheduleData.scheduledDate,
          })
        ),
        {
          loading: "Scheduling content...",
          success: "Content scheduled",
          error: "Failed to schedule content",
        }
      ).then(() => {
        setShowScheduleForm(false);
        setSelectedIdea(null);
        setScheduleData({
          platforms: ["tiktok", "instagram"],
          scheduledDate: new Date().toISOString().split("T")[0],
        });
      });
    }
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      pending_approval: "status-pending",
      approved: "status-approved",
      rejected: "status-rejected",
      scheduled: "status-scheduled",
      published: "status-published",
    };
    return statusClasses[status] || "status-default";
  };

  const getPlatformLabel = (platform) => {
    const labels = {
      tiktok: "TikTok",
      instagram: "Instagram",
      youtube: "YouTube",
      facebook: "Facebook",
    };
    return labels[platform] || platform;
  };

  return (
    <div className="content-ideas-panel">
      <div className="panel-header">
        <h3>Content Ideas Management</h3>
        <p>Review, approve, and schedule AI-generated content ideas</p>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button
          className={`filter-btn ${filterStatus === "pending_approval" ? "active" : ""}`}
          onClick={() => setFilterStatus("pending_approval")}
        >
          Pending ({contentIdeas.filter((i) => i.status === "pending_approval").length})
        </button>
        <button
          className={`filter-btn ${filterStatus === "approved" ? "active" : ""}`}
          onClick={() => setFilterStatus("approved")}
        >
          Approved ({contentIdeas.filter((i) => i.status === "approved").length})
        </button>
        <button
          className={`filter-btn ${filterStatus === "scheduled" ? "active" : ""}`}
          onClick={() => setFilterStatus("scheduled")}
        >
          Scheduled ({contentIdeas.filter((i) => i.status === "scheduled").length})
        </button>
        <button
          className={`filter-btn ${filterStatus === "published" ? "active" : ""}`}
          onClick={() => setFilterStatus("published")}
        >
          Published ({contentIdeas.filter((i) => i.status === "published").length})
        </button>
      </div>

      {/* Content Ideas List */}
      <div className="ideas-list">
        {isLoading && <div className="loading-spinner">Loading ideas...</div>}

        {!isLoading && filteredIdeas.length === 0 && (
          <div className="empty-state">
            <p>No content ideas in this status</p>
          </div>
        )}

        {!isLoading && filteredIdeas.map((idea) => (
          <div key={idea._id} className="idea-card">
            <div className="idea-header">
              <div className="idea-title-section">
                <h4>{idea.title}</h4>
                <span className={`status-badge ${getStatusBadge(idea.status)}`}>
                  {idea.status.replace("_", " ").toUpperCase()}
                </span>
              </div>
              <span className="platforms-badges">
                {idea.platforms?.map((platform) => (
                  <span key={platform} className="platform-badge">
                    {getPlatformLabel(platform)}
                  </span>
                ))}
              </span>
            </div>

            <div className="idea-body">
              {idea.description && (
                <p className="description">{idea.description}</p>
              )}

              <div className="meta-info">
                {idea.generatedAt && (
                  <span className="meta-item">
                    Generated: {new Date(idea.generatedAt).toLocaleDateString()}
                  </span>
                )}
                {idea.estimatedEngagement && (
                  <span className="meta-item">
                    Est. Engagement: {idea.estimatedEngagement}%
                  </span>
                )}
                {idea.hashtags && idea.hashtags.length > 0 && (
                  <span className="meta-item hashtags">
                    {idea.hashtags.slice(0, 3).join(" ")}
                    {idea.hashtags.length > 3 && ` +${idea.hashtags.length - 3}`}
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            {idea.status === "pending_approval" && (
              <div className="idea-actions">
                <button
                  className="btn-success btn-sm"
                  onClick={() => handleApproveIdea(idea._id)}
                >
                  ✓ Approve
                </button>
                <button
                  className="btn-warning btn-sm"
                  onClick={() => handleScheduleIdea(idea._id)}
                >
                  📅 Schedule
                </button>
                <button
                  className="btn-danger btn-sm"
                  onClick={() => handleRejectIdea(idea._id)}
                >
                  ✕ Reject
                </button>
              </div>
            )}

            {idea.status === "approved" && (
              <div className="idea-actions">
                <button
                  className="btn-primary btn-sm"
                  onClick={() => handleScheduleIdea(idea._id)}
                >
                  📅 Schedule for Publishing
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Schedule Modal */}
      {showScheduleForm && (
        <div className="modal-overlay" onClick={() => setShowScheduleForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Schedule Content</h3>
              <button
                className="close-btn"
                onClick={() => setShowScheduleForm(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Select Platforms</label>
                <div className="platforms-selection">
                  {["tiktok", "instagram", "youtube", "facebook"].map(
                    (platform) => (
                      <label key={platform} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={scheduleData.platforms.includes(platform)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setScheduleData({
                                ...scheduleData,
                                platforms: [...scheduleData.platforms, platform],
                              });
                            } else {
                              setScheduleData({
                                ...scheduleData,
                                platforms: scheduleData.platforms.filter(
                                  (p) => p !== platform
                                ),
                              });
                            }
                          }}
                        />
                        <span>{getPlatformLabel(platform)}</span>
                      </label>
                    )
                  )}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="scheduledDate">Scheduled Date & Time</label>
                <input
                  type="datetime-local"
                  id="scheduledDate"
                  value={scheduleData.scheduledDate}
                  onChange={(e) =>
                    setScheduleData({
                      ...scheduleData,
                      scheduledDate: e.target.value,
                    })
                  }
                  className="form-control"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowScheduleForm(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={submitSchedule}
              >
                Schedule Content
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentIdeasPanel;
