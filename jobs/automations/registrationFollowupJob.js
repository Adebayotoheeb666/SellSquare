const nodemailer = require("nodemailer");
const RegistrationFollowup = require("../../models/registrationFollowupModel");
const FollowupTemplate = require("../../models/followupTemplateModel");
const IntegrationSettings = require("../../models/integrationSettingsModel");
const whatsappService = require("../../services/whatsapp/whatsappService");
const { eventBus, EventTypes } = require("../../events/EventEmitter");

/**
 * Registration Follow-up Automation Job
 * Runs periodically to:
 * 1. Send scheduled follow-up emails
 * 2. Send scheduled WhatsApp messages
 * 3. Track engagement metrics
 * 4. Generate follow-up campaigns
 */
class RegistrationFollowupJob {
  /**
   * Process all pending registration follow-ups
   */
  async processAllFollowups() {
    try {
      console.log("[Registration Followup] Starting job to process all follow-ups");

      // Get all pending follow-ups that are due to be sent
      const now = new Date();
      const followups = await RegistrationFollowup.find({
        status: { $in: ["in_sequence", "pending"] },
        preferences: {
          $or: [{ allowEmail: true }, { allowWhatsapp: true }],
        },
      }).populate("assignedCampaigns");

      console.log(`[Registration Followup] Found ${followups.length} follow-ups to process`);

      for (const followup of followups) {
        try {
          await this.processFollowupSequence(followup);
        } catch (error) {
          console.error(`[Registration Followup] Error processing followup ${followup._id}:`, error.message);
        }
      }

      console.log("[Registration Followup] Job completed");
    } catch (error) {
      console.error("[Registration Followup] Job error:", error.message);
    }
  }

  /**
   * Process a single followup sequence
   */
  async processFollowupSequence(followup) {
    // Find next pending message in sequence
    const pendingMessage = followup.followupSequence.find(
      (msg) => msg.status === "pending" && (!msg.scheduledFor || msg.scheduledFor <= new Date())
    );

    if (!pendingMessage) {
      console.log(`[Registration Followup] No pending messages for followup ${followup._id}`);
      return;
    }

    const { channel } = pendingMessage;

    try {
      if (channel === "email" && followup.preferences.allowEmail) {
        await this.sendEmailFollowup(followup, pendingMessage);
      } else if (channel === "whatsapp" && followup.preferences.allowWhatsapp && followup.contactPhone) {
        await this.sendWhatsAppFollowup(followup, pendingMessage);
      }

      // Check if sequence is complete
      const allSent = followup.followupSequence.every(
        (msg) => msg.status === "sent" || msg.status === "failed" || msg.status === "bounced"
      );

      if (allSent) {
        followup.status = "completed";
        followup.completedAt = new Date();
      }

      await followup.save();
    } catch (error) {
      console.error(`[Registration Followup] Error processing message for followup ${followup._id}:`, error.message);
      pendingMessage.status = "failed";
      pendingMessage.error = error.message;
      await followup.save();
    }
  }

  /**
   * Send email follow-up
   */
  async sendEmailFollowup(followup, messageData) {
    try {
      // Get email settings
      const settings = await IntegrationSettings.findOne({ business: followup.business }).select(
        "+email.apiKey +email.provider +email.senderEmail +email.senderName"
      );

      if (!settings?.email.enabled) {
        throw new Error("Email integration not configured");
      }

      // Get template if referenced
      let emailContent = messageData.templateContent;
      if (messageData.templateId) {
        const template = await FollowupTemplate.findById(messageData.templateId);
        if (template) {
          emailContent = {
            subject: template.subject,
            body: template.body,
            cta: template.callToAction?.text,
          };
        }
      }

      // Replace placeholders
      const subject = this.replacePlaceholders(emailContent.subject || "Welcome!", followup);
      const body = this.replacePlaceholders(emailContent.body || "Thanks for registering!", followup);

      // Send email via configured provider
      const result = await this.sendEmailViaProvider(settings, {
        to: followup.contactEmail,
        subject,
        body,
        html: this.formatEmailHTML(body, emailContent.cta),
        from: `${settings.email.senderName} <${settings.email.senderEmail}>`,
      });

      // Update message status
      messageData.sentAt = new Date();
      messageData.status = "sent";
      messageData.deliveryStatus = "delivered";

      // Update engagement metrics
      followup.engagementMetrics.totalEmailsSent += 1;
      followup.lastActivityAt = new Date();
      followup.lastActivityType = "email_sent";

      // Record interaction
      followup.interactions.push({
        type: "email_sent",
        timestamp: new Date(),
        metadata: {
          subject,
          recipient: followup.contactEmail,
        },
      });

      console.log(`[Registration Followup] Sent email to ${followup.contactEmail}`);

      // Emit event
      eventBus.emit(EventTypes.FOLLOWUP_SENT, {
        followupId: followup._id,
        businessId: followup.business,
        channel: "email",
        recipient: followup.contactEmail,
      });

      return result;
    } catch (error) {
      console.error("Error sending email follow-up:", error.message);
      throw error;
    }
  }

  /**
   * Send WhatsApp follow-up
   */
  async sendWhatsAppFollowup(followup, messageData) {
    try {
      // Get template if referenced
      let messageContent = messageData.templateContent?.body;
      if (messageData.templateId) {
        const template = await FollowupTemplate.findById(messageData.templateId);
        if (template) {
          messageContent = template.body;
        }
      }

      if (!messageContent) {
        throw new Error("No message content found");
      }

      // Replace placeholders
      const message = this.replacePlaceholders(messageContent, followup);

      // Send WhatsApp message
      const result = await whatsappService.sendMessage(followup.business, followup.contactPhone, message);

      // Update message status
      messageData.sentAt = new Date();
      messageData.status = "sent";
      messageData.deliveryStatus = result.status || "delivered";

      // Update engagement metrics
      followup.engagementMetrics.whatsappMessagesSent += 1;
      followup.lastActivityAt = new Date();
      followup.lastActivityType = "whatsapp_sent";

      // Record interaction
      followup.interactions.push({
        type: "whatsapp_sent",
        timestamp: new Date(),
        metadata: {
          message,
          recipient: followup.contactPhone,
          messageId: result.messageId,
        },
      });

      console.log(`[Registration Followup] Sent WhatsApp to ${followup.contactPhone}`);

      // Emit event
      eventBus.emit(EventTypes.FOLLOWUP_SENT, {
        followupId: followup._id,
        businessId: followup.business,
        channel: "whatsapp",
        recipient: followup.contactPhone,
      });

      return result;
    } catch (error) {
      console.error("Error sending WhatsApp follow-up:", error.message);
      throw error;
    }
  }

  /**
   * Send email via configured provider
   */
  async sendEmailViaProvider(settings, emailData) {
    // This is a simplified implementation using nodemailer
    // In production, use the provider's SDK (SendGrid, Mailgun, etc.)

    if (settings.email.provider === "sendgrid") {
      return this.sendViaNodemailer(emailData);
    } else if (settings.email.provider === "mailgun") {
      return this.sendViaNodemailer(emailData);
    } else if (settings.email.provider === "custom_smtp") {
      return this.sendViaCustomSMTP(emailData, settings);
    }

    throw new Error(`Unsupported email provider: ${settings.email.provider}`);
  }

  /**
   * Send via nodemailer (fallback)
   */
  async sendViaNodemailer(emailData) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });

      const result = await transporter.sendMail({
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.body,
      });

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      console.error("Nodemailer error:", error.message);
      throw error;
    }
  }

  /**
   * Send via custom SMTP
   */
  async sendViaCustomSMTP(emailData, settings) {
    // Implement custom SMTP logic if needed
    return this.sendViaNodemailer(emailData);
  }

  /**
   * Replace placeholders in template
   */
  replacePlaceholders(template, followup) {
    let result = template;

    const placeholders = {
      "{{contactName}}": followup.contactName || "there",
      "{{businessName}}": followup.businessName || "our platform",
      "{{ownerName}}": followup.contactName || "there",
      "{{registeredDate}}": new Date(followup.registeredAt).toLocaleDateString(),
      "{{days_since_registration}}": Math.floor(
        (Date.now() - new Date(followup.registeredAt)) / (1000 * 60 * 60 * 24)
      ),
    };

    Object.entries(placeholders).forEach(([key, value]) => {
      result = result.replace(new RegExp(key, "g"), value);
    });

    return result;
  }

  /**
   * Format email HTML
   */
  formatEmailHTML(body, ctaText) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .content { margin-bottom: 20px; line-height: 1.6; }
            .cta { display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="content">
              ${body}
            </div>
            ${ctaText ? `<a href="#" class="cta">${ctaText}</a>` : ""}
          </div>
        </body>
      </html>
    `;
  }
}

module.exports = new RegistrationFollowupJob();
