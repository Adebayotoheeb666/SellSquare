import React, { useState, useMemo } from "react";
import { useDispatch } from "react-redux";
import { useAsyncToast } from "../../../../customHook/useAsyncToast";

const EngagementMetricsPanel = ({ engagements, isLoading }) => {
  const dispatch = useDispatch();
  const { executeWithToast } = useAsyncToast();
  const [filterPlatform, setFilterPlatform] = useState(null);
  const [sortBy, setSortBy] = useState("date");
  const [selectedEngagement, setSelectedEngagement] = useState(null);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!engagements || engagements.length === 0) {
      return {
        totalEngagements: 0,
        totalLikes: 0,
        totalComments: 0,
        averageEngagementRate: 0,
        platformBreakdown: {},
      };
    }

    const breakdown = {};
    let totalLikes = 0;
    let totalComments = 0;
    let totalEngagementValue = 0;

    engagements.forEach((engagement) => {
      const platform = engagement.platform || "unknown";
      breakdown[platform] = (breakdown[platform] || 0) + 1;

      totalLikes += engagement.likes || 0;
      totalComments += engagement.comments || 0;
      totalEngagementValue += (engagement.engagementValue || 0);
    });

    const avgEngagementRate =
      engagements.length > 0
        ? ((totalLikes + totalComments) / engagements.length).toFixed(1)
        : 0;

    return {
      totalEngagements: engagements.length,
      totalLikes,
      totalComments,
      averageEngagementRate: avgEngagementRate,
      platformBreakdown: breakdown,
    };
  }, [engagements]);

  // Filter and sort engagements
  const processedEngagements = useMemo(() => {
    let filtered = engagements;

    if (filterPlatform) {
      filtered = filtered.filter((e) => e.platform === filterPlatform);
    }

    let sorted = [...filtered];
    switch (sortBy) {
      case "likes":
        sorted.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        break;
      case "comments":
        sorted.sort((a, b) => (b.comments || 0) - (a.comments || 0));
        break;
      case "engagement":
        sorted.sort((a, b) => (b.engagementValue || 0) - (a.engagementValue || 0));
        break;
      case "date":
      default:
        sorted.sort(
          (a, b) =>
            new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );
        break;
    }

    return sorted;
  }, [engagements, filterPlatform, sortBy]);

  const getPlatformIcon = (platform) => {
    const icons = {
      tiktok: "🎵",
      instagram: "📷",
      youtube: "▶️",
      facebook: "f",
      twitter: "𝕏",
    };
    return icons[platform] || "📱";
  };

  const getPlatformLabel = (platform) => {
    const labels = {
      tiktok: "TikTok",
      instagram: "Instagram",
      youtube: "YouTube",
      facebook: "Facebook",
      twitter: "Twitter/X",
    };
    return labels[platform] || platform;
  };

  const getEngagementType = (engagement) => {
    if (engagement.engagementType === "like") return "👍 Like";
    if (engagement.engagementType === "comment") return "💬 Comment";
    if (engagement.engagementType === "share") return "🔄 Share";
    if (engagement.engagementType === "follow") return "👤 Follow";
    if (engagement.engagementType === "view") return "👁️ View";
    return engagement.engagementType || "Engagement";
  };

  return (
    <div className="engagement-metrics-panel">
      <div className="panel-header">
        <h3>Social Media Engagement Metrics</h3>
        <p>Track and analyze social media interactions across platforms</p>
      </div>

      {/* Metrics Summary */}
      <div className="metrics-summary">
        <div className="metric-card">
          <span className="metric-icon">📊</span>
          <div className="metric-content">
            <span className="metric-label">Total Engagements</span>
            <span className="metric-value">{metrics.totalEngagements}</span>
          </div>
        </div>

        <div className="metric-card">
          <span className="metric-icon">👍</span>
          <div className="metric-content">
            <span className="metric-label">Total Likes</span>
            <span className="metric-value">{metrics.totalLikes}</span>
          </div>
        </div>

        <div className="metric-card">
          <span className="metric-icon">💬</span>
          <div className="metric-content">
            <span className="metric-label">Total Comments</span>
            <span className="metric-value">{metrics.totalComments}</span>
          </div>
        </div>

        <div className="metric-card">
          <span className="metric-icon">📈</span>
          <div className="metric-content">
            <span className="metric-label">Avg Engagement</span>
            <span className="metric-value">{metrics.averageEngagementRate}</span>
          </div>
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="platform-breakdown">
        <h4>Engagements by Platform</h4>
        <div className="breakdown-cards">
          {Object.entries(metrics.platformBreakdown).map(([platform, count]) => (
            <div
              key={platform}
              className={`breakdown-card ${filterPlatform === platform ? "active" : ""}`}
              onClick={() =>
                setFilterPlatform(filterPlatform === platform ? null : platform)
              }
            >
              <span className="platform-icon">{getPlatformIcon(platform)}</span>
              <span className="platform-name">{getPlatformLabel(platform)}</span>
              <span className="count">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters & Sort */}
      <div className="controls-bar">
        <div className="control-group">
          <label htmlFor="sortBy">Sort by:</label>
          <select
            id="sortBy"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="form-control"
          >
            <option value="date">Newest First</option>
            <option value="likes">Most Likes</option>
            <option value="comments">Most Comments</option>
            <option value="engagement">Highest Engagement</option>
          </select>
        </div>

        {filterPlatform && (
          <button
            className="btn-secondary btn-sm"
            onClick={() => setFilterPlatform(null)}
          >
            Clear Platform Filter
          </button>
        )}
      </div>

      {/* Engagements List */}
      <div className="engagements-list">
        {isLoading && <div className="loading-spinner">Loading engagements...</div>}

        {!isLoading && processedEngagements.length === 0 && (
          <div className="empty-state">
            <p>No social media engagements recorded yet</p>
          </div>
        )}

        {!isLoading && processedEngagements.map((engagement) => (
          <div
            key={engagement._id}
            className="engagement-item"
            onClick={() =>
              setSelectedEngagement(
                selectedEngagement?._id === engagement._id ? null : engagement
              )
            }
          >
            <div className="engagement-header">
              <div className="engagement-info">
                <span className="platform-badge">
                  {getPlatformIcon(engagement.platform)} {getPlatformLabel(engagement.platform)}
                </span>
                <span className="type-badge">{getEngagementType(engagement)}</span>
              </div>
              <div className="engagement-metrics">
                <span className="metric">
                  👍 {engagement.likes || 0}
                </span>
                <span className="metric">
                  💬 {engagement.comments || 0}
                </span>
              </div>
            </div>

            {selectedEngagement?._id === engagement._id && (
              <div className="engagement-details">
                {engagement.postUrl && (
                  <p>
                    <strong>Post URL:</strong>{" "}
                    <a href={engagement.postUrl} target="_blank" rel="noopener noreferrer">
                      View Post
                    </a>
                  </p>
                )}
                {engagement.content && (
                  <p>
                    <strong>Content:</strong> {engagement.content}
                  </p>
                )}
                {engagement.createdAt && (
                  <p>
                    <strong>Date:</strong> {new Date(engagement.createdAt).toLocaleString()}
                  </p>
                )}
                {engagement.sentimentScore !== undefined && (
                  <p>
                    <strong>Sentiment:</strong> {(engagement.sentimentScore * 100).toFixed(0)}%
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* No Data State */}
      {!isLoading && engagements.length === 0 && (
        <div className="no-data-message">
          <p>No engagement data available. Connect social media platforms and enable automation to start tracking engagements.</p>
        </div>
      )}
    </div>
  );
};

export default EngagementMetricsPanel;
