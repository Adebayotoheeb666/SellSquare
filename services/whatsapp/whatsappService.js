const twilio = require("twilio");
const IntegrationSettings = require("../../models/integrationSettingsModel");
const RegistrationFollowup = require("../../models/registrationFollowupModel");

class WhatsAppService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.twilioClient = this.accountSid && this.authToken ? twilio(this.accountSid, this.authToken) : null;
  }

  /**
   * Get WhatsApp credentials
   */
  async getWhatsAppClient(businessId) {
    const settings = await IntegrationSettings.findOne({ business: businessId }).select(
      "+whatsapp.accessToken +whatsapp.businessPhoneNumberId"
    );

    let accessToken = settings?.whatsapp?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    let businessPhoneNumberId = settings?.whatsapp?.businessPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    const isPlatformLevel = businessId === process.env.SUPERADMIN_BUSINESS_ID;

    if (!isPlatformLevel) {
      if (!settings?.whatsapp.enabled) {
        throw new Error("WhatsApp integration not configured for this business");
      }
      if (!settings.whatsapp.accessToken || !settings.whatsapp.businessPhoneNumberId) {
        throw new Error("WhatsApp credentials not found in settings");
      }
    } else {
      if (!accessToken || accessToken.includes("your_")) {
        throw new Error("WhatsApp access token not found or invalid in .env for platform.");
      }
    }

    return {
      accessToken,
      businessPhoneNumberId,
      twilioPhoneNumber: process.env.TWILIO_WHATSAPP_PHONE_NUMBER,
    };
  }

  /**
   * Send WhatsApp message using Twilio
   */
  async sendMessage(businessId, toPhoneNumber, messageBody, mediaUrl = null) {
    try {
      const client = await this.getWhatsAppClient(businessId);

      if (!this.twilioClient) {
        throw new Error("Twilio not configured");
      }

      const messageData = {
        body: messageBody,
        from: `whatsapp:${client.twilioPhoneNumber}`,
        to: `whatsapp:${toPhoneNumber}`,
      };

      // Add media if provided
      if (mediaUrl) {
        messageData.mediaUrl = [mediaUrl];
      }

      const message = await this.twilioClient.messages.create(messageData);

      return {
        success: true,
        messageId: message.sid,
        status: message.status,
        sentAt: new Date(),
      };
    } catch (error) {
      console.error("Failed to send WhatsApp message:", error.message);
      throw error;
    }
  }

  /**
   * Send templated WhatsApp message for follow-ups
   */
  async sendTemplatedMessage(businessId, toPhoneNumber, templateData) {
    const { templateBody, variables = {} } = templateData;

    try {
      // Replace placeholders in template
      let messageBody = templateBody;
      Object.entries(variables).forEach(([key, value]) => {
        messageBody = messageBody.replace(`{{${key}}}`, value);
      });

      return await this.sendMessage(businessId, toPhoneNumber, messageBody);
    } catch (error) {
      console.error("Failed to send templated WhatsApp message:", error.message);
      throw error;
    }
  }

  /**
   * Send registration follow-up message
   */
  async sendRegistrationFollowup(followupRecord, templateContent) {
    try {
      const { business, contactPhone, contactName, businessName } = followupRecord;

      const variables = {
        contactName: contactName || "there",
        businessName: businessName || "our platform",
        registeredAt: new Date(followupRecord.registeredAt).toLocaleDateString(),
      };

      const result = await this.sendTemplatedMessage(business, contactPhone, {
        templateBody: templateContent,
        variables,
      });

      // Update followup record
      const sequence = followupRecord.followupSequence[followupRecord.followupSequence.length - 1];
      if (sequence) {
        sequence.sentAt = new Date();
        sequence.status = result.status === "queued" ? "sent" : result.status;
        sequence.deliveryStatus = "delivered";
        await followupRecord.save();
      }

      // Update engagement metrics
      followupRecord.engagementMetrics.whatsappMessagesSent += 1;
      followupRecord.lastActivityAt = new Date();
      followupRecord.lastActivityType = "whatsapp_sent";
      await followupRecord.save();

      console.log(`[WhatsApp] Sent follow-up to ${contactPhone}`);

      return {
        success: true,
        messageId: result.messageId,
        followupId: followupRecord._id,
      };
    } catch (error) {
      console.error("Error sending registration follow-up:", error.message);
      throw error;
    }
  }

  /**
   * Handle incoming WhatsApp messages (webhook)
   */
  async handleIncomingMessage(messageData) {
    try {
      const { From, Body, MediaUrl0 } = messageData;
      const phoneNumber = From.replace("whatsapp:", "");

      console.log(`[WhatsApp] Received message from ${phoneNumber}: ${Body}`);

      // Find the corresponding followup record
      const followup = await RegistrationFollowup.findOne({
        contactPhone: phoneNumber,
      });

      if (!followup) {
        console.log(`[WhatsApp] No followup record found for ${phoneNumber}`);
        return;
      }

      // Record the interaction
      followup.interactions.push({
        type: "whatsapp_reply",
        timestamp: new Date(),
        metadata: {
          messageBody: Body,
          mediaUrl: MediaUrl0,
        },
      });

      followup.engagementMetrics.whatsappMessagesRead += 1;
      followup.lastActivityAt = new Date();
      followup.lastActivityType = "whatsapp_reply";
      await followup.save();

      // Emit event for real-time update
      const { eventBus, EventTypes } = require("../../events/EventEmitter");
      eventBus.emit(EventTypes.FOLLOWUP_INTERACTION, {
        followupId: followup._id,
        businessId: followup.business,
        type: "whatsapp_reply",
        messageBody: Body,
      });

      return {
        success: true,
        followupId: followup._id,
      };
    } catch (error) {
      console.error("Error handling incoming message:", error.message);
      throw error;
    }
  }

  /**
   * Check message delivery status
   */
  async checkDeliveryStatus(messageId) {
    try {
      if (!this.twilioClient) {
        throw new Error("Twilio not configured");
      }

      const message = await this.twilioClient.messages(messageId).fetch();

      return {
        messageId,
        status: message.status,
        sentTime: message.dateSent,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
      };
    } catch (error) {
      console.error("Failed to check delivery status:", error.message);
      throw error;
    }
  }

  /**
   * Unsubscribe a contact from WhatsApp campaigns
   */
  async unsubscribeContact(followupId) {
    try {
      const followup = await RegistrationFollowup.findByIdAndUpdate(
        followupId,
        {
          "preferences.allowWhatsapp": false,
          unsubscribedAt: new Date(),
          status: "unsubscribed",
        },
        { new: true }
      );

      console.log(`[WhatsApp] Unsubscribed ${followup.contactPhone}`);

      return {
        success: true,
        followupId,
      };
    } catch (error) {
      console.error("Error unsubscribing contact:", error.message);
      throw error;
    }
  }

  /**
   * Get WhatsApp conversation history
   */
  async getConversationHistory(followupId) {
    try {
      const followup = await RegistrationFollowup.findById(followupId).select("interactions contactPhone");

      if (!followup) {
        throw new Error("Followup record not found");
      }

      return {
        followupId,
        phoneNumber: followup.contactPhone,
        interactions: followup.interactions,
        totalMessages: followup.interactions.length,
      };
    } catch (error) {
      console.error("Error getting conversation history:", error.message);
      throw error;
    }
  }

  /**
   * Test WhatsApp connection
   */
  async testConnection(businessId) {
    try {
      const client = await this.getWhatsAppClient(businessId);

      // Approach 1: Try Twilio if configured
      if (this.twilioClient) {
        try {
          const account = await this.twilioClient.api.accounts(this.accountSid).fetch();
          return {
            connected: true,
            provider: "twilio",
            accountInfo: {
              status: account.status,
              type: account.type,
            },
          };
        } catch (twilioErr) {
          console.warn("Twilio test failed, falling back to Meta API:", twilioErr.message);
        }
      }

      // Approach 2: Try Meta WhatsApp Cloud API
      const axios = require("axios");
      const endpoint = `https://graph.facebook.com/v18.0/${client.businessPhoneNumberId}`;
      const response = await axios.get(endpoint, {
        params: {
          access_token: client.accessToken,
        },
      });

      return {
        connected: true,
        provider: "meta",
        accountInfo: {
          id: response.data.id,
          verified_name: response.data.verified_name || "Unknown",
        },
      };

    } catch (error) {
      console.error("WhatsApp test connection error:", error.response?.data || error.message);
      return {
        connected: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }
}

module.exports = new WhatsAppService();
