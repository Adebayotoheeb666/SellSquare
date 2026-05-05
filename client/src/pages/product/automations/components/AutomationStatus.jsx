import React from "react";
import "./automationStatus.css";

const AutomationStatus = ({ status, jobStatus }) => {
  const getStatusBadge = (integrationStatus) => {
    if (integrationStatus === "connected") {
      return <span className="status-badge status-connected">Connected</span>;
    }
    if (integrationStatus === "error") {
      return <span className="status-badge status-error">Error</span>;
    }
    return <span className="status-badge status-disconnected">Disconnected</span>;
  };

  const getAutomationBadge = (isEnabled) => {
    return isEnabled ? (
      <span className="automation-badge automation-enabled">Enabled</span>
    ) : (
      <span className="automation-badge automation-disabled">Disabled</span>
    );
  };

  const formatDate = (date) => {
    if (!date) return "Never";
    return new Date(date).toLocaleString();
  };

  return (
    <div className="automation-status-container">
      <section className="status-section">
        <h2>Integration Status</h2>

        <div className="status-grid">
          <div className="status-card">
            <div className="status-header">
              <h3>TikTok</h3>
              {getStatusBadge(status?.integrations?.tiktok)}
            </div>
            <div className="status-details">
              <p>
                <strong>Automation:</strong> {getAutomationBadge(status?.automationsEnabled?.tiktok)}
              </p>
              <p>
                <strong>Last Synced:</strong> {formatDate(status?.lastSyncedAt?.tiktok)}
              </p>
            </div>
          </div>

          <div className="status-card">
            <div className="status-header">
              <h3>Instagram</h3>
              {getStatusBadge(status?.integrations?.instagram)}
            </div>
            <div className="status-details">
              <p>
                <strong>Automation:</strong> {getAutomationBadge(status?.automationsEnabled?.instagram)}
              </p>
              <p>
                <strong>Last Synced:</strong> {formatDate(status?.lastSyncedAt?.instagram)}
              </p>
            </div>
          </div>

          <div className="status-card">
            <div className="status-header">
              <h3>WhatsApp</h3>
              {getStatusBadge(status?.integrations?.whatsapp)}
            </div>
            <div className="status-details">
              <p>
                <strong>Automation:</strong> {getAutomationBadge(status?.automationsEnabled?.whatsapp)}
              </p>
            </div>
          </div>

          <div className="status-card">
            <div className="status-header">
              <h3>Email</h3>
              {getStatusBadge(status?.integrations?.email)}
            </div>
            <div className="status-details">
              <p>
                <strong>Automation:</strong> {getAutomationBadge(status?.automationsEnabled?.email)}
              </p>
            </div>
          </div>

          <div className="status-card">
            <div className="status-header">
              <h3>11Labs</h3>
              {getStatusBadge(status?.integrations?.elevenlabs)}
            </div>
            <div className="status-details">
              <p>
                <strong>AI Audio Generation:</strong> {getAutomationBadge(status?.integrations?.elevenlabs === "connected")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="status-section">
        <h2>Job Scheduler Status</h2>

        {jobStatus?.isRunning ? (
          <div className="scheduler-status scheduler-running">
            <span className="status-indicator"></span>
            <strong>Scheduler is Running</strong>
          </div>
        ) : (
          <div className="scheduler-status scheduler-stopped">
            <span className="status-indicator"></span>
            <strong>Scheduler is Stopped</strong>
          </div>
        )}

        <div className="jobs-grid">
          {jobStatus?.jobs && Object.entries(jobStatus.jobs).map(([jobName, jobData]) => (
            <div key={jobName} className="job-card">
              <h4>{jobName.replace(/_/g, " ")}</h4>
              <p>
                <strong>Schedule:</strong> <code>{jobData.schedule}</code>
              </p>
              <p>
                <strong>Status:</strong> {jobData.running ? "Running" : "Scheduled"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AutomationStatus;
