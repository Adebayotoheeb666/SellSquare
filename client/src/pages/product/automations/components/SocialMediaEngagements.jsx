import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import {
  fetchSocialMediaEngagements,
  selectSocialMediaEngagements,
  selectAutomationLoading,
} from "../../../../redux/features/automation/automationSlice";
import "./socialMediaEngagements.css";

const SocialMediaEngagements = () => {
  const dispatch = useDispatch();
  const engagements = useSelector(selectSocialMediaEngagements);
  const isLoading = useSelector(selectAutomationLoading);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const platform = platformFilter === "all" ? null : platformFilter;
    dispatch(fetchSocialMediaEngagements({ platform, limit: 20, skip: page * 20 }));
  }, [dispatch, platformFilter, page]);

  const getEngagementStatus = (engagement) => {
    if (engagement.status === "insights_generated") {
      return <span className="badge badge-insights">Insights Generated</span>;
    }
    if (engagement.status === "content_idea_created") {
      return <span className="badge badge-idea">Idea Created</span>;
    }
    return <span className="badge badge-pending">Pending</span>;
  };

  const getEngagementActions = (engagement) => {
    const actions = engagement.engagementActions || [];
    const likes = actions.filter((a) => a.type === "like");
    const comments = actions.filter((a) => a.type === "comment");

    return {
      likes: likes.length,
      comments: comments.length,
    };
  };

  const renderEngagementCard = (engagement) => {
    const actions = getEngagementActions(engagement);
    const post = engagement.originalPost || {};

    return (
      <div key={engagement._id} className="engagement-card">
        <div className="engagement-header">
          <div className="engagement-info">
            <h4>{post.content?.substring(0, 50) || "Post"}...</h4>
            <p className="engagement-platform">
              <strong>Platform:</strong>{" "}
              <span className={`platform-badge platform-${engagement.platform}`}>
                {engagement.platform.toUpperCase()}
              </span>
            </p>
          </div>
          <div className="engagement-status">{getEngagementStatus(engagement)}</div>
        </div>

        <div className="engagement-details">
          <div className="detail-item">
            <span className="detail-label">Author:</span>
            <span className="detail-value">@{post.authorHandle || "Unknown"}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Likes:</span>
            <span className="detail-value">{post.likes || 0}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Comments:</span>
            <span className="detail-value">{post.comments || 0}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Views:</span>
            <span className="detail-value">{post.views || 0}</span>
          </div>
        </div>

        <div className="engagement-actions">
          <div className="action-item">
            <span className="action-label">Our Likes:</span>
            <span className="action-value">{actions.likes}</span>
          </div>
          <div className="action-item">
            <span className="action-label">Our Comments:</span>
            <span className="action-value">{actions.comments}</span>
          </div>
        </div>

        {engagement.insights && (
          <div className="engagement-insights">
            <p className="insights-title">Insights:</p>
            <div className="insights-tags">
              {engagement.insights.keyThemes?.map((theme, idx) => (
                <span key={idx} className="theme-tag">
                  {theme}
                </span>
              ))}
            </div>
            <p className="relevance-score">
              Relevance: <strong>{engagement.insights.relevanceScore || 0}%</strong>
            </p>
          </div>
        )}

        <div className="engagement-timestamp">
          {new Date(engagement.processedAt).toLocaleString()}
        </div>
      </div>
    );
  };

  return (
    <div className="social-media-engagements-container">
      <div className="engagement-header-section">
        <h2>Social Media Engagements</h2>
        <div className="filter-group">
          <label>Filter by Platform:</label>
          <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
            <option value="all">All Platforms</option>
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-state">Loading engagements...</div>
      ) : engagements.length === 0 ? (
        <div className="empty-state">
          <p>No social media engagements yet. Start your automation to see activity here.</p>
        </div>
      ) : (
        <>
          <div className="engagements-grid">
            {engagements.map((engagement) => renderEngagementCard(engagement))}
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
              disabled={engagements.length < 20}
              onClick={() => setPage(page + 1)}
              className="pagination-button"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default SocialMediaEngagements;
