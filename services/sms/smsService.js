const twilio = require("twilio");

class SMSService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    this.client = null;

    if (this.accountSid && this.authToken) {
      this.client = twilio(this.accountSid, this.authToken);
    }
  }

  /**
   * Send SMS message
   * @param {String} toPhoneNumber - Recipient phone number
   * @param {String} messageBody - Message content
   * @returns {Promise<Object>} Send result
   */
  async sendSMS(toPhoneNumber, messageBody) {
    if (!this.client) {
      throw new Error("Twilio SMS service not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
    }

    try {
      const message = await this.client.messages.create({
        from: this.fromNumber,
        to: toPhoneNumber,
        body: messageBody,
      });

      console.log(`[SMS] Message sent to ${toPhoneNumber}. SID: ${message.sid}`);

      return {
        success: true,
        messageId: message.sid,
        status: message.status,
        to: message.to,
        dateSent: message.dateSent,
      };
    } catch (error) {
      console.error("[SMS] Error sending message:", error.message);
      throw error;
    }
  }

  /**
   * Send SMS to multiple recipients (bulk)
   * @param {Array<String>} phoneNumbers - Array of phone numbers
   * @param {String} messageBody - Message content
   * @returns {Promise<Array>} Results for each recipient
   */
  async sendBulkSMS(phoneNumbers, messageBody) {
    if (!this.client) {
      throw new Error("Twilio SMS service not configured.");
    }

    const results = [];
    const failedNumbers = [];

    for (const phoneNumber of phoneNumbers) {
      try {
        const result = await this.sendSMS(phoneNumber, messageBody);
        results.push({
          phoneNumber,
          success: true,
          ...result,
        });

        // Rate limiting - wait 100ms between messages
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[SMS] Failed to send to ${phoneNumber}:`, error.message);
        results.push({
          phoneNumber,
          success: false,
          error: error.message,
        });
        failedNumbers.push(phoneNumber);
      }
    }

    console.log(
      `[SMS] Bulk send completed: ${results.length - failedNumbers.length}/${results.length} successful`
    );

    return {
      totalAttempts: phoneNumbers.length,
      successful: results.length - failedNumbers.length,
      failed: failedNumbers.length,
      results,
      failedNumbers,
    };
  }

  /**
   * Send SMS with retry logic
   * @param {String} toPhoneNumber - Recipient phone number
   * @param {String} messageBody - Message content
   * @param {Number} maxRetries - Maximum retry attempts
   * @returns {Promise<Object>} Send result
   */
  async sendSMSWithRetry(toPhoneNumber, messageBody, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `[SMS] Attempt ${attempt}/${maxRetries} to send SMS to ${toPhoneNumber}`
        );
        return await this.sendSMS(toPhoneNumber, messageBody);
      } catch (error) {
        lastError = error;
        console.error(
          `[SMS] Attempt ${attempt} failed:`,
          error.message
        );

        if (attempt < maxRetries) {
          // Exponential backoff: wait 1s, 2s, 4s between retries
          const delayMs = Math.pow(2, attempt - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError || new Error("Failed to send SMS after retries");
  }

  /**
   * Format phone number to E.164 format (required by Twilio)
   * @param {String} phoneNumber - Raw phone number
   * @param {String} countryCode - Country code (e.g., 'US', 'IN')
   * @returns {String} Formatted phone number
   */
  static formatPhoneNumber(phoneNumber, countryCode = "US") {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, "");

    // Add country code if needed
    const countryCodeMap = {
      US: "1",
      IN: "91",
      GB: "44",
      AU: "61",
      CA: "1",
    };

    let formatted = cleaned;
    const code = countryCodeMap[countryCode] || "1";

    // If number doesn't start with country code, add it
    if (!formatted.startsWith(code)) {
      formatted = code + formatted;
    }

    // Return in E.164 format
    return "+" + formatted;
  }

  /**
   * Check if phone number is valid
   * @param {String} phoneNumber - Phone number to check
   * @returns {Boolean}
   */
  static isValidPhoneNumber(phoneNumber) {
    // E.164 format: + followed by 1-15 digits
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }

  /**
   * Get message status
   * @param {String} messageId - Twilio message SID
   * @returns {Promise<Object>} Message status
   */
  async getMessageStatus(messageId) {
    if (!this.client) {
      throw new Error("Twilio SMS service not configured.");
    }

    try {
      const message = await this.client.messages(messageId).fetch();

      return {
        messageId: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        body: message.body,
        dateSent: message.dateSent,
        dateUpdated: message.dateUpdated,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
      };
    } catch (error) {
      console.error("[SMS] Error fetching message status:", error.message);
      throw error;
    }
  }

  /**
   * Test SMS connection
   * @returns {Promise<Object>} Test result
   */
  async testConnection() {
    try {
      if (!this.client) {
        return {
          success: false,
          error: "Twilio credentials not configured",
        };
      }

      // Try to fetch account info
      const account = await this.client.api.accounts.list({ limit: 1 });

      return {
        success: true,
        message: "Twilio SMS service connected successfully",
        accountSid: this.accountSid,
        fromNumber: this.fromNumber,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send OTP via SMS
   * @param {String} phoneNumber - Recipient phone number
   * @param {String} otp - OTP code
   * @returns {Promise<Object>} Send result
   */
  async sendOTP(phoneNumber, otp) {
    const messageBody = `Your SellSquare verification code is: ${otp}. Do not share this code with anyone.`;
    return this.sendSMSWithRetry(phoneNumber, messageBody);
  }

  /**
   * Send registration follow-up via SMS
   * @param {String} phoneNumber - Recipient phone number
   * @param {Object} followupData - Follow-up data with contact info
   * @returns {Promise<Object>} Send result
   */
  async sendRegistrationFollowup(phoneNumber, followupData) {
    const { contactName, businessName } = followupData;

    const messageBody = `Hi ${contactName}! Welcome to SellSquare. We're excited to have ${businessName} on board. Start selling today! Visit: https://sellsquare.com/dashboard`;

    return this.sendSMSWithRetry(phoneNumber, messageBody);
  }
}

module.exports = new SMSService();
