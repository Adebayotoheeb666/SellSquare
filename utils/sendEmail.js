const formData = require("form-data");
const Mailgun = require("mailgun.js");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Initialize Mailgun
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY || "",
  url: process.env.MAILGUN_API_URL || "https://api.mailgun.net",
});

const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || "";

/**
 * Generate HTML email templates
 * @param {string} templateType - Type of template: 'password-reset', 'monthly-report', 'receipt', 'contact', 'generic'
 * @param {object} data - Template data
 * @returns {string} HTML string
 */
const generateEmailHTML = (templateType, data) => {
  const {
    appName = "Sell Square",
    brandColor = "#295F2D",
    logoURL = "https://res.cloudinary.com/dfrwntkjm/image/upload/v1743483597/White_background_wsidzo.png",
  } = data;

  const baseStyles = `
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

    .email-content h4 {
      margin-top: 0;
      color: ${brandColor};
      font-weight: 600;
      font-size: 20px;
    }

    .email-content p {
      font-size: 16px;
      color: #555555;
      margin-bottom: 20px;
    }

    .signature {
      margin-top: 30px;
      font-size: 16px;
      color: #333333;
    }

    @media screen and (max-width: 430px) {
      .email-container {
        padding: 15px !important;
      }

      .email-content {
        padding: 20px !important;
      }

      .email-content h4 {
        font-size: 18px !important;
      }

      .email-content p {
        font-size: 15px !important;
      }
    }
  `;

  switch (templateType) {
    case "password-reset":
      return `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <title>Reset Password</title>
            <style>
              ${baseStyles}

              .reset-button {
                display: inline-block;
                background-color: ${brandColor};
                color: #ffffff !important;
                padding: 14px 28px;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 500;
                font-size: 16px;
              }

              .footer-note {
                margin-top: 40px;
                font-size: 14px;
                color: #888888;
              }

              @media screen and (max-width: 430px) {
                .reset-button {
                  padding: 12px 20px !important;
                  font-size: 15px !important;
                }
              }
            </style>
          </head>
          <body>
            <div class="email-container">
              <div class="email-content">
                <h4>Hello ${data.recipientEmail},</h4>

                <p>
                  You recently requested to reset your password for your <strong>${appName} account</strong>. Click the button below to proceed. This link will expire in ${
        data.expiresIn || 5
      } minutes.
                </p>

                <a href="${
                  data.resetUrl
                }" class="reset-button" clicktracking="off">
                  Reset Password
                </a>

                <p class="footer-note">
                  If you didn't request this, you can safely ignore this email.
                </p>

                <p class="signature">
                  Regards,<br />
                  <strong>${appName} Team</strong>
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

    case "monthly-report":
      // For monthly reports, use the provided HTML directly (already formatted)
      return data.reportHTML;

    case "receipt":
      return `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <title>Purchase Receipt</title>
            <style>
              ${baseStyles}
            </style>
          </head>
          <body>
            <div class="email-container">
              <div class="email-content">
                <h4>Hello, ${data.recipientEmail}</h4>
                <p>
                  Thank you for your purchase at <strong>${data.businessName}</strong>! We have attached your receipt.
                </p>
                <p class="signature">
                  Regards,<br />
                  <strong>${data.businessName}</strong>
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

    case "contact":
      return `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <title>Contact Message</title>
            <style>
              ${baseStyles}

              .contact-header {
                background: linear-gradient(135deg, ${brandColor} 0%, #1e4620 100%);
                padding: 30px;
                text-align: center;
                border-radius: 8px 8px 0 0;
                margin: -40px -40px 30px -40px;
              }

              .contact-header h2 {
                color: #ffffff;
                margin: 0;
                font-size: 24px;
                font-weight: 600;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
              }

              .contact-header p {
                color: #e8f5e9;
                margin: 10px 0 0 0;
                font-size: 14px;
              }

              .header-icon {
                display: inline-block;
                width: 28px;
                height: 28px;
                vertical-align: middle;
              }

              .sender-info {
                background-color: #f0f8f1;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                border-left: 4px solid ${brandColor};
              }

              .sender-info-item {
                display: flex;
                align-items: center;
                margin-bottom: 12px;
              }

              .sender-info-item:last-child {
                margin-bottom: 0;
              }

              .info-icon {
                width: 18px;
                height: 18px;
                margin-right: 8px;
                flex-shrink: 0;
              }

              .sender-info-label {
                font-weight: 600;
                color: ${brandColor};
                min-width: 80px;
                font-size: 14px;
                display: flex;
                align-items: center;
              }

              .sender-info-value {
                color: #333333;
                font-size: 14px;
              }

              .message-section {
                margin: 30px 0;
              }

              .message-section h3 {
                color: ${brandColor};
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 15px;
                display: flex;
                align-items: center;
                gap: 8px;
              }

              .section-icon {
                width: 20px;
                height: 20px;
              }

              .message-content {
                background-color: #ffffff;
                padding: 25px;
                border: 2px solid #e8f5e9;
                border-radius: 8px;
                line-height: 1.8;
                color: #333333;
                font-size: 15px;
                white-space: pre-wrap;
                word-wrap: break-word;
              }

              .action-section {
                background-color: #f9f9f9;
                padding: 20px;
                border-radius: 8px;
                margin-top: 30px;
                text-align: center;
              }

              .action-section p {
                margin: 0 0 15px 0;
                color: #666666;
                font-size: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
              }

              .action-icon {
                width: 18px;
                height: 18px;
              }

              .reply-button {
                display: inline-block;
                background-color: ${brandColor};
                color: #ffffff;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                font-size: 15px;
                transition: background-color 0.3s ease;
              }

              .reply-button:hover {
                background-color: #1e4620;
              }

              .footer-note {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e0e0e0;
                text-align: center;
                color: #999999;
                font-size: 13px;
              }

              @media screen and (max-width: 430px) {
                .contact-header {
                  padding: 20px !important;
                  margin: -20px -20px 20px -20px !important;
                }

                .contact-header h2 {
                  font-size: 20px !important;
                }

                .sender-info {
                  padding: 15px !important;
                }

                .sender-info-item {
                  flex-direction: column;
                  align-items: flex-start;
                }

                .sender-info-label {
                  margin-bottom: 5px;
                }

                .message-content {
                  padding: 15px !important;
                  font-size: 14px !important;
                }
              }
            </style>
          </head>
          <body>
            <div class="email-container">
              <div class="email-content">
                <div class="contact-header">
                  <h2>
                    <svg class="header-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <polyline points="22,6 12,13 2,6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    New Contact Form Message
                  </h2>
                  <p>You have received a new message from your website</p>
                </div>

                <div class="sender-info">
                  <div class="sender-info-item">
                    <span class="sender-info-label">
                      <svg class="info-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="${brandColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="12" cy="7" r="4" stroke="${brandColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      From:
                    </span>
                    <span class="sender-info-value">${data.senderName}</span>
                  </div>
                  <div class="sender-info-item">
                    <span class="sender-info-label">
                      <svg class="info-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="${brandColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <polyline points="22,6 12,13 2,6" stroke="${brandColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      Email:
                    </span>
                    <span class="sender-info-value">${data.senderEmail}</span>
                  </div>
                  <div class="sender-info-item">
                    <span class="sender-info-label">
                      <svg class="info-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="${brandColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      Subject:
                    </span>
                    <span class="sender-info-value">${data.subject}</span>
                  </div>
                </div>

                <div class="message-section">
                  <h3>
                    <svg class="section-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="${brandColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <polyline points="14,2 14,8 20,8" stroke="${brandColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <line x1="16" y1="13" x2="8" y2="13" stroke="${brandColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <line x1="16" y1="17" x2="8" y2="17" stroke="${brandColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <polyline points="10,9 9,9 8,9" stroke="${brandColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Message Content:
                  </h3>
                  <div class="message-content">
                    ${data.messageContent}
                  </div>
                </div>

                <div class="action-section">
                  <p>
                    <svg class="action-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="#666666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M12 16v-4" stroke="#666666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M12 8h.01" stroke="#666666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    You can reply directly to this email to respond to the sender
                  </p>
                  <a href="mailto:${
                    data.senderEmail
                  }?subject=Re: ${encodeURIComponent(
        data.subject
      )}" class="reply-button">
                    Reply to ${data.senderName}
                  </a>
                </div>

                <div class="footer-note">
                  <p>This message was sent via the Contact Us form on ${appName}</p>
                  <p>Received on ${new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

    case "application-confirmation":
      const { senderName, position, messageContent } = data;
      return `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <title>Application Received - ${appName}</title>
            <style>
              ${baseStyles}

              .app-header {
                background: linear-gradient(135deg, #fff 0%, ${brandColor} 100%);
                padding: 40px 30px;
                text-align: center;
                border-radius: 8px 8px 0 0;
                margin: -40px -40px 30px -40px;
              }

              .app-header h2 {
                color: #ffffff;
                margin: 0;
                font-size: 26px;
                font-weight: 600;
              }

              .app-header p {
                color: #e8f5e9;
                margin: 10px 0 0 0;
                font-size: 15px;
              }

              .success-badge {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background-color: #e8f5e9;
                color: ${brandColor};
                padding: 12px 20px;
                border-radius: 50px;
                font-weight: 600;
                margin: 20px 0;
                font-size: 15px;
              }

              .check-icon {
                width: 24px;
                height: 24px;
                flex-shrink: 0;
              }

              .position-box {
                background: #f0f8f1;
                padding: 16px 20px;
                border-left: 4px solid ${brandColor};
                border-radius: 4px;
                margin: 20px 0;
              }

              .position-box strong {
                color: ${brandColor};
                font-size: 18px;
              }

              .next-steps {
                background: #f9f9f9;
                padding: 24px;
                border-radius: 8px;
                margin: 30px 0;
              }

              .next-steps h3 {
                margin-top: 0;
                color: ${brandColor};
                font-size: 18px;
              }

              .next-steps ul {
                padding-left: 20px;
                margin: 15px 0;
              }

              .next-steps li {
                margin: 10px 0;
                color: #555;
                line-height: 1.6;
              }
            </style>
          </head>
          <body>
            <div class="email-container">
              <div class="email-content">
                <div class="app-header">
                  <h2>🎉 Application Received!</h2>
                  <p>Thank you for your interest in joining ${appName}</p>
                </div>

                <p>Hi <strong>${senderName}</strong>,</p>

                <p>${
                  messageContent ||
                  `Thank you for applying for the ${position} role at ${appName}! We've received your application and our team is excited to review it.`
                }</p>

                <div class="position-box">
                  <strong>Position: ${position}</strong>
                </div>

                <div class="next-steps">
                  <h3>What happens next?</h3>
                  <ul>
                    <li><strong>Application Review:</strong> Our team will carefully review your CV, cover letter, and portfolio within 5-7 business days.</li>
                    <li><strong>Initial Screening:</strong> If your profile matches what we're looking for, we'll reach out to schedule a brief call.</li>
                    <li><strong>Assessment:</strong> Selected candidates will receive a short creative brief to showcase their skills.</li>
                    <li><strong>Final Interview:</strong> Top candidates will meet with our growth lead and team members.</li>
                  </ul>
                </div>

                <p>We receive many applications, so if you don't hear from us within 2 weeks, it means we've decided to move forward with other candidates for this round. However, we'll keep your application on file for future opportunities!</p>

                <p>In the meantime, feel free to:</p>
                <ul>
                  <li>Check out our latest campaigns on social media</li>
                  <li>Read our blog to learn more about our marketing approach</li>
                  <li>Connect with us on LinkedIn</li>
                </ul>

                <div class="signature">
                  <p>Best regards,<br />
                  <strong>The ${appName} Careers Team</strong></p>
                </div>

                <p style="font-size: 13px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                  This is an automated confirmation email. If you have any questions, please reply to this email or contact us at careers@sellsquarehub.com
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

    case "application-notification":
      const {
        applicantName,
        applicantEmail,
        applicantPhone,
        portfolioUrl,
        message,
        cvFileName,
        coverLetterFileName,
      } = data;
      return `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <title>New Application Received - ${data.position}</title>
            <style>
              ${baseStyles}

              .admin-header {
                background: linear-gradient(135deg, #fff 0%, ${brandColor} 100%);
                padding: 30px;
                text-align: center;
                border-radius: 8px 8px 0 0;
                margin: -40px -40px 30px -40px;
              }

              .admin-header h2 {
                color: #ffffff;
                margin: 0;
                font-size: 24px;
                font-weight: 600;
              }

              .admin-header p {
                color: #e8f5e9;
                margin: 10px 0 0 0;
              }

              .alert-badge {
                display: inline-block;
                background: #ff9800;
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: 600;
                font-size: 13px;
                margin-bottom: 20px;
              }

              .info-grid {
                display: grid;
                grid-template-columns: 140px 1fr;
                gap: 12px;
                margin: 20px 0;
                padding: 20px;
                background: #f9f9f9;
                border-radius: 8px;
              }

              .info-label {
                font-weight: 600;
                color: #666;
              }

              .info-value {
                color: #333;
              }

              .info-value a {
                color: ${brandColor};
                text-decoration: none;
              }

              .files-section {
                background: #e8f5e9;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
              }

              .files-section h3 {
                margin-top: 0;
                color: ${brandColor};
                font-size: 16px;
              }

              .file-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px;
                background: white;
                border-radius: 6px;
                margin: 8px 0;
              }

              .file-icon {
                width: 32px;
                height: 32px;
                background: ${brandColor};
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
              }

              .message-box {
                background: #fff9e6;
                border-left: 4px solid #ffc107;
                padding: 16px 20px;
                border-radius: 4px;
                margin: 20px 0;
              }

              .message-box h3 {
                margin-top: 0;
                color: #f57c00;
                font-size: 16px;
              }

              .action-button {
                display: inline-block;
                background: ${brandColor};
                color: white;
                padding: 12px 24px;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 600;
                margin-top: 20px;
              }
            </style>
          </head>
          <body>
            <div class="email-container">
              <div class="email-content">
                <div class="admin-header">
                  <h2>📬 New Internship Application</h2>
                  <p>A candidate has applied for ${data.position}</p>
                </div>

                <div class="alert-badge">⚡ New Application</div>

                <h3>Applicant Information</h3>

                <div class="info-grid">
                  <div class="info-label">Name:</div>
                  <div class="info-value"><strong>${applicantName}</strong></div>

                  <div class="info-label">Email:</div>
                  <div class="info-value"><a href="mailto:${applicantEmail}">${applicantEmail}</a></div>

                  <div class="info-label">Phone:</div>
                  <div class="info-value">${applicantPhone}</div>

                  <div class="info-label">Position:</div>
                  <div class="info-value"><strong>${
                    data.position
                  }</strong></div>

                  <div class="info-label">Portfolio:</div>
                  <div class="info-value">${
                    portfolioUrl
                      ? `<a href="${portfolioUrl}" target="_blank">${portfolioUrl}</a>`
                      : "Not provided"
                  }</div>
                </div>

                <div class="files-section">
                  <h3>📎 Attached Documents</h3>
                  <div class="file-item">
                    <div class="file-icon">CV</div>
                    <div>
                      <strong>Curriculum Vitae</strong><br>
                      <span style="font-size: 13px; color: #666;">${cvFileName}</span>
                    </div>
                  </div>
                  <div class="file-item">
                    <div class="file-icon">CL</div>
                    <div>
                      <strong>Cover Letter</strong><br>
                      <span style="font-size: 13px; color: #666;">${coverLetterFileName}</span>
                    </div>
                  </div>
                </div>

                ${
                  message
                    ? `
                <div class="message-box">
                  <h3>💬 Additional Message</h3>
                  <p style="margin: 10px 0 0 0; color: #555; white-space: pre-wrap;">${message}</p>
                </div>
                `
                    : ""
                }

                <p style="margin-top: 30px;">Please review the application and attached documents. The applicant has been sent a confirmation email.</p>

                <div style="text-align: center; margin-top: 30px;">
                  <a href="mailto:${applicantEmail}?subject=Re: Your Application for ${
        data.position
      }" class="action-button">Reply to Applicant</a>
                </div>

                <p style="font-size: 13px; color: #999; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
                  This notification was sent from the ${appName} careers portal. Application received on ${new Date().toLocaleDateString(
        "en-US",
        { year: "numeric", month: "long", day: "numeric" }
      )}.
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

    case "application-confirmation":
      const {
        senderName: appSenderName,
        position: appPosition,
        messageContent: appMessage,
      } = data;
      return `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <title>Application Received - ${appName}</title>
            <style>
              ${baseStyles}

              .app-header {
                background: linear-gradient(135deg, #fff 0%, ${brandColor} 100%);
                padding: 40px 30px;
                text-align: center;
                border-radius: 8px 8px 0 0;
                margin: -40px -40px 30px -40px;
              }

              .app-header h2 {
                color: #ffffff;
                margin: 0;
                font-size: 26px;
                font-weight: 600;
              }

              .app-header p {
                color: #e8f5e9;
                margin: 10px 0 0 0;
                font-size: 15px;
              }

              .success-badge {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background-color: #e8f5e9;
                color: ${brandColor};
                padding: 12px 20px;
                border-radius: 50px;
                font-weight: 600;
                margin: 20px 0;
                font-size: 15px;
              }

              .check-icon {
                width: 28px;
                height: 28px;
                background: ${brandColor};
                border-radius: 50%;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: #ffffff;
                font-weight: 700;
                margin: 0 6px 0 0;
                line-height: 1;
                font-size: 15px;
              }

              .position-box {
                background: #f0f8f1;
                padding: 16px 20px;
                border-left: 4px solid ${brandColor};
                border-radius: 4px;
                margin: 20px 0;
              }

              .position-box strong {
                color: ${brandColor};
                font-size: 18px;
              }

              .next-steps {
                background: #f9f9f9;
                padding: 24px;
                border-radius: 8px;
                margin: 30px 0;
              }

              .next-steps h3 {
                margin-top: 0;
                color: ${brandColor};
                font-size: 18px;
              }

              .next-steps ul {
                padding-left: 20px;
                margin: 15px 0;
              }

              .next-steps li {
                margin: 10px 0;
                color: #555;
                line-height: 1.6;
              }
            </style>
          </head>
          <body>
            <div class="email-container">
              <div class="email-content">
                <div class="app-header">
                  <h2>🎉 Application Received!</h2>
                  <p>Thank you for your interest in joining ${appName}</p>
                </div>

                <div class="success-badge">
                  <span class="check-icon">✓</span>
                  <span>Your application has been successfully submitted</span>
                </div>

                <p>Hi <strong>${appSenderName}</strong>,</p>

                <p>${
                  appMessage ||
                  `Thank you for applying for the ${appPosition} role at ${appName}! We've received your application and our team is excited to review it.`
                }</p>

                <div class="position-box">
                  <strong>Position: ${appPosition}</strong>
                </div>

                <div class="next-steps">
                  <h3>What happens next?</h3>
                  <ul>
                    <li><strong>Application Review:</strong> Our team will carefully review your CV, cover letter, and portfolio within 5-7 business days.</li>
                    <li><strong>Initial Screening:</strong> If your profile matches what we're looking for, we'll reach out to schedule a brief call.</li>
                    <li><strong>Assessment:</strong> Selected candidates will receive a short creative brief to showcase their skills.</li>
                    <li><strong>Final Interview:</strong> Top candidates will meet with our growth lead and team members.</li>
                  </ul>
                </div>

                <p>We receive many applications, so if you don't hear from us within 2 weeks, it means we've decided to move forward with other candidates for this round. However, we'll keep your application on file for future opportunities!</p>

                <p>In the meantime, feel free to:</p>
                <ul>
                  <li>Check out our latest campaigns on social media</li>
                  <li>Read our blog to learn more about our marketing approach</li>
                  <li>Connect with us on LinkedIn</li>
                </ul>

                <div class="signature">
                  <p>Best regards,<br />
                  <strong>The ${appName} Careers Team</strong></p>
                </div>

                <p style="font-size: 13px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                  This is an automated confirmation email. If you have any questions, please reply to this email or contact us at careers@sellsquarehub.com
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

    case "kyc-approved":
      return `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <title>Marketplace Approval - ${appName}</title>
            <style>
              ${baseStyles}

              .success-header {
                background: linear-gradient(135deg, ${brandColor} 0%, #1e4620 100%);
                padding: 40px 30px;
                text-align: center;
                border-radius: 8px 8px 0 0;
                margin: -40px -40px 30px -40px;
              }

              .success-header h2 {
                color: #ffffff;
                margin: 0;
                font-size: 26px;
                font-weight: 600;
              }

              .success-icon {
                width: 60px;
                height: 60px;
                margin: 0 auto 20px;
                background-color: rgba(255,255,255,0.2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
              }

              .success-checkmark {
                width: 35px;
                height: 35px;
                color: #ffffff;
              }

              .next-steps {
                background-color: #f0f8f1;
                border-left: 4px solid ${brandColor};
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
              }

              .next-steps h3 {
                color: ${brandColor};
                margin-top: 0;
                font-size: 18px;
              }

              .next-steps ol {
                margin: 15px 0;
                padding-left: 25px;
              }

              .next-steps li {
                margin-bottom: 12px;
                color: #333333;
                line-height: 1.6;
              }

              .action-button {
                display: inline-block;
                background-color: ${brandColor};
                color: #ffffff !important;
                padding: 14px 32px;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 600;
                font-size: 16px;
                margin-top: 20px;
              }

              @media screen and (max-width: 430px) {
                .success-header {
                  padding: 20px !important;
                }

                .success-header h2 {
                  font-size: 22px !important;
                }

                .action-button {
                  display: block;
                  text-align: center;
                }
              }
            </style>
          </head>
          <body>
            <div class="email-container">
              <div class="email-content">
                <div class="success-header">
                  <div class="success-icon">
                    <svg class="success-checkmark" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <h2>Your Business is Approved!</h2>
                  <p style="color: #e8f5e9; margin: 10px 0 0 0;">Welcome to the SellSquare Marketplace</p>
                </div>

                <p>Dear <strong>${data.businessName}</strong>,</p>

                <p>Great news! Your KYC submission has been reviewed and <strong>approved</strong>. Your business is now eligible to list products on the SellSquare Marketplace.</p>

                <div class="next-steps">
                  <h3>Next Steps:</h3>
                  <ol>
                    <li>Log in to your business dashboard</li>
                    <li>Navigate to <strong>Marketplace → Setup</strong></li>
                    <li>Click <strong>"Generate Store Link"</strong> to create your unique store URL</li>
                    <li>Share your store link with customers to start selling!</li>
                    <li>Monitor your <strong>Marketplace → Orders</strong> for incoming customer orders</li>
                  </ol>
                </div>

                <p>Your business can now accept payments through the marketplace and manage orders directly from your dashboard. Customers can discover your products and make purchases 24/7.</p>

                <p>If you have any questions or need assistance, please don't hesitate to reach out to our support team.</p>

                <a href="${process.env.CLIENT_URL || "https://app.sellsquare.io"}/marketplace/setup" class="action-button">
                  Go to Marketplace Setup
                </a>

                <p class="signature">
                  Best regards,<br />
                  <strong>${appName} Team</strong>
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

    case "kyc-rejected":
      return `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <title>KYC Review Update - ${appName}</title>
            <style>
              ${baseStyles}

              .alert-header {
                background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%);
                padding: 40px 30px;
                text-align: center;
                border-radius: 8px 8px 0 0;
                margin: -40px -40px 30px -40px;
              }

              .alert-header h2 {
                color: #ffffff;
                margin: 0;
                font-size: 26px;
                font-weight: 600;
              }

              .alert-icon {
                width: 60px;
                height: 60px;
                margin: 0 auto 20px;
                background-color: rgba(255,255,255,0.2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
              }

              .alert-symbol {
                width: 35px;
                height: 35px;
                color: #ffffff;
              }

              .reason-box {
                background-color: #fff3f1;
                border-left: 4px solid #d32f2f;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
              }

              .reason-label {
                color: #d32f2f;
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 8px;
              }

              .reason-content {
                color: #333333;
                line-height: 1.6;
                font-size: 15px;
              }

              .resubmit-section {
                background-color: #f5f5f5;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
              }

              .resubmit-section h3 {
                color: ${brandColor};
                margin-top: 0;
                font-size: 18px;
              }

              .resubmit-steps {
                margin: 15px 0;
                padding-left: 25px;
              }

              .resubmit-steps li {
                margin-bottom: 10px;
                color: #333333;
              }

              .action-button {
                display: inline-block;
                background-color: ${brandColor};
                color: #ffffff !important;
                padding: 14px 32px;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 600;
                font-size: 16px;
                margin-top: 20px;
              }

              @media screen and (max-width: 430px) {
                .alert-header {
                  padding: 20px !important;
                }

                .alert-header h2 {
                  font-size: 22px !important;
                }

                .action-button {
                  display: block;
                  text-align: center;
                }
              }
            </style>
          </head>
          <body>
            <div class="email-container">
              <div class="email-content">
                <div class="alert-header">
                  <div class="alert-icon">
                    <svg class="alert-symbol" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                      <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                  </div>
                  <h2>KYC Submission Review</h2>
                  <p style="color: #ffebee; margin: 10px 0 0 0;">Your submission needs revision</p>
                </div>

                <p>Dear <strong>${data.businessName}</strong>,</p>

                <p>Thank you for submitting your KYC documentation. After careful review, we are unable to approve your application at this time.</p>

                <div class="reason-box">
                  <div class="reason-label">REASON FOR REJECTION:</div>
                  <div class="reason-content">${data.rejectionReason}</div>
                </div>

                <div class="resubmit-section">
                  <h3>What You Can Do Next:</h3>
                  <ol class="resubmit-steps">
                    <li>Review the rejection reason provided above</li>
                    <li>Gather the required corrected documents or information</li>
                    <li>Log in to your dashboard and go to <strong>Marketplace → Setup</strong></li>
                    <li>Click <strong>"Resubmit KYC"</strong> with the corrected information</li>
                    <li>Our team will review your resubmission within 2-3 business days</li>
                  </ol>
                </div>

                <p>We're here to help! If you have questions about what was rejected or how to address the issues, please reach out to our support team at <strong>support@sellsquare.io</strong>.</p>

                <a href="${process.env.CLIENT_URL || "https://app.sellsquare.io"}/marketplace/setup" class="action-button">
                  Resubmit Your KYC
                </a>

                <p class="signature">
                  Best regards,<br />
                  <strong>${appName} Team</strong>
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

    case "kyc-admin-notification":
      return `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <title>New KYC Submission - ${appName}</title>
            <style>
              ${baseStyles}

              .admin-header {
                background: linear-gradient(135deg, ${brandColor} 0%, #1e4620 100%);
                padding: 40px 30px;
                text-align: center;
                border-radius: 8px 8px 0 0;
                margin: -40px -40px 30px -40px;
              }

              .admin-header h2 {
                color: #ffffff;
                margin: 0;
                font-size: 24px;
                font-weight: 600;
              }

              .submission-details {
                background-color: #f5f5f5;
                border-left: 4px solid ${brandColor};
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
              }

              .detail-row {
                display: flex;
                margin-bottom: 12px;
                align-items: flex-start;
              }

              .detail-label {
                font-weight: 600;
                color: ${brandColor};
                min-width: 140px;
              }

              .detail-value {
                color: #333333;
                flex-grow: 1;
              }

              .action-button {
                display: inline-block;
                background-color: ${brandColor};
                color: #ffffff !important;
                padding: 14px 32px;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 600;
                font-size: 16px;
                margin-top: 20px;
              }

              .badge {
                display: inline-block;
                background-color: #fff3f1;
                color: #d32f2f;
                padding: 6px 12px;
                border-radius: 4px;
                font-size: 13px;
                font-weight: 600;
              }

              @media screen and (max-width: 430px) {
                .admin-header {
                  padding: 20px !important;
                }

                .detail-row {
                  flex-direction: column;
                }

                .detail-label {
                  margin-bottom: 4px;
                }

                .action-button {
                  display: block;
                  text-align: center;
                }
              }
            </style>
          </head>
          <body>
            <div class="email-container">
              <div class="email-content">
                <div class="admin-header">
                  <h2>New KYC Submission Pending Review</h2>
                  <p style="color: #e8f5e9; margin: 10px 0 0 0;">Action Required</p>
                </div>

                <p>A new KYC submission requires your review:</p>

                <div class="submission-details">
                  <div class="detail-row">
                    <div class="detail-label">Business Name:</div>
                    <div class="detail-value"><strong>${data.businessName}</strong></div>
                  </div>
                  <div class="detail-row">
                    <div class="detail-label">Owner Name:</div>
                    <div class="detail-value">${data.ownerFullName}</div>
                  </div>
                  <div class="detail-row">
                    <div class="detail-label">Business Email:</div>
                    <div class="detail-value">${data.businessEmail}</div>
                  </div>
                  <div class="detail-row">
                    <div class="detail-label">Registration Number:</div>
                    <div class="detail-value">${data.businessRegNumber}</div>
                  </div>
                  <div class="detail-row">
                    <div class="detail-label">Business Address:</div>
                    <div class="detail-value">${data.businessAddress}</div>
                  </div>
                  <div class="detail-row">
                    <div class="detail-label">Submission Date:</div>
                    <div class="detail-value">${new Date(data.submittedAt).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
                  </div>
                  <div class="detail-row">
                    <div class="detail-label">Status:</div>
                    <div class="detail-value"><span class="badge">PENDING REVIEW</span></div>
                  </div>
                </div>

                <p>Please log in to the admin dashboard to review the submitted documents and make an approval/rejection decision.</p>

                <a href="${process.env.CLIENT_URL || "https://app.sellsquare.io"}/marketplace/admin/kyc" class="action-button">
                  Review Submission
                </a>

                <p class="signature">
                  Best regards,<br />
                  <strong>${appName} System</strong>
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

    case "generic":
    default:
      // For custom HTML emails, keep backward-compatible passthrough.
      return (
        data.htmlContent ||
        `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <title>${data.subject || "Email"}</title>
            <style>
              ${baseStyles}

              .generic-shell {
                border: 1px solid #e5ebe6;
                border-radius: 12px;
                overflow: hidden;
              }

              .generic-header {
                background: linear-gradient(135deg, ${brandColor} 0%, #1f4b23 100%);
                color: #ffffff;
                padding: 24px;
                text-align: left;
              }

              .generic-logo-wrap {
                display: inline-flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 14px;
              }

              .generic-logo {
                width: 42px;
                height: 42px;
                object-fit: contain;
                border-radius: 8px;
                background: #ffffff;
                padding: 5px;
              }

              .generic-brand {
                font-size: 16px;
                font-weight: 700;
                letter-spacing: 0.3px;
              }

              .generic-header h2 {
                margin: 0;
                font-size: 22px;
                line-height: 1.3;
                font-weight: 700;
                color: #ffffff;
              }

              .generic-header p {
                margin: 8px 0 0 0;
                color: #e8f3ea;
                font-size: 14px;
              }

              .generic-body {
                padding: 24px;
                background: #ffffff;
              }

              .generic-message {
                border: 1px solid #e6ede7;
                border-left: 4px solid ${brandColor};
                border-radius: 10px;
                padding: 16px;
                color: #2b3c2f;
                line-height: 1.7;
                font-size: 15px;
                white-space: pre-wrap;
              }

              .generic-footer {
                padding: 18px 24px 24px;
                border-top: 1px solid #edf2ee;
                color: #6a776d;
                font-size: 12px;
                background: #fbfcfb;
              }

              .generic-meta {
                margin-top: 8px;
                color: #839086;
              }

              @media screen and (max-width: 430px) {
                .generic-header {
                  padding: 18px !important;
                }

                .generic-header h2 {
                  font-size: 18px !important;
                }

                .generic-body {
                  padding: 16px !important;
                }

                .generic-message {
                  font-size: 14px !important;
                  padding: 12px !important;
                }

                .generic-footer {
                  padding: 14px 16px 18px !important;
                }
              }
            </style>
          </head>
          <body>
            <div class="email-container">
              <div class="email-content">
                <div class="generic-body">
                  <div class="generic-message">${data.messageContent || ""}</div>
                  <p class="signature">
                    Regards,<br />
                    <strong>${appName} Team</strong>
                  </p>
                </div>
                <div class="generic-footer">
                  <div>This email was sent to you as part of your SellSquare business account communication.</div>
                  <div class="generic-meta">If you believe this was sent in error, please contact support at info@sellsquarehub.com.</div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `
      );
  }
};

/**
 * Download file from URL
 */
const downloadFile = async (fileUrl, outputPath) => {
  const writer = fs.createWriteStream(outputPath);

  const response = await axios({
    url: fileUrl,
    method: "GET",
    responseType: "stream",
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
};

/**
 * Send email using Mailgun
 * @param {string} subject - Email subject
 * @param {string|object} message - HTML message string or template data object
 * @param {string} send_to - Recipient email
 * @param {string} sent_from - Sender email
 * @param {string} reply_to - Reply-to email (optional)
 * @param {object} options - Additional options (template, templateData)
 */
const sendEmail = async (
  subject,
  message,
  send_to,
  sent_from,
  reply_to = null,
  options = {}
) => {
  try {
    // Determine if message is template data or HTML string
    let htmlContent;

    if (options.template) {
      // Use template system
      const templateData =
        typeof message === "object" ? message : { messageContent: message };
      htmlContent = generateEmailHTML(options.template, {
        ...templateData,
        ...options.templateData,
      });
    } else if (typeof message === "string") {
      // Direct HTML string (backward compatible)
      htmlContent = message;
    } else {
      // Object without template - use generic template
      htmlContent = generateEmailHTML("generic", message);
    }

    const messageData = {
      from: process.env.EMAIL_FROM,
      to: send_to,
      subject: subject,
      html: htmlContent,
    };

    if (reply_to) {
      messageData["h:Reply-To"] = reply_to;
    }

    await mg.messages.create(MAILGUN_DOMAIN, messageData);
    console.log("Email sent successfully via Mailgun");
  } catch (error) {
    console.error("Mailgun send error:", error);
    throw error;
  }
};

/**
 * Send email with attachment using Mailgun
 */
const sendEmailWithAttachment = async (
  subject,
  message,
  send_to,
  sent_from,
  reply_to,
  attachments = []
) => {
  try {
    const messageData = {
      from: process.env.EMAIL_FROM,
      to: send_to,
      subject: subject,
      html: message,
    };

    if (reply_to) {
      messageData["h:Reply-To"] = reply_to;
    }

    // Download and attach files
    const attachmentPromises = attachments.map(async (attachment) => {
      const { filename, path: fileUrl, contentType } = attachment;
      const tempPath = path.join(__dirname, `../temp_${filename}`);

      // Download file
      await downloadFile(fileUrl, tempPath);

      // Read file as buffer
      const fileBuffer = fs.readFileSync(tempPath);

      // Clean up temp file
      fs.unlinkSync(tempPath);

      return {
        filename,
        data: fileBuffer,
        contentType,
      };
    });

    const attachmentData = await Promise.all(attachmentPromises);

    // Add attachments to message
    messageData.attachment = attachmentData;

    await mg.messages.create(MAILGUN_DOMAIN, messageData);
    console.log("Email with attachment sent successfully via Mailgun");
  } catch (error) {
    console.error("Mailgun send with attachment error:", error);
    throw error;
  }
};

/**
 * Send monthly report via email using Mailgun
 */
const sendMonthlyReportViaEmail = async (
  subject,
  message,
  send_to,
  sent_from
) => {
  try {
    const messageData = {
      from: process.env.EMAIL_FROM,
      to: send_to,
      subject: subject,
      html: message,
    };

    await mg.messages.create(MAILGUN_DOMAIN, messageData);
    console.log("Monthly report email sent successfully via Mailgun");
  } catch (error) {
    console.error("Mailgun send monthly report error:", error);
    throw error;
  }
};

module.exports = {
  sendEmail,
  sendEmailWithAttachment,
  sendMonthlyReportViaEmail,
};
