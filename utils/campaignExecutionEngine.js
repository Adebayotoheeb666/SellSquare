/**
 * Campaign Execution Engine
 * Handles campaign execution, message routing, and delivery tracking
 */

const sendEmail = require("./sendEmail");
const sendMessage = require("./sendMessageHelper");
const sendSMS = require("./sendSMS");
const CampaignExecution = require("../models/campaignExecutionModel");
const Campaign = require("../models/campaignModel");
const { renderTemplate } = require("./campaignTemplateEngine");
const {
  emitCampaignMessageSent,
  emitCampaignMessageFailed,
  emitCampaignExecutionCompleted,
  emitCampaignExecutionStarted,
} = require("../events/campaignEvents");

/**
 * Execute a campaign for a single recipient
 */
async function executeCampaignForRecipient(
  campaign,
  recipient,
  businessId,
  variables = {}
) {
  const execution = new CampaignExecution({
    business: businessId,
    campaign: campaign._id,
    recipient,
    variables,
    channels: campaign.channels.map((ch) => ({
      type: ch.type,
      status: "pending",
    })),
  });

  try {
    // Execute on each channel
    for (let i = 0; i < campaign.channels.length; i++) {
      const channel = campaign.channels[i];

      try {
        const result = await sendViaChannel(
          channel,
          recipient,
          campaign,
          businessId,
          variables
        );

        execution.channels[i].status = "sent";
        execution.channels[i].messageId = result.messageId;
        execution.channels[i].sentAt = new Date();
        execution.channels[i].response = result.response;

        // Emit event for message sent
        emitCampaignMessageSent(
          execution._id,
          campaign._id,
          businessId,
          channel.type,
          recipient.email || recipient.phone
        );
      } catch (error) {
        execution.channels[i].status = "failed";
        execution.channels[i].failureReason = error.message;

        // Emit event for message failed
        emitCampaignMessageFailed(
          execution._id,
          campaign._id,
          businessId,
          channel.type,
          recipient.email || recipient.phone,
          error.message
        );
      }
    }

    // Update campaign stats
    const allSent = execution.channels.every((ch) => ch.status === "sent");
    if (allSent) {
      await Campaign.findByIdAndUpdate(campaign._id, {
        $inc: {
          "stats.totalSent": 1,
          "stats.totalDelivered": 1,
        },
        $set: {
          "stats.lastExecutedAt": new Date(),
        },
      });
    } else {
      await Campaign.findByIdAndUpdate(campaign._id, {
        $inc: {
          "stats.totalFailed": 1,
        },
      });
    }

    await execution.save();
    return execution;
  } catch (error) {
    execution.error = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date(),
    };
    await execution.save();
    throw error;
  }
}

/**
 * Send message via specific channel
 */
async function sendViaChannel(
  channel,
  recipient,
  campaign,
  businessId,
  variables
) {
  const rendered = await renderTemplate(channel.templateId, variables, businessId);

  switch (channel.type) {
    case "email":
      return await sendEmailMessage(recipient, rendered);

    case "whatsapp":
      return await sendWhatsAppMessage(recipient, rendered);

    case "sms":
      return await sendSMSMessage(recipient, rendered);

    default:
      throw new Error(`Unknown channel type: ${channel.type}`);
  }
}

/**
 * Send email via sendEmail utility
 */
async function sendEmailMessage(recipient, rendered) {
  try {
    await sendEmail(
      rendered.subject,
      rendered.body,
      recipient.email || recipient.metadata?.email,
      process.env.ADMIN_EMAIL || "noreply@sellsquare.io",
      null,
      { template: "campaign", isHtml: true }
    );

    return {
      messageId: `email_${Date.now()}`,
      response: { status: "sent" },
    };
  } catch (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }
}

/**
 * Send WhatsApp message
 */
async function sendWhatsAppMessage(recipient, rendered) {
  try {
    const phone = recipient.phone || recipient.metadata?.phone;
    if (!phone) {
      throw new Error("No phone number provided for WhatsApp message");
    }

    // For WhatsApp, we typically use template messages
    // This would depend on your specific WhatsApp setup
    const response = await sendMessage(
      getWhatsAppPayload(phone, rendered.body)
    );

    return {
      messageId: response?.data?.messages?.[0]?.id || `wa_${Date.now()}`,
      response: response?.data,
    };
  } catch (error) {
    throw new Error(`WhatsApp send failed: ${error.message}`);
  }
}

/**
 * Build WhatsApp message payload
 */
function getWhatsAppPayload(phone, text) {
  return JSON.stringify({
    messaging_product: "whatsapp",
    preview_url: false,
    recipient_type: "individual",
    to: phone,
    type: "text",
    text: { body: text },
  });
}

/**
 * Send SMS message
 */
async function sendSMSMessage(recipient, rendered) {
  try {
    const phone = recipient.phone || recipient.metadata?.phone;
    if (!phone) {
      throw new Error("No phone number provided for SMS message");
    }

    await sendSMS(phone, rendered.body);

    return {
      messageId: `sms_${Date.now()}`,
      response: { status: "sent" },
    };
  } catch (error) {
    throw new Error(`SMS send failed: ${error.message}`);
  }
}

/**
 * Get recipients for campaign based on audience configuration
 */
async function getCampaignRecipients(campaign) {
  const { targetAudience } = campaign;

  switch (targetAudience.type) {
    case "email_list":
      return targetAudience.emailList || [];

    case "segment":
      // Would integrate with customer segmentation system
      return [];

    case "all_customers":
    default:
      // Would fetch all customers from the business
      return [];
  }
}

/**
 * Execute scheduled campaign
 */
async function executeScheduledCampaign(campaignId, businessId) {
  const campaign = await Campaign.findOne({
    _id: campaignId,
    business: businessId,
  }).populate("channels.templateId");

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  if (campaign.status !== "active") {
    throw new Error("Campaign is not active");
  }

  const recipients = await getCampaignRecipients(campaign);

  // Emit execution started event
  emitCampaignExecutionStarted(campaignId, businessId, recipients.length);

  const results = [];
  for (const recipient of recipients) {
    try {
      const execution = await executeCampaignForRecipient(
        campaign,
        recipient,
        businessId,
        campaign.variableMapping
      );
      results.push({
        success: true,
        execution,
      });
    } catch (error) {
      results.push({
        success: false,
        error: error.message,
      });
    }
  }

  // Calculate execution stats
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  // Emit execution completed event
  emitCampaignExecutionCompleted(campaignId, businessId, {
    totalRecipients: recipients.length,
    successCount,
    failureCount,
    completedAt: new Date(),
  });

  return {
    campaignId,
    totalRecipients: recipients.length,
    results,
  };
}

module.exports = {
  executeCampaignForRecipient,
  sendViaChannel,
  sendEmailMessage,
  sendWhatsAppMessage,
  sendSMSMessage,
  getCampaignRecipients,
  executeScheduledCampaign,
};
