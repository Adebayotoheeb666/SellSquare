import React, { useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "../../../../config/apiConfig";
import { useAsyncToast } from "../../../../customHook/useAsyncToast";

const JobStatusPanel = ({ jobStatus, isLoading, integrationSettings, onUpdateSchedule }) => {
  const { executeWithToast } = useAsyncToast();
  const [expandedJob, setExpandedJob] = useState(null);

  const jobs = [
    {
      id: "tiktok-automation",
      name: "TikTok Automation Job",
      description: "Monitor and engage with TikTok posts",
      frequency: jobStatus?.tiktok?.frequency || "every 30 minutes",
      lastRun: jobStatus?.tiktok?.lastRun,
      nextRun: jobStatus?.tiktok?.nextRun,
      status: jobStatus?.tiktok?.status || "pending",
      tasksProcessed: jobStatus?.tiktok?.tasksProcessed || 0,
      errorsCount: jobStatus?.tiktok?.errorsCount || 0,
    },
    {
      id: "instagram-automation",
      name: "Instagram Automation Job",
      description: "Monitor and engage with Instagram posts",
      frequency: jobStatus?.instagram?.frequency || "every 30 minutes",
      lastRun: jobStatus?.instagram?.lastRun,
      nextRun: jobStatus?.instagram?.nextRun,
      status: jobStatus?.instagram?.status || "pending",
      tasksProcessed: jobStatus?.instagram?.tasksProcessed || 0,
      errorsCount: jobStatus?.instagram?.errorsCount || 0,
    },
    {
      id: "followup-processing",
      name: "Registration Follow-up Job",
      description: "Process and send follow-up messages to new registrations",
      frequency: jobStatus?.followup?.frequency || "every hour",
      lastRun: jobStatus?.followup?.lastRun,
      nextRun: jobStatus?.followup?.nextRun,
      status: jobStatus?.followup?.status || "pending",
      tasksProcessed: jobStatus?.followup?.tasksProcessed || 0,
      errorsCount: jobStatus?.followup?.errorsCount || 0,
    },
    {
      id: "content-publishing",
      name: "Content Publishing Job",
      description: "Publish scheduled content to configured platforms",
      frequency: jobStatus?.publishing?.frequency || "every 15 minutes",
      lastRun: jobStatus?.publishing?.lastRun,
      nextRun: jobStatus?.publishing?.nextRun,
      status: jobStatus?.publishing?.status || "pending",
      tasksProcessed: jobStatus?.publishing?.tasksProcessed || 0,
      errorsCount: jobStatus?.publishing?.errorsCount || 0,
    },
  ];

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "running":
        return "status-badge status-running";
      case "completed":
        return "status-badge status-completed";
      case "pending":
        return "status-badge status-pending";
      case "error":
        return "status-badge status-error";
      case "paused":
        return "status-badge status-paused";
      default:
        return "status-badge";
    }
  };

  const handleTriggerJob = (jobId) => {
    const jobKey = jobId.replace("-automation", "").replace("-processing", "").replace("content-", "");
    executeWithToast(
      axios.post(`${BACKEND_URL}/api/automation/trigger/${jobId}`),
      {
        loading: `Triggering ${jobKey} job...`,
        success: `${jobKey.charAt(0).toUpperCase() + jobKey.slice(1)} triggered`,
        error: `Failed to trigger ${jobKey}`,
      }
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Never";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  // Helper to extract minutes from cron string */X * * * *
  const cronToMinutes = (cronStr) => {
    if (!cronStr) return "";
    const match = cronStr.match(/\*\/(\d+)/);
    return match ? match[1] : "";
  };

  return (
    <div className="job-status-panel">
      <div className="panel-header">
        <h3>Automation Jobs & Scheduler</h3>
        <p>Monitor and manage automation job execution</p>
      </div>

      {/* Scheduler Status Summary */}
      <div className="scheduler-summary">
        <div className="summary-card">
          <span className="label">Scheduler Status:</span>
          <span className={`value ${jobStatus?.schedulerStatus === "running" ? "active" : "inactive"}`}>
            {jobStatus?.schedulerStatus === "running" ? "🟢 Running" : "🔴 Stopped"}
          </span>
        </div>
        <div className="summary-card">
          <span className="label">Total Jobs:</span>
          <span className="value">{jobs.length}</span>
        </div>
        <div className="summary-card">
          <span className="label">Last Check:</span>
          <span className="value">{formatDate(jobStatus?.lastCheck)}</span>
        </div>
      </div>

      {/* Jobs List */}
      <div className="jobs-list">
        {isLoading && <div className="loading-spinner">Loading job status...</div>}

        {!isLoading && jobs.map((job) => {
          // Get current schedule from integration settings
          let currentSchedule = "";
          let scheduleKey = "";

          if (job.id === "tiktok-automation") {
            currentSchedule = integrationSettings?.tiktok?.automationSettings?.jobSchedule;
            scheduleKey = "tiktokSchedule";
          } else if (job.id === "instagram-automation") {
            currentSchedule = integrationSettings?.instagram?.automationSettings?.jobSchedule;
            scheduleKey = "instagramSchedule";
          } else if (job.id === "followup-processing") {
            currentSchedule = integrationSettings?.whatsapp?.automationSettings?.jobSchedule;
            scheduleKey = "followupSchedule";
          } else if (job.id === "content-publishing") {
            currentSchedule = integrationSettings?.contentPublishingSchedule;
            scheduleKey = "publishingSchedule";
          }

          const currentMinutes = cronToMinutes(currentSchedule);

          return (
            <div key={job.id} className="job-card">
              <div className="job-header">
                <div className="job-info">
                  <h4>{job.name}</h4>
                  <p className="description">{job.description}</p>
                </div>
                <div className="job-status">
                  <span className={getStatusBadgeClass(job.status)}>
                    {job.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="job-stats">
                <div className="stat-item">
                  <span className="stat-label">Frequency:</span>
                  <span className="stat-value">{currentMinutes ? `Every ${currentMinutes} mins` : job.frequency}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Tasks Processed:</span>
                  <span className="stat-value">{job.tasksProcessed}</span>
                </div>
                {job.errorsCount > 0 && (
                  <div className="stat-item error">
                    <span className="stat-label">Errors:</span>
                    <span className="stat-value">{job.errorsCount}</span>
                  </div>
                )}
              </div>

              {/* Expandable Details */}
              <div className="job-action-row">
                <button
                  className="expand-btn"
                  onClick={() =>
                    setExpandedJob(expandedJob === job.id ? null : job.id)
                  }
                >
                  {expandedJob === job.id ? "▼" : "▶"} Details & Settings
                </button>
                <button
                  className="btn-primary btn-xs"
                  onClick={() => handleTriggerJob(job.id)}
                >
                  ▶ Run Now
                </button>
              </div>

              {expandedJob === job.id && (
                <div className="job-details">
                  <div className="detail-section-nested">
                    <h5>Run History</h5>
                    <div className="detail-row">
                      <span className="label">Last Run:</span>
                      <span className="value">{formatDate(job.lastRun)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Next Scheduled:</span>
                      <span className="value">{formatDate(job.nextRun)}</span>
                    </div>
                  </div>

                  <div className="detail-section-nested schedule-config">
                    <h5>Schedule Settings</h5>
                    <div className="schedule-input-wrapper">
                      <label>Run every (minutes):</label>
                      <div className="input-with-button">
                        <input
                          type="number"
                          min="1"
                          max="1440"
                          defaultValue={currentMinutes || "30"}
                          onBlur={(e) => {
                            const mins = e.target.value;
                            if (mins && mins !== currentMinutes) {
                              const newCron = `*/${mins} * * * *`;
                              onUpdateSchedule({ [scheduleKey]: newCron });
                            }
                          }}
                        />
                        <span className="unit">mins</span>
                      </div>
                      <small>Changes apply immediately to the scheduler.</small>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scheduler Controls */}
      <div className="scheduler-controls">
        <h4>Scheduler Controls</h4>
        <div className="control-buttons">
          <button
            className="btn-primary"
            disabled={jobStatus?.schedulerStatus === "running"}
            onClick={() =>
              executeWithToast(
                axios.post(`${BACKEND_URL}/api/automation/scheduler/start`),
                {
                  loading: "Starting scheduler...",
                  success: "Scheduler started",
                  error: "Failed to start scheduler",
                }
              )
            }
          >
            {jobStatus?.schedulerStatus === "running" ? "Scheduler Running" : "Start Scheduler"}
          </button>
          <button
            className="btn-warning"
            onClick={() =>
              executeWithToast(
                axios.post(`${BACKEND_URL}/api/automation/scheduler/pause`),
                {
                  loading: "Pausing scheduler...",
                  success: "Scheduler paused",
                  error: "Failed to pause scheduler",
                }
              )
            }
          >
            Pause Scheduler
          </button>
          <button
            className="btn-secondary"
            disabled={jobStatus?.schedulerStatus === "stopped" || !jobStatus?.schedulerStatus}
            onClick={() =>
              executeWithToast(
                axios.post(`${BACKEND_URL}/api/automation/scheduler/stop`),
                {
                  loading: "Stopping scheduler...",
                  success: "Scheduler stopped",
                  error: "Failed to stop scheduler",
                }
              )
            }
          >
            Stop Scheduler
          </button>
        </div>
      </div>
    </div>
  );
};

export default JobStatusPanel;
