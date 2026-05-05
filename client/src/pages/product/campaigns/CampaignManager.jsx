import { useState, useEffect } from "react";
import { useAsyncToast } from "../../../customHook/useAsyncToast";
import "./campaigns.css";

const CAMPAIGN_TYPES = [
  { value: "manual", label: "Manual", description: "Trigger whenever you want" },
  { value: "scheduled", label: "Scheduled", description: "Send at specific times" },
  {
    value: "event-triggered",
    label: "Event-Triggered",
    description: "Trigger based on customer actions",
  },
];

const EVENT_TYPES = [
  { value: "order_created", label: "Order Created" },
  { value: "order_completed", label: "Order Completed" },
  { value: "customer_signup", label: "Customer Signup" },
  { value: "product_purchase", label: "Product Purchase" },
  { value: "cart_abandoned", label: "Cart Abandoned" },
  { value: "payment_failed", label: "Payment Failed" },
];

const CampaignManager = ({ onSave, initialCampaign = null, templates = [], isLoading = false }) => {
  const { showToast } = useAsyncToast();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "manual",
    channels: [{ type: "email", templateId: "" }],
    triggerConfig: {},
    targetAudience: { type: "all_customers" },
    variableMapping: {},
  });

  useEffect(() => {
    if (initialCampaign) {
      setFormData(initialCampaign);
    }
  }, [initialCampaign]);

  const handleAddChannel = () => {
    setFormData({
      ...formData,
      channels: [...formData.channels, { type: "email", templateId: "" }],
    });
  };

  const handleRemoveChannel = (index) => {
    if (formData.channels.length > 1) {
      setFormData({
        ...formData,
        channels: formData.channels.filter((_, i) => i !== index),
      });
    } else {
      showToast("Campaign must have at least one channel", "warning");
    }
  };

  const handleChannelChange = (index, field, value) => {
    const newChannels = [...formData.channels];
    newChannels[index][field] = value;
    setFormData({ ...formData, channels: newChannels });
  };

  const getAvailableTemplates = (channelType) => {
    return templates.filter((t) => t.type === channelType);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast("Campaign name is required", "warning");
      return;
    }

    if (formData.channels.length === 0) {
      showToast("At least one channel is required", "warning");
      return;
    }

    if (formData.channels.some((ch) => !ch.templateId)) {
      showToast("All channels must have a template selected", "warning");
      return;
    }

    onSave(formData);
  };

  return (
    <div className="campaign-manager-container">
      <form onSubmit={handleSubmit} className="campaign-form">
        <div className="form-section">
          <h3>Campaign Details</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Campaign Name *</label>
              <input
                type="text"
                className="form-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Welcome New Customers"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label>Campaign Type *</label>
              <select
                className="form-select"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                disabled={isLoading || !!initialCampaign}
              >
                {CAMPAIGN_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              className="form-input"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this campaign"
              rows="2"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Communication Channels</h3>
          <p className="section-description">
            Select templates for each channel where this campaign will be sent
          </p>

          <div className="channels-list">
            {formData.channels.map((channel, index) => (
              <div key={index} className="channel-item">
                <div className="channel-row">
                  <div className="form-group">
                    <label>Channel Type</label>
                    <select
                      className="form-select"
                      value={channel.type}
                      onChange={(e) => handleChannelChange(index, "type", e.target.value)}
                      disabled={isLoading}
                    >
                      <option value="email">📧 Email</option>
                      <option value="whatsapp">💬 WhatsApp</option>
                      <option value="sms">📱 SMS</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Template *</label>
                    <select
                      className="form-select"
                      value={channel.templateId}
                      onChange={(e) => handleChannelChange(index, "templateId", e.target.value)}
                      disabled={isLoading || getAvailableTemplates(channel.type).length === 0}
                    >
                      <option value="">Select a template...</option>
                      {getAvailableTemplates(channel.type).map((template) => (
                        <option key={template._id} value={template._id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                    {getAvailableTemplates(channel.type).length === 0 && (
                      <small className="form-hint error">
                        No {channel.type} templates available. Create one first.
                      </small>
                    )}
                  </div>

                  {formData.channels.length > 1 && (
                    <button
                      type="button"
                      className="btn-remove"
                      onClick={() => handleRemoveChannel(index)}
                      disabled={isLoading}
                      title="Remove channel"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn-secondary-small"
            onClick={handleAddChannel}
            disabled={isLoading}
          >
            + Add Another Channel
          </button>
        </div>

        {formData.type === "scheduled" && (
          <div className="form-section">
            <h3>Scheduling</h3>

            <div className="form-row">
              <div className="form-group">
                <label>Schedule Type</label>
                <select
                  className="form-select"
                  value={formData.triggerConfig.scheduleType || "once"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      triggerConfig: {
                        ...formData.triggerConfig,
                        scheduleType: e.target.value,
                      },
                    })
                  }
                  disabled={isLoading}
                >
                  <option value="once">Send Once</option>
                  <option value="recurring">Recurring</option>
                </select>
              </div>

              <div className="form-group">
                <label>Schedule Date & Time</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={formData.triggerConfig.scheduledFor || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      triggerConfig: {
                        ...formData.triggerConfig,
                        scheduledFor: e.target.value,
                      },
                    })
                  }
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        )}

        {formData.type === "event-triggered" && (
          <div className="form-section">
            <h3>Event Trigger</h3>

            <div className="form-group">
              <label>Trigger Event</label>
              <select
                className="form-select"
                value={formData.triggerConfig.eventType || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    triggerConfig: {
                      ...formData.triggerConfig,
                      eventType: e.target.value,
                    },
                  })
                }
                disabled={isLoading}
              >
                <option value="">Select an event...</option>
                {EVENT_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="form-section">
          <h3>Target Audience</h3>

          <div className="form-group">
            <label>Audience Segment</label>
            <select
              className="form-select"
              value={formData.targetAudience.type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  targetAudience: { type: e.target.value },
                })
              }
              disabled={isLoading}
            >
              <option value="all_customers">All Customers</option>
              <option value="segment">Customer Segment</option>
              <option value="email_list">Email List</option>
            </select>
          </div>
        </div>

        <div className="form-section">
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Campaign"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CampaignManager;
