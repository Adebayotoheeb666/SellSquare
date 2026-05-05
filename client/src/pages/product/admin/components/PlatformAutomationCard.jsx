import React, { useState } from "react";
import { useDispatch } from "react-redux";
import {
  connectTikTokIntegration,
  disconnectTikTokIntegration,
  connectInstagramIntegration,
  disconnectInstagramIntegration,
  connectWhatsAppIntegration,
  disconnectWhatsAppIntegration,
  connectEmailIntegration,
  disconnectEmailIntegration,
  connectElevenLabsIntegration,
  disconnectElevenLabsIntegration,
  updateAutomationSettings,
  fetchIntegrationSettings,
  testIntegrationConnection,
  updateGlobalSchedules,
} from "../../../../redux/features/integration/integrationSlice";
import { fetchAutomationStatus } from "../../../../redux/features/automation/automationSlice";
import { useAsyncToast } from "../../../../customHook/useAsyncToast";

const PlatformAutomationCard = ({
  platform,
  title,
  isConnected,
  status,
  automationEnabled,
  lastSynced,
  isConnecting,
  settings,
}) => {
  const dispatch = useDispatch();
  const { executeWithToast } = useAsyncToast();
  const [showSettings, setShowSettings] = useState(false);

  // Listen for OAuth success messages from popup
  React.useEffect(() => {
    const handleOAuthMessage = (event) => {
      if (event.data?.type === "tiktok_connected" && event.data?.status === "success") {
        dispatch(fetchIntegrationSettings());
        dispatch(fetchAutomationStatus());
      }
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [dispatch]);

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "connected":
        return "status-badge status-connected";
      case "disconnected":
        return "status-badge status-disconnected";
      case "error":
        return "status-badge status-error";
      case "testing":
        return "status-badge status-testing";
      default:
        return "status-badge";
    }
  };

  const getStatusText = (status) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleConnect = () => {
    if (platform === "tiktok") {
      // Redirect through backend which generates PKCE code_challenge correctly
      const backendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";
      const authUrl = `${backendUrl}/api/integrations/tiktok/oauth/start`;
      // Open auth in a popup
      window.open(authUrl, "TikTokAuth", "width=600,height=700");
    } else if (platform === "instagram") {
      executeWithToast(
        dispatch(connectInstagramIntegration({
          monitoringEnabled: true,
          engagementEnabled: true,
          contentGenerationEnabled: false,
        })),
        {
          loading: "Connecting Instagram...",
          success: () => {
            dispatch(fetchAutomationStatus());
            return "Instagram connected successfully";
          },
          error: "Failed to connect Instagram",
        }
      );
    } else if (platform === "whatsapp") {
      // Credentials come from backend env vars (WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN)
      executeWithToast(
        dispatch(connectWhatsAppIntegration({
          automationSettings: {
            followupEnabled: true,
            autoResponseEnabled: true
          }
        })),
        {
          loading: "Connecting WhatsApp...",
          success: () => {
            dispatch(fetchAutomationStatus());
            return "WhatsApp connected successfully";
          },
          error: "Failed to connect WhatsApp",
        }
      );
    } else if (platform === "email") {
      // Credentials come from backend env vars (EMAIL_API_KEY, EMAIL_SENDER, EMAIL_PROVIDER)
      executeWithToast(
        dispatch(connectEmailIntegration({
          automationSettings: {
            followupEnabled: true,
            autoResponseEnabled: true
          }
        })),
        {
          loading: "Connecting Email...",
          success: () => {
            dispatch(fetchAutomationStatus());
            return "Email connected successfully";
          },
          error: "Failed to connect Email",
        }
      );
    } else if (platform === "elevenlabs") {
      // Backend uses env variables if not provided
      executeWithToast(
        dispatch(connectElevenLabsIntegration()),
        {
          loading: "Connecting ElevenLabs...",
          success: () => {
            dispatch(fetchAutomationStatus());
            return "ElevenLabs connected successfully";
          },
          error: "Failed to connect ElevenLabs",
        }
      );
    }
  };

  const handleTestConnection = () => {
    executeWithToast(
      dispatch(testIntegrationConnection(platform)),
      {
        loading: `Testing ${title} connection...`,
        success: (action) => {
          const isVerified = action.payload?.result?.connected;
          return isVerified
            ? `${title} connection verified successfully`
            : `${title} connection test failed. Check credentials.`;
        },
        error: (err) => `Connection test failed: ${err}`,
      }
    );
  };

  const handleDisconnect = () => {
    if (window.confirm(`Are you sure you want to disconnect ${title}?`)) {
      if (platform === "tiktok") {
        executeWithToast(
          dispatch(disconnectTikTokIntegration()),
          {
            loading: "Disconnecting TikTok...",
            success: () => {
              dispatch(fetchAutomationStatus());
              return "TikTok disconnected";
            },
            error: "Failed to disconnect TikTok",
          }
        );
      } else if (platform === "instagram") {
        executeWithToast(
          dispatch(disconnectInstagramIntegration()),
          {
            loading: "Disconnecting Instagram...",
            success: () => {
              dispatch(fetchAutomationStatus());
              return "Instagram disconnected";
            },
            error: "Failed to disconnect Instagram",
          }
        );
      } else if (platform === "whatsapp") {
        executeWithToast(
          dispatch(disconnectWhatsAppIntegration()),
          {
            loading: "Disconnecting WhatsApp...",
            success: () => {
              dispatch(fetchAutomationStatus());
              return "WhatsApp disconnected";
            },
            error: "Failed to disconnect WhatsApp",
          }
        );
      } else if (platform === "email") {
        executeWithToast(
          dispatch(disconnectEmailIntegration()),
          {
            loading: "Disconnecting Email...",
            success: () => {
              dispatch(fetchAutomationStatus());
              return "Email disconnected";
            },
            error: "Failed to disconnect Email",
          }
        );
      } else if (platform === "elevenlabs") {
        executeWithToast(
          dispatch(disconnectElevenLabsIntegration()),
          {
            loading: "Disconnecting ElevenLabs...",
            success: () => {
              dispatch(fetchAutomationStatus());
              return "ElevenLabs disconnected";
            },
            error: "Failed to disconnect ElevenLabs",
          }
        );
      }
    }
  };

  const platformSettings = {
    tiktok: [
      { label: "Monitor recent posts", key: "monitoringEnabled" },
      { label: "Auto-engage (likes & comments)", key: "engagementEnabled" },
      { label: "Auto-post content", key: "contentGenerationEnabled" },
    ],
    instagram: [
      { label: "Monitor recent posts", key: "monitoringEnabled" },
      { label: "Auto-engage (likes & comments)", key: "engagementEnabled" },
      { label: "Auto-post content", key: "contentGenerationEnabled" },
    ],
    whatsapp: [
      { label: "Follow-up messages", key: "followupEnabled" },
      { label: "Auto-respond to inquiries", key: "autoResponseEnabled" },
    ],
    email: [
      { label: "Follow-up campaigns", key: "followupEnabled" },
      { label: "Auto-respond to new registrations", key: "autoResponseEnabled" },
    ],
  };

  const settingsList = platformSettings[platform] || [];

  return (
    <div className="platform-automation-card">
      <div className="card-header">
        <div className="header-content">
          <h4>{title}</h4>
          <span className={getStatusBadgeClass(status)}>
            {getStatusText(status)}
          </span>
        </div>
        <div className="header-actions">
          {isConnected ? (
            <button
              className="btn-danger btn-sm"
              onClick={handleDisconnect}
              disabled={isConnecting}
              title="Disconnect this platform"
            >
              Disconnect
            </button>
          ) : (
            <button
              className="btn-primary btn-sm"
              onClick={handleConnect}
              disabled={isConnecting}
              title="Connect this platform"
            >
              Connect
            </button>
          )}
        </div>
      </div>

      <div className="card-body">
        {/* Last Synced */}
        {lastSynced && (
          <div className="info-row">
            <span className="label">Last synced:</span>
            <span className="value">{new Date(lastSynced).toLocaleString()}</span>
          </div>
        )}

        <div className="info-row">
          <span className="label">Status:</span>
          <div className="status-value-group">
            <span className={`value status-indicator ${isConnected ? "connected" : "disconnected"}`}>
              {isConnected ? "Connected & Active" : "Not connected"}
            </span>
            {isConnected && (
              <button
                className="btn-link btn-xs test-btn"
                onClick={handleTestConnection}
                disabled={isConnecting}
              >
                Test Connection
              </button>
            )}
          </div>
        </div>

        {/* Automation Enabled */}
        {isConnected && (
          <div className="info-row">
            <span className="label">Automation:</span>
            <span className={`value automation-status ${automationEnabled ? "enabled" : "disabled"}`}>
              {automationEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        )}

        {/* Settings */}
        {isConnected && settingsList.length > 0 && (
          <>
            <button
              className="settings-toggle"
              onClick={() => setShowSettings(!showSettings)}
            >
              {showSettings ? "▼" : "▶"} Settings
            </button>

            {showSettings && (
              <div className="settings-panel">
                {settingsList.map((setting) => (
                  <div key={setting.key} className="setting-item">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings?.[setting.key] || false}
                        onChange={async (e) => {
                          const newSettings = {
                            ...settings,
                            [setting.key]: e.target.checked,
                          };
                          const resultAction = await dispatch(
                            updateAutomationSettings({
                              platform,
                              automationSettings: newSettings,
                            })
                          );
                          if (!resultAction.error) {
                            dispatch(fetchIntegrationSettings());
                          }
                        }}
                      />
                      <span>{setting.label}</span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Call to Action */}
        {!isConnected && (
          <div className="cta-message">
            <p>Connect {title} to enable automation for your platform marketing.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlatformAutomationCard;
