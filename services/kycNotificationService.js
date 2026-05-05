/**
 * KYC Notification Service
 *
 * Handles email notifications for KYC approval and rejection events.
 * Listens to KYC_VERIFIED and KYC_REJECTED events and sends appropriate emails.
 */

const { eventBus, EventTypes } = require("../events");
const { sendEmail } = require("../utils/sendEmail");
const Business = require("../models/businessRegistration");
const BusinessKyc = require("../models/businessKycModel");

/**
 * Send KYC approval email
 */
const sendKYCApprovalEmail = async (businessId, kycData) => {
  try {
    const business = await Business.findById(businessId);
    if (!business || !business.businessEmail) {
      console.warn(`[KYC Notification] Business not found or no email for ID: ${businessId}`);
      return;
    }

    const appName = "Sell Square";
    const storeUrl = kycData.storeToken
      ? `${process.env.CLIENT_URL || "https://app.sellsquare.io"}/marketplace/store/${kycData.storeToken}`
      : null;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>KYC Approved - ${appName}</title>
          <style>
            @import url("https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap");

            body {
              margin: 0;
              padding: 0;
              background-color: #f6f6f6;
              font-family: 'Poppins', Arial, sans-serif;
            }

            .email-container {
              width: 100%;
              padding: 40px 20px;
              background-color: #f6f6f6;
              box-sizing: border-box;
            }

            .email-content {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 8px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.05);
              padding: 40px;
              box-sizing: border-box;
            }

            .email-content h2 {
              margin-top: 0;
              color: #295F2D;
              font-weight: 600;
              font-size: 24px;
            }

            .email-content p {
              font-size: 16px;
              color: #555555;
              margin-bottom: 20px;
              line-height: 1.6;
            }

            .success-badge {
              display: inline-block;
              background-color: #295F2D;
              color: #ffffff;
              padding: 12px 24px;
              border-radius: 6px;
              font-weight: 600;
              margin: 20px 0;
              font-size: 15px;
            }

            .business-info {
              background-color: #f0f8f1;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              border-left: 4px solid #295F2D;
            }

            .business-info-item {
              margin: 10px 0;
              font-size: 15px;
            }

            .business-info-label {
              font-weight: 600;
              color: #295F2D;
              display: inline-block;
              min-width: 120px;
            }

            .action-button {
              display: inline-block;
              background-color: #295F2D;
              color: #ffffff !important;
              padding: 14px 28px;
              border-radius: 6px;
              text-decoration: none;
              font-weight: 500;
              font-size: 16px;
              margin-top: 20px;
              transition: background-color 0.3s ease;
            }

            .action-button:hover {
              background-color: #1f4620;
            }

            .signature {
              margin-top: 30px;
              font-size: 16px;
              color: #333333;
            }

            .footer-note {
              margin-top: 40px;
              font-size: 14px;
              color: #888888;
              border-top: 1px solid #e0e0e0;
              padding-top: 20px;
            }

            @media screen and (max-width: 430px) {
              .email-container {
                padding: 15px !important;
              }

              .email-content {
                padding: 20px !important;
              }

              .email-content h2 {
                font-size: 20px !important;
              }

              .email-content p {
                font-size: 15px !important;
              }

              .action-button {
                padding: 12px 20px !important;
                font-size: 15px !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="email-content">
              <h2>🎉 Your KYC has been Approved!</h2>

              <p>Dear ${business.businessName || "Valued Partner"},</p>

              <p>
                Congratulations! Your business has been successfully verified and approved for the ${appName} marketplace. 
                Your account is now fully activated.
              </p>

              <div class="success-badge">✓ KYC Approved</div>

              <div class="business-info">
                <div class="business-info-item">
                  <span class="business-info-label">Business Name:</span>
                  <span>${business.businessName}</span>
                </div>
                <div class="business-info-item">
                  <span class="business-info-label">Approval Date:</span>
                  <span>${new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}</span>
                </div>
              </div>

              <p>
                You can now:
              </p>
              <ul style="color: #555555; line-height: 1.8;">
                <li>Access your marketplace store</li>
                <li>List and manage your products</li>
                <li>Process customer orders</li>
                <li>Track your sales and analytics</li>
                <li>Manage your business wallet and withdrawals</li>
              </ul>

              ${
                storeUrl
                  ? `
              <p>
                <a href="${storeUrl}" class="action-button">
                  View Your Store
                </a>
              </p>
              `
                  : ""
              }

              <p>
                If you have any questions or need assistance, please don't hesitate to contact our support team.
              </p>

              <div class="signature">
                <p>Best regards,<br />
                <strong>The ${appName} Team</strong></p>
              </div>

              <div class="footer-note">
                <p>This email was sent to ${business.businessEmail} as your registered business email.</p>
                <p>If you didn't expect this email or have concerns, please contact us immediately at support@sellsquarehub.com</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    await sendEmail(
      "Your KYC Has Been Approved - Sell Square",
      htmlContent,
      business.businessEmail,
      process.env.EMAIL_FROM
    );

    console.log(`[KYC Notification] Approval email sent to ${business.businessEmail}`);
  } catch (error) {
    console.error("[KYC Notification] Error sending approval email:", error);
  }
};

/**
 * Send KYC rejection email
 */
const sendKYCRejectionEmail = async (businessId, rejectionReason) => {
  try {
    const business = await Business.findById(businessId);
    if (!business || !business.businessEmail) {
      console.warn(`[KYC Notification] Business not found or no email for ID: ${businessId}`);
      return;
    }

    const appName = "Sell Square";

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>KYC Review - ${appName}</title>
          <style>
            @import url("https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap");

            body {
              margin: 0;
              padding: 0;
              background-color: #f6f6f6;
              font-family: 'Poppins', Arial, sans-serif;
            }

            .email-container {
              width: 100%;
              padding: 40px 20px;
              background-color: #f6f6f6;
              box-sizing: border-box;
            }

            .email-content {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 8px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.05);
              padding: 40px;
              box-sizing: border-box;
            }

            .email-content h2 {
              margin-top: 0;
              color: #d32f2f;
              font-weight: 600;
              font-size: 24px;
            }

            .email-content p {
              font-size: 16px;
              color: #555555;
              margin-bottom: 20px;
              line-height: 1.6;
            }

            .rejection-info {
              background-color: #ffebee;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              border-left: 4px solid #d32f2f;
            }

            .rejection-header {
              font-weight: 600;
              color: #d32f2f;
              font-size: 16px;
              margin-bottom: 10px;
            }

            .rejection-reason {
              color: #555555;
              font-size: 15px;
              line-height: 1.6;
            }

            .next-steps {
              background-color: #f9f9f9;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }

            .next-steps h3 {
              margin-top: 0;
              color: #295F2D;
              font-size: 16px;
              font-weight: 600;
            }

            .next-steps ul {
              margin: 15px 0;
              padding-left: 20px;
              color: #555555;
            }

            .next-steps li {
              margin: 10px 0;
              line-height: 1.6;
            }

            .signature {
              margin-top: 30px;
              font-size: 16px;
              color: #333333;
            }

            .footer-note {
              margin-top: 40px;
              font-size: 14px;
              color: #888888;
              border-top: 1px solid #e0e0e0;
              padding-top: 20px;
            }

            @media screen and (max-width: 430px) {
              .email-container {
                padding: 15px !important;
              }

              .email-content {
                padding: 20px !important;
              }

              .email-content h2 {
                font-size: 20px !important;
              }

              .email-content p {
                font-size: 15px !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="email-content">
              <h2>KYC Review - Further Information Needed</h2>

              <p>Dear ${business.businessName || "Valued Partner"},</p>

              <p>
                Thank you for submitting your business information for verification. Unfortunately, we were unable to 
                complete the approval at this time.
              </p>

              <div class="rejection-info">
                <div class="rejection-header">Reason for Review:</div>
                <div class="rejection-reason">
                  ${rejectionReason || "Your submission does not meet our current verification requirements."}
                </div>
              </div>

              <div class="next-steps">
                <h3>What You Can Do:</h3>
                <ul>
                  <li><strong>Review the feedback:</strong> Carefully read the reason provided above for any issues with your submission.</li>
                  <li><strong>Address the concerns:</strong> Make sure all required documents are accurate and complete.</li>
                  <li><strong>Resubmit:</strong> You can submit your KYC information again with the necessary corrections.</li>
                  <li><strong>Contact Support:</strong> If you have questions about the rejection, reach out to our support team.</li>
                </ul>
              </div>

              <p>
                We appreciate your interest in joining the ${appName} marketplace. We want to ensure that all our 
                partners meet our verification standards to maintain the integrity of our platform.
              </p>

              <p>
                If you believe this decision is in error or have further questions, please don't hesitate to contact us 
                at <strong>support@sellsquarehub.com</strong>.
              </p>

              <div class="signature">
                <p>Best regards,<br />
                <strong>The ${appName} Verification Team</strong></p>
              </div>

              <div class="footer-note">
                <p>This email was sent to ${business.businessEmail} as your registered business email.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    await sendEmail(
      "KYC Review - Further Information Needed - Sell Square",
      htmlContent,
      business.businessEmail,
      process.env.EMAIL_FROM
    );

    console.log(`[KYC Notification] Rejection email sent to ${business.businessEmail}`);
  } catch (error) {
    console.error("[KYC Notification] Error sending rejection email:", error);
  }
};

/**
 * Initialize KYC event listeners
 */
const initializeKYCNotifications = () => {
  console.log("[KYC Notification] Initializing KYC notification listeners...");

  eventBus.on("business_event", async (businessId, payload) => {
    try {
      // Only handle KYC events
      if (payload.eventType !== EventTypes.KYC_VERIFIED && payload.eventType !== EventTypes.KYC_REJECTED) {
        return;
      }

      // Normalize businessId
      const normalizedBusinessId = businessId?.toString ? businessId.toString() : String(businessId);

      const eventData = payload.data || {};

      if (payload.eventType === EventTypes.KYC_VERIFIED) {
        console.log(`[KYC Notification] KYC_VERIFIED event received for business: ${normalizedBusinessId}`);
        await sendKYCApprovalEmail(normalizedBusinessId, eventData);
      } else if (payload.eventType === EventTypes.KYC_REJECTED) {
        console.log(`[KYC Notification] KYC_REJECTED event received for business: ${normalizedBusinessId}`);
        await sendKYCRejectionEmail(normalizedBusinessId, eventData.rejectionReason);
      }
    } catch (error) {
      console.error("[KYC Notification] Error processing KYC event:", error);
    }
  });

  console.log("[KYC Notification] KYC notification listeners initialized successfully");
};

module.exports = {
  initializeKYCNotifications,
  sendKYCApprovalEmail,
  sendKYCRejectionEmail,
};
