import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { tabs } from "sonner";
import "./automationDashboard.css";

import {
  fetchAutomationStatus,
  fetchJobStatus,
  selectAutomationStatus,
  selectJobStatus,
  selectAutomationLoading,
} from "../../../redux/features/automation/automationSlice";

import AutomationStatus from "./components/AutomationStatus";
import SocialMediaEngagements from "./components/SocialMediaEngagements";
import ContentIdeasApproval from "./components/ContentIdeasApproval";
import FollowupCampaigns from "./components/FollowupCampaigns";
import RegistrationFollowups from "./components/RegistrationFollowups";
import Loader from "../../../components/loader/Loader";

const AutomationDashboard = () => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState("status");

  const automationStatus = useSelector(selectAutomationStatus);
  const jobStatus = useSelector(selectJobStatus);
  const isLoading = useSelector(selectAutomationLoading);

  useEffect(() => {
    dispatch(fetchAutomationStatus());
    dispatch(fetchJobStatus());

    // Refresh status every 30 seconds
    const interval = setInterval(() => {
      dispatch(fetchAutomationStatus());
      dispatch(fetchJobStatus());
    }, 30000);

    return () => clearInterval(interval);
  }, [dispatch]);

  return (
    <div className="automation-dashboard-container">
      <div className="automation-header">
        <h1>Automation Center</h1>
        <p>Manage TikTok/Instagram automation, registration follow-ups, and content publishing</p>
      </div>

      {isLoading && <Loader />}

      <div className="automation-tabs">
        <button
          className={`tab-button ${activeTab === "status" ? "active" : ""}`}
          onClick={() => setActiveTab("status")}
        >
          Status
        </button>
        <button
          className={`tab-button ${activeTab === "engagements" ? "active" : ""}`}
          onClick={() => setActiveTab("engagements")}
        >
          Social Engagements
        </button>
        <button
          className={`tab-button ${activeTab === "content" ? "active" : ""}`}
          onClick={() => setActiveTab("content")}
        >
          Content Ideas
        </button>
        <button
          className={`tab-button ${activeTab === "followups" ? "active" : ""}`}
          onClick={() => setActiveTab("followups")}
        >
          Follow-ups
        </button>
        <button
          className={`tab-button ${activeTab === "campaigns" ? "active" : ""}`}
          onClick={() => setActiveTab("campaigns")}
        >
          Campaigns
        </button>
      </div>

      <div className="automation-content">
        {activeTab === "status" && (
          <AutomationStatus
            status={automationStatus}
            jobStatus={jobStatus}
          />
        )}

        {activeTab === "engagements" && <SocialMediaEngagements />}

        {activeTab === "content" && <ContentIdeasApproval />}

        {activeTab === "followups" && <RegistrationFollowups />}

        {activeTab === "campaigns" && <FollowupCampaigns />}
      </div>
    </div>
  );
};

export default AutomationDashboard;
