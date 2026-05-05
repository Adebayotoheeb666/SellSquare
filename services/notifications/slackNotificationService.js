const axios = require("axios");

class SlackNotificationService {
  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.botToken = process.env.SLACK_BOT_TOKEN;
    this.defaultChannel = process.env.SLACK_NOTIFICATION_CHANNEL || "#automation-alerts";
  }

  /**
   * Send notification via Slack webhook
   * @param {String} message - Message text
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Send result
   */
  async sendNotification(message, options = {}) {
    if (!this.webhookUrl) {
      throw new Error("Slack webhook URL not configured. Set SLACK_WEBHOOK_URL environment variable.");
    }

    try {
      const payload = this.buildPayload(message, options);

      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("[Slack] Notification sent successfully");

      return {
        success: true,
        message: "Notification sent to Slack",
      };
    } catch (error) {
      console.error("[Slack] Error sending notification:", error.message);
      throw error;
    }
  }

  /**
   * Build Slack message payload
   * @param {String} message - Main message text
   * @param {Object} options - Options including attachments, fields, etc.
   * @returns {Object} Slack payload
   */
  buildPayload(message, options = {}) {
    const {
      title = null,
      color = "#36a64f",
      fields = [],
      image = null,
      footer = null,
      attachments = [],
      threadTs = null,
      replyBroadcast = false,
    } = options;

    let payload = {
      text: message,
      mrkdwn: true,
    };

    // Add thread context if replying to thread
    if (threadTs) {
      payload.thread_ts = threadTs;
      payload.reply_broadcast = replyBroadcast;
    }

    // Build attachment with fields
    if (title || fields.length > 0 || image || footer) {
      const attachment = {
        color,
        title,
        fields: fields.map((field) => ({
          title: field.label,
          value: field.value,
          short: field.short !== false,
        })),
        mrkdwn_in: ["text", "pretext"],
      };

      if (image) {
        attachment.image_url = image;
      }

      if (footer) {
        attachment.footer = footer.text;
        if (footer.icon) {
          attachment.footer_icon = footer.icon;
        }
      }

      payload.attachments = [attachment, ...attachments];
    }

    return payload;
  }

  /**
   * Send error notification
   * @param {String} title - Error title
   * @param {String} error - Error message/details
   * @param {Object} context - Additional context
   * @returns {Promise<Object>}
   */
  async sendErrorNotification(title, error, context = {}) {
    const message = `⚠️ *${title}*`;

    const fields = [
      {
        label: "Error",
        value: error.message || error.toString(),
        short: false,
      },
    ];

    // Add context fields if provided
    Object.entries(context).forEach(([key, value]) => {
      fields.push({
        label: key.charAt(0).toUpperCase() + key.slice(1),
        value: JSON.stringify(value, null, 2),
        short: false,
      });
    });

    return this.sendNotification(message, {
      color: "#dc3545",
      fields,
      footer: {
        text: `SellSquare Automation • ${new Date().toLocaleString()}`,
      },
    });
  }

  /**
   * Send success notification
   * @param {String} title - Success title
   * @param {String} details - Details message
   * @param {Object} context - Additional context
   * @returns {Promise<Object>}
   */
  async sendSuccessNotification(title, details = "", context = {}) {
    const message = `✅ *${title}*`;

    const fields = [];

    if (details) {
      fields.push({
        label: "Details",
        value: details,
        short: false,
      });
    }

    Object.entries(context).forEach(([key, value]) => {
      fields.push({
        label: key.charAt(0).toUpperCase() + key.slice(1),
        value: String(value),
        short: true,
      });
    });

    return this.sendNotification(message, {
      color: "#28a745",
      fields,
      footer: {
        text: `SellSquare Automation • ${new Date().toLocaleString()}`,
      },
    });
  }

  /**
   * Send automation status update
   * @param {String} automationType - Type of automation (tiktok, instagram, followup, etc.)
   * @param {String} status - Status (success, error, warning)
   * @param {Object} data - Automation data
   * @returns {Promise<Object>}
   */
  async sendAutomationUpdate(automationType, status, data = {}) {
    const statusEmoji = {
      success: "✅",
      error: "❌",
      warning: "⚠️",
      info: "ℹ️",
    };

    const statusColor = {
      success: "#28a745",
      error: "#dc3545",
      warning: "#ffc107",
      info: "#17a2b8",
    };

    const emoji = statusEmoji[status] || "•";
    const color = statusColor[status] || "#36a64f";

    const message = `${emoji} *${automationType.toUpperCase()} Automation* - ${status.toUpperCase()}`;

    const fields = [];

    if (data.message) {
      fields.push({
        label: "Message",
        value: data.message,
        short: false,
      });
    }

    if (data.processed !== undefined) {
      fields.push({
        label: "Processed",
        value: `${data.processed} items`,
        short: true,
      });
    }

    if (data.success !== undefined) {
      fields.push({
        label: "Success",
        value: String(data.success),
        short: true,
      });
    }

    if (data.failed !== undefined) {
      fields.push({
        label: "Failed",
        value: String(data.failed),
        short: true,
      });
    }

    return this.sendNotification(message, {
      color,
      fields,
      footer: {
        text: `SellSquare Automation • ${new Date().toLocaleString()}`,
      },
    });
  }

  /**
   * Send registration follow-up notification
   * @param {Object} followupData - Follow-up data
   * @returns {Promise<Object>}
   */
  async sendFollowupNotification(followupData) {
    const { contactName, businessName, channel, status } = followupData;

    const message = `📧 *New Registration Follow-up Sent*`;

    const fields = [
      { label: "Contact", value: contactName, short: true },
      { label: "Business", value: businessName, short: true },
      { label: "Channel", value: channel, short: true },
      { label: "Status", value: status, short: true },
    ];

    return this.sendNotification(message, {
      color: "#0066cc",
      fields,
      footer: {
        text: `Follow-up Automation • ${new Date().toLocaleString()}`,
      },
    });
  }

  /**
   * Send social media engagement notification
   * @param {Object} engagementData - Engagement data
   * @returns {Promise<Object>}
   */
  async sendEngagementNotification(engagementData) {
    const { platform, action, postId, authorHandle } = engagementData;

    const actionLabel = action.charAt(0).toUpperCase() + action.slice(1);
    const emoji = action === "like" ? "👍" : "💬";

    const message = `${emoji} *${platform.toUpperCase()} Engagement* - ${actionLabel}`;

    const fields = [
      { label: "Platform", value: platform, short: true },
      { label: "Action", value: action, short: true },
      { label: "Author", value: `@${authorHandle}`, short: true },
      { label: "Post ID", value: postId, short: false },
    ];

    return this.sendNotification(message, {
      color: "#ff6b6b",
      fields,
      footer: {
        text: `Social Media Automation • ${new Date().toLocaleString()}`,
      },
    });
  }

  /**
   * Test Slack connection
   * @returns {Promise<Object>}
   */
  async testConnection() {
    try {
      if (!this.webhookUrl) {
        return {
          success: false,
          error: "Slack webhook URL not configured",
        };
      }

      const result = await this.sendNotification("🧪 Test notification from SellSquare Automation", {
        color: "#0066cc",
        footer: {
          text: `Connection Test • ${new Date().toLocaleString()}`,
        },
      });

      return {
        success: true,
        message: "Slack notification test successful",
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = new SlackNotificationService();
