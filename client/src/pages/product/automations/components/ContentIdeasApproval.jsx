import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import {
  fetchContentIdeas,
  approveContentIdea,
  rejectContentIdea,
  scheduleContentIdea,
  selectContentIdeas,
  selectAutomationLoading,
  selectAutomationError,
} from "../../../../redux/features/automation/automationSlice";
import "./contentIdeasApproval.css";

const ContentIdeasApproval = () => {
  const dispatch = useDispatch();
  const ideas = useSelector(selectContentIdeas);
  const isLoading = useSelector(selectAutomationLoading);
  const error = useSelector(selectAutomationError);
  const [statusFilter, setStatusFilter] = useState("pending_approval");
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleData, setScheduleData] = useState({ platforms: "both", scheduledDate: "" });
  const [rejectReason, setRejectReason] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    dispatch(fetchContentIdeas({ status: statusFilter, limit: 20, skip: page * 20 }));
  }, [dispatch, statusFilter, page]);

  const handleApprove = (ideaId) => {
    dispatch(approveContentIdea({ ideaId, notes: "" }));
    toast.success("Content idea approved!");
  };

  const handleReject = (ideaId) => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    dispatch(rejectContentIdea({ ideaId, reason: rejectReason }));
    setRejectReason("");
    toast.success("Content idea rejected");
  };

  const handleSchedule = (ideaId) => {
    if (!scheduleData.scheduledDate) {
      toast.error("Please select a scheduled date");
      return;
    }
    dispatch(
      scheduleContentIdea({
        ideaId,
        platforms: scheduleData.platforms,
        scheduledDate: scheduleData.scheduledDate,
      })
    );
    setShowScheduleModal(false);
    setScheduleData({ platforms: "both", scheduledDate: "" });
    toast.success("Content scheduled successfully!");
  };

  const renderContentCard = (idea) => {
    return (
      <div key={idea._id} className="content-idea-card">
        <div className="idea-header">
          <h3>{idea.title || "Content Idea"}</h3>
          <span className={`idea-status status-${idea.status}`}>{idea.status}</span>
        </div>

        <div className="idea-description">
          <p>{idea.description || idea.suggestedContent?.body || "No description"}</p>
        </div>

        <div className="idea-metadata">
          <div className="metadata-item">
            <span className="metadata-label">Type:</span>
            <span className="metadata-value">{idea.contentType || "Unknown"}</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Platform:</span>
            <span className="metadata-value">{idea.sourcePlatform || "Unknown"}</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Resonance:</span>
            <span className="metadata-value">{idea.resonanceScore || 0}%</span>
          </div>
        </div>

        {idea.suggestedContent && (
          <div className="idea-content">
            <div className="content-section">
              <h4>Headline</h4>
              <p>{idea.suggestedContent.headline}</p>
            </div>

            <div className="content-section">
              <h4>Media Type</h4>
              <p>{idea.suggestedContent.mediaType || "Video"}</p>
            </div>

            {idea.suggestedContent.hashtags?.length > 0 && (
              <div className="content-section">
                <h4>Hashtags</h4>
                <div className="hashtags">
                  {idea.suggestedContent.hashtags.map((tag, idx) => (
                    <span key={idx} className="hashtag">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {idea.variations?.tiktok && (
          <div className="platform-variations">
            <h4>TikTok Script</h4>
            <p className="variation-text">{idea.variations.tiktok.script}</p>
            <div className="variation-details">
              <span>Duration: {idea.variations.tiktok.duration}s</span>
              <span>Audio: {idea.variations.tiktok.audioSuggestion}</span>
            </div>
          </div>
        )}

        <div className="idea-actions">
          {idea.status === "pending_approval" && (
            <>
              <button
                className="action-button button-approve"
                onClick={() => handleApprove(idea._id)}
              >
                Approve
              </button>
              <button
                className="action-button button-reject"
                onClick={() => {
                  setSelectedIdea(idea._id);
                  setRejectReason("");
                }}
              >
                Reject
              </button>
              <button
                className="action-button button-schedule"
                onClick={() => {
                  setSelectedIdea(idea._id);
                  setShowScheduleModal(true);
                }}
              >
                Schedule
              </button>
            </>
          )}

          {idea.status === "approved" && (
            <button
              className="action-button button-schedule"
              onClick={() => {
                setSelectedIdea(idea._id);
                setShowScheduleModal(true);
              }}
            >
              Reschedule
            </button>
          )}

          {idea.status === "published" && (
            <div className="published-info">
              <p className="published-date">
                Published: {new Date(idea.publishingHistory?.[0]?.publishedAt).toLocaleString()}
              </p>
              {idea.publishingHistory?.[0]?.performance && (
                <div className="performance-metrics">
                  <span>Views: {idea.publishingHistory[0].performance.views}</span>
                  <span>Likes: {idea.publishingHistory[0].performance.likes}</span>
                  <span>Comments: {idea.publishingHistory[0].performance.comments}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedIdea === idea._id && idea.status === "pending_approval" && (
          <div className="rejection-form">
            <textarea
              placeholder="Enter reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="rejection-textarea"
            />
            <div className="rejection-actions">
              <button
                className="action-button button-confirm"
                onClick={() => handleReject(idea._id)}
              >
                Confirm Rejection
              </button>
              <button
                className="action-button button-cancel"
                onClick={() => {
                  setSelectedIdea(null);
                  setRejectReason("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="content-ideas-approval-container">
      <div className="approval-header">
        <h2>Content Ideas Approval</h2>
        <div className="filter-group">
          <label>Status:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {isLoading ? (
        <div className="loading-state">Loading content ideas...</div>
      ) : ideas.length === 0 ? (
        <div className="empty-state">
          <p>No content ideas found for the selected status.</p>
        </div>
      ) : (
        <>
          <div className="ideas-grid">
            {ideas.map((idea) => renderContentCard(idea))}
          </div>

          <div className="pagination">
            <button
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="pagination-button"
            >
              Previous
            </button>
            <span className="pagination-info">Page {page + 1}</span>
            <button
              disabled={ideas.length < 20}
              onClick={() => setPage(page + 1)}
              className="pagination-button"
            >
              Next
            </button>
          </div>
        </>
      )}

      {showScheduleModal && selectedIdea && (
        <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Schedule Content</h3>
            <div className="form-group">
              <label>Platform:</label>
              <select
                value={scheduleData.platforms}
                onChange={(e) =>
                  setScheduleData({ ...scheduleData, platforms: e.target.value })
                }
              >
                <option value="tiktok">TikTok</option>
                <option value="instagram">Instagram</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div className="form-group">
              <label>Scheduled Date:</label>
              <input
                type="datetime-local"
                value={scheduleData.scheduledDate}
                onChange={(e) =>
                  setScheduleData({ ...scheduleData, scheduledDate: e.target.value })
                }
              />
            </div>
            <div className="modal-actions">
              <button
                className="action-button button-confirm"
                onClick={() => handleSchedule(selectedIdea)}
              >
                Schedule
              </button>
              <button
                className="action-button button-cancel"
                onClick={() => {
                  setShowScheduleModal(false);
                  setSelectedIdea(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentIdeasApproval;
