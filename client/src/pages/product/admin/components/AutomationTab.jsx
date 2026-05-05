import React, { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchAutomationStatus,
  fetchJobStatus,
  fetchContentIdeas,
  fetchSocialMediaEngagements,
  selectAutomationStatus,
  selectJobStatus,
  selectContentIdeas,
  selectSocialMediaEngagements,
  selectAutomationLoading,
  selectAutomationError,
  selectLastChecked,
  clearAutomationError,
} from "../../../../redux/features/automation/automationSlice";
import {
  fetchIntegrationSettings,
  selectIntegrationSettings,
  selectIntegrationConnecting,
  updateGlobalSchedules,
} from "../../../../redux/features/integration/integrationSlice";
import { useAsyncToast } from "../../../../customHook/useAsyncToast";
import PlatformAutomationCard from "./PlatformAutomationCard";
import ContentIdeasPanel from "./ContentIdeasPanel";
import JobStatusPanel from "./JobStatusPanel";
import EngagementMetricsPanel from "./EngagementMetricsPanel";
import "../admin.css";

const AutomationTab = () => {
  const dispatch = useDispatch();
  const { executeWithToast } = useAsyncToast();

  // Redux selectors
  const automationStatus = useSelector(selectAutomationStatus);
  const jobStatus = useSelector(selectJobStatus);
  const contentIdeas = useSelector(selectContentIdeas);
  const socialMediaEngagements = useSelector(selectSocialMediaEngagements);
  const isLoading = useSelector(selectAutomationLoading);
  const error = useSelector(selectAutomationError);
  const lastChecked = useSelector(selectLastChecked);
  const integrationSettings = useSelector(selectIntegrationSettings);
  const isConnecting = useSelector(selectIntegrationConnecting);

  // Local state
  const [activePanel, setActivePanel] = useState("overview");

  // Load automation data on tab activation
  useEffect(() => {
    dispatch(fetchAutomationStatus());
    dispatch(fetchJobStatus());
    dispatch(fetchContentIdeas({ status: "pending_approval" }));
    dispatch(fetchSocialMediaEngagements());
    dispatch(fetchIntegrationSettings());
  }, [dispatch]);

  // Auto-refresh every 30 seconds when tab is active
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch(fetchAutomationStatus());
      dispatch(fetchJobStatus());
    }, 30000);

    return () => clearInterval(interval);
  }, [dispatch]);

  // Handle error dismissal
  const handleDismissError = useCallback(() => {
    dispatch(clearAutomationError());
  }, [dispatch]);

  // Manual refresh
  const handleRefresh = useCallback(() => {
    executeWithToast(
      Promise.all([
        dispatch(fetchAutomationStatus()),
        dispatch(fetchJobStatus()),
        dispatch(fetchContentIdeas({ status: "pending_approval" })),
        dispatch(fetchSocialMediaEngagements()),
      ]),
      { loading: "Refreshing automation data...", success: "Data refreshed" }
    );
  }, [dispatch, executeWithToast]);

  const getConnectedPlatforms = () => {
    if (!integrationSettings) return [];
    return Object.keys(integrationSettings).filter(
      (platform) => integrationSettings[platform]?.enabled
    );
  };

  return (
    <div className="automation-tab-container">
      {/* Header */}
      <div className="automation-tab-header">
        <div className="header-content">
          <h2>Integration Management</h2>
          <p>Manage social media automation, registration follow-ups, and content publishing for all businesses.</p>
        </div>
        <div className="header-actions">
          <button
            className="refresh-btn"
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh automation data"
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
          {lastChecked && (
            <span className="last-checked">
              Last updated: {new Date(lastChecked).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="error-alert automation-error">
          <span>{error}</span>
          <button className="close-btn" onClick={handleDismissError}>✕</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="automation-tabs-nav">
        <button
          className={`tab-button ${activePanel === "overview" ? "active" : ""}`}
          onClick={() => setActivePanel("overview")}
        >
          Overview
        </button>
        <button
          className={`tab-button ${activePanel === "content" ? "active" : ""}`}
          onClick={() => setActivePanel("content")}
        >
          Content Ideas
        </button>
        <button
          className={`tab-button ${activePanel === "engagement" ? "active" : ""}`}
          onClick={() => setActivePanel("engagement")}
        >
          Engagement
        </button>
        <button
          className={`tab-button ${activePanel === "jobs" ? "active" : ""}`}
          onClick={() => setActivePanel("jobs")}
        >
          Jobs & Scheduler
        </button>
      </div>

      {/* Tab Content */}
      <div className="automation-tabs-content">
        {/* Overview Tab */}
        {activePanel === "overview" && (
          <div className="tab-content-overview">
            <section className="automation-section">
              <div className="section-header">
                <h3>Platform Integrations & Automation Status</h3>
                <p>Live status of all connected platforms and their automation settings</p>
              </div>

              <div className="platforms-grid">
                {/* TikTok */}
                <PlatformAutomationCard
                  platform="tiktok"
                  title="TikTok Automation"
                  isConnected={getConnectedPlatforms().includes("tiktok")}
                  status={automationStatus?.integrations?.tiktok || "disconnected"}
                  automationEnabled={automationStatus?.automationsEnabled?.tiktok || false}
                  lastSynced={automationStatus?.lastSyncedAt?.tiktok}
                  isConnecting={isConnecting}
                  settings={integrationSettings?.tiktok}
                />

                {/* Instagram */}
                <PlatformAutomationCard
                  platform="instagram"
                  title="Instagram Automation"
                  isConnected={getConnectedPlatforms().includes("instagram")}
                  status={automationStatus?.integrations?.instagram || "disconnected"}
                  automationEnabled={automationStatus?.automationsEnabled?.instagram || false}
                  lastSynced={automationStatus?.lastSyncedAt?.instagram}
                  isConnecting={isConnecting}
                  settings={integrationSettings?.instagram}
                />

                {/* WhatsApp */}
                <PlatformAutomationCard
                  platform="whatsapp"
                  title="WhatsApp Follow-ups"
                  isConnected={getConnectedPlatforms().includes("whatsapp")}
                  status={automationStatus?.integrations?.whatsapp || "disconnected"}
                  automationEnabled={automationStatus?.automationsEnabled?.whatsapp || false}
                  isConnecting={isConnecting}
                  settings={integrationSettings?.whatsapp}
                />

                {/* Email */}
                <PlatformAutomationCard
                  platform="email"
                  title="Email Follow-ups"
                  isConnected={getConnectedPlatforms().includes("email")}
                  status={automationStatus?.integrations?.email || "disconnected"}
                  automationEnabled={automationStatus?.automationsEnabled?.email || false}
                  isConnecting={isConnecting}
                  settings={integrationSettings?.email}
                />

                {/* ElevenLabs */}
                <PlatformAutomationCard
                  platform="elevenlabs"
                  title="ElevenLabs (Voice)"
                  isConnected={getConnectedPlatforms().includes("elevenlabs")}
                  status={automationStatus?.integrations?.elevenlabs || "disconnected"}
                  isConnecting={isConnecting}
                  settings={integrationSettings?.elevenlabs}
                />
              </div>
            </section>
          </div>
        )}

        {/* Content Ideas Tab */}
        {activePanel === "content" && (
          <ContentIdeasPanel
            contentIdeas={contentIdeas}
            isLoading={isLoading}
          />
        )}

        {/* Engagement Tab */}
        {activePanel === "engagement" && (
          <EngagementMetricsPanel
            engagements={socialMediaEngagements}
            isLoading={isLoading}
          />
        )}

        {/* Jobs Tab */}
        {activePanel === "jobs" && (
          <JobStatusPanel
            jobStatus={jobStatus}
            isLoading={isLoading}
            integrationSettings={integrationSettings}
            onUpdateSchedule={(payload) => {
              dispatch(updateGlobalSchedules(payload)).then(() => {
                dispatch(fetchIntegrationSettings());
              });
            }}
          />
        )}
      </div>
    </div>
  );
};

export default AutomationTab;
