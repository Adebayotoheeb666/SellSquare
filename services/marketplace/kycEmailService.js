const sendEmail = require("../../utils/sendEmail");

/**
 * Send KYC Approval Email
 * Notifies business owner that their KYC has been approved
 */
const sendKycApprovalEmail = async (business, businessKyc) => {
  try {
    const appName = "SellSquare";
    const recipientEmail = business.businessEmail || business.email;

    if (!recipientEmail) {
      console.warn(`No email found for business: ${business._id}`);
      return;
    }

    await sendEmail(
      `Your Business is Approved for SellSquare Marketplace - ${appName}`,
      {
        businessName: business.businessName,
        approvedAt: businessKyc.approvedAt,
      },
      recipientEmail,
      process.env.EMAIL_FROM || "noreply@sellsquare.io",
      null,
      {
        template: "kyc-approved",
        templateData: {
          appName,
          brandColor: "#295F2D",
        },
      }
    );

    console.log(`KYC approval email sent to ${recipientEmail}`);
  } catch (error) {
    console.error("Error sending KYC approval email:", error);
    // Don't throw - email failure shouldn't block KYC approval
  }
};

/**
 * Send KYC Rejection Email
 * Notifies business owner that their KYC was rejected with reason
 */
const sendKycRejectionEmail = async (business, businessKyc, rejectionReason) => {
  try {
    const appName = "SellSquare";
    const recipientEmail = business.businessEmail || business.email;

    if (!recipientEmail) {
      console.warn(`No email found for business: ${business._id}`);
      return;
    }

    await sendEmail(
      `KYC Submission Review Update - Action Required - ${appName}`,
      {
        businessName: business.businessName,
        rejectionReason: rejectionReason || "Your submission did not meet our requirements.",
      },
      recipientEmail,
      process.env.EMAIL_FROM || "noreply@sellsquare.io",
      null,
      {
        template: "kyc-rejected",
        templateData: {
          appName,
          brandColor: "#295F2D",
        },
      }
    );

    console.log(`KYC rejection email sent to ${recipientEmail}`);
  } catch (error) {
    console.error("Error sending KYC rejection email:", error);
    // Don't throw - email failure shouldn't block KYC rejection
  }
};

/**
 * Send Admin KYC Submission Notification
 * Notifies admin(s) that a new KYC submission is pending review
 */
const sendAdminKycNotification = async (business, businessKyc) => {
  try {
    const appName = "SellSquare";
    const adminEmails = process.env.ADMIN_EMAILS
      ? process.env.ADMIN_EMAILS.split(",").map((email) => email.trim())
      : [];

    if (!adminEmails || adminEmails.length === 0) {
      console.warn("No admin emails configured for KYC notifications");
      return;
    }

    const businessAddress =
      businessKyc.businessAddress && businessKyc.businessAddress.street
        ? `${businessKyc.businessAddress.street}, ${businessKyc.businessAddress.city}, ${businessKyc.businessAddress.state}, ${businessKyc.businessAddress.country}`
        : "Not provided";

    // Send to each admin
    for (const adminEmail of adminEmails) {
      await sendEmail(
        `[ADMIN] New KYC Submission Pending Review - ${business.businessName}`,
        {
          businessName: business.businessName,
          ownerFullName: businessKyc.ownerFullName,
          businessEmail: business.businessEmail || business.email,
          businessRegNumber: businessKyc.businessRegNumber,
          businessAddress,
          submittedAt: businessKyc.submittedAt,
        },
        adminEmail,
        process.env.EMAIL_FROM || "noreply@sellsquare.io",
        null,
        {
          template: "kyc-admin-notification",
          templateData: {
            appName,
            brandColor: "#295F2D",
          },
        }
      );
    }

    console.log(`KYC admin notification sent to ${adminEmails.length} admin(s)`);
  } catch (error) {
    console.error("Error sending KYC admin notification:", error);
    // Don't throw - email failure shouldn't block operations
  }
};

module.exports = {
  sendKycApprovalEmail,
  sendKycRejectionEmail,
  sendAdminKycNotification,
};
