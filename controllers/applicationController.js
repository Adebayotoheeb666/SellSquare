const asyncHandler = require("express-async-handler");
const Application = require("../models/applicationModel");
const BriefAssignment = require("../models/briefAssignmentModel");
const { sendEmail, sendEmailWithAttachment } = require("../utils/sendEmail");
const { uploadFile } = require("../utils/s3bucket");
const { hasAdminBusinessAccess } = require("../utils/adminAccess");
const logActivity = require("../middleWare/logActivityMiddleware");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const BRIEF_QUESTIONS = [
  "Draft a 1-week campaign concept for SellSquare (objective: drive internship applications).",
  "Pick two channels (eg. Instagram + Email) and outline what you would ship on each day.",
  "List 3 metrics you will track and how you'll measure success.",
  "Share any links to past work or mock assets (optional).",
];

const submitApplication = asyncHandler(async (req, res) => {
  const { fullName, email, phone, position, portfolioUrl, message } = req.body;

  // Validation
  if (!fullName || !email || !phone || !position) {
    res.status(400);
    throw new Error(
      "Please provide all required fields: name, email, phone, and position"
    );
  }

  const cvFile = req.files?.cv?.[0];
  const coverLetterFile = req.files?.coverLetter?.[0];

  if (!cvFile || !coverLetterFile) {
    res.status(400);
    throw new Error("Please upload both CV and Cover Letter");
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400);
    throw new Error("Please provide a valid email address");
  }

  // Validate phone
  const phoneRegex = /^[0-9+\-\s()]{7,}$/;
  if (!phoneRegex.test(phone)) {
    res.status(400);
    throw new Error("Please provide a valid phone number");
  }

  try {
    // Upload files to S3
    const cvUploadResult = await uploadFile(cvFile.path);
    const coverLetterUploadResult = await uploadFile(coverLetterFile.path);

    // Delete local files after successful S3 upload
    fs.unlinkSync(cvFile.path);
    fs.unlinkSync(coverLetterFile.path);

    // Save application to database with S3 URLs
    const application = new Application({
      fullName,
      email,
      phone,
      position,
      portfolioUrl: portfolioUrl || "",
      message: message || "",
      cvFileName: cvFile.originalname,
      cvPath: cvUploadResult.fileUrl,
      coverLetterFileName: coverLetterFile.originalname,
      coverLetterPath: coverLetterUploadResult.fileUrl,
    });

    await application.save();

    // Send confirmation email to applicant
    const send_to = email;
    const sent_from = process.env.EMAIL_FROM;
    const reply_to = "careers@sellsquarehub.com";

    try {
      await sendEmail(
        `Application Received - SellSquare Marketing Internship`,
        {
          senderName: fullName,
          position: position,
          messageContent: `Thank you for applying for the ${position} role at SellSquare! We've received your application and will review it shortly. We'll get back to you within 5-7 business days.\n\nBest regards,\nThe SellSquare Team`,
        },
        send_to,
        sent_from,
        reply_to,
        { template: "application-confirmation" }
      );
    } catch (emailError) {
      console.error("Error sending confirmation email:", emailError);
      // Don't fail the whole request if email fails
    }

    // Note: This function doesn't have req.business context (it's public),
    // so activity logging is skipped here as it's not part of the business automation
    res.status(201).json({
      success: true,
      message:
        "Application submitted successfully! Check your email for confirmation.",
      applicationId: application._id,
    });
  } catch (error) {
    console.error("Application submission error:", error);
    res.status(500);
    throw new Error("Failed to submit application. Please try again later.");
  }
});

const getApplications = asyncHandler(async (req, res) => {
  try {
    const isAdmin = hasAdminBusinessAccess(req.business);
    console.log("Is Admin:", isAdmin);
    console.log("Request Business ID:", req.business ? req.business.id : "N/A");

    if (!isAdmin) {
      return res.status(403).send({
        message: "Access Denied by admin.",
      });
    }

    const applications = await Application.find()
      .sort({ appliedAt: -1 })
      .select(
        "fullName email phone position portfolioUrl message status appliedAt cvFileName cvPath coverLetterFileName coverLetterPath createdAt"
      )
      .lean();

    const applicationIds = applications.map((app) => app._id);
    const briefs = await BriefAssignment.find({
      application: { $in: applicationIds },
    })
      .sort({ createdAt: -1 })
      .lean();

    const latestBriefByApp = briefs.reduce((acc, brief) => {
      if (!acc[brief.application]) {
        acc[brief.application] = {
          status: brief.status,
          sentAt: brief.createdAt,
          submittedAt: brief.submittedAt || null,
          responses: brief.responses || null,
          dueDate: brief.dueDate || null,
          instructions: brief.instructions || "",
        };
      }
      return acc;
    }, {});

    const withBriefs = applications.map((app) => ({
      ...app,
      latestBrief: latestBriefByApp[app._id] || null,
    }));

    res.status(200).json({
      success: true,
      count: withBriefs.length,
      data: withBriefs,
    });
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500);
    throw new Error("Failed to fetch applications");
  }
});

const getApplicationById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const application = await Application.findById(id);

    if (!application) {
      res.status(404);
      throw new Error("Application not found");
    }

    res.status(200).json({
      success: true,
      data: application,
    });
  } catch (error) {
    console.error("Error fetching application:", error);
    res.status(error.status || 500);
    throw error;
  }
});

const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    res.status(400);
    throw new Error("Status is required");
  }

  const validStatuses = [
    "received",
    "reviewing",
    "interview",
    "rejected",
    "accepted",
  ];
  if (!validStatuses.includes(status)) {
    res.status(400);
    throw new Error(
      `Invalid status. Must be one of: ${validStatuses.join(", ")}`
    );
  }

  try {
    const application = await Application.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!application) {
      res.status(404);
      throw new Error("Application not found");
    }

    logActivity(`Updated application status for "${application.fullName}" to "${status}"`)(req, res);

    res.status(200).json({
      success: true,
      message: "Application status updated successfully",
      data: application,
    });
  } catch (error) {
    console.error("Error updating application:", error);
    res.status(error.status || 500);
    throw error;
  }
});

const sendBriefToApplicant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { instructions, dueDate } = req.body;

  const application = await Application.findById(id);
  if (!application) {
    res.status(404);
    throw new Error("Application not found");
  }

  const token = crypto.randomBytes(20).toString("hex");
  const briefLink = `${
    process.env.FRONTEND_URL || "https://www.sellsquarehub.com"
  }/marketing-interns/brief/${token}`;

  const brief = await BriefAssignment.create({
    application: application._id,
    token,
    instructions: instructions || "",
    dueDate: dueDate ? new Date(dueDate) : undefined,
  });

  const send_to = application.email;
  const sent_from = process.env.EMAIL_FROM;
  const reply_to = "careers@sellsquarehub.com";

  const html = `
    <p>Hi ${application.fullName.split(" ")[0]},</p>
    <p>Thanks for applying for the <strong>${
      application.position
    }</strong> internship. Please complete this short brief so we can review your thinking.</p>
    ${
      instructions
        ? `<p><strong>Notes from the team:</strong><br/>${instructions}</p>`
        : ""
    }
    ${
      dueDate
        ? `<p><strong>Due date:</strong> ${new Date(
            dueDate
          ).toDateString()}</p>`
        : ""
    }
    <p><a href="${briefLink}" style="display:inline-block;padding:12px 18px;background:#295F2D;color:#fff;text-decoration:none;border-radius:6px;">Open the brief</a></p>
    <p>If the button does not work, paste this link in your browser:<br/>${briefLink}</p>
    <hr/>
    <p><strong>What we will ask:</strong></p>
    <ol>
      ${BRIEF_QUESTIONS.map((q) => `<li>${q}</li>`).join("")}
    </ol>
    <p>We review submissions on a rolling basis.</p>
  `;

  await sendEmail(
    `Complete a short brief - SellSquare`,
    html,
    send_to,
    sent_from,
    reply_to
  );

  logActivity(`Sent brief to applicant "${application.fullName}" for position "${application.position}"`)(req, res);

  res.status(200).json({
    success: true,
    message: "Brief sent to applicant",
    briefId: brief._id,
    token,
    link: briefLink,
  });
});

/**
 * Send follow-up email to applicant with optional attachments
 * Supports multipart/form-data for file uploads
 *
 * @route POST /api/apply/:id/email
 * @body {string} subject - Email subject (required)
 * @body {string} message - Email message content (required)
 * @files {File[]} attachments - Optional file attachments (max 5 files, 10MB each)
 */
const sendFollowUpEmail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { subject, message } = req.body;

  if (!subject || !message) {
    res.status(400);
    throw new Error("Subject and message are required");
  }

  const application = await Application.findById(id);
  if (!application) {
    res.status(404);
    throw new Error("Application not found");
  }

  const send_to = application.email;
  const sent_from = process.env.EMAIL_FROM;
  const reply_to = "careers@sellsquarehub.com";

  // Check if there are attachments
  const attachmentFiles = req.files?.attachments || [];

  // Process attachments if present
  const attachments = [];
  const tempFiles = [];

  try {
    if (attachmentFiles.length > 0) {
      // Validate attachment count
      if (attachmentFiles.length > 5) {
        res.status(400);
        throw new Error("Maximum 5 attachments allowed");
      }

      // Process each attachment
      for (const file of attachmentFiles) {
        // Validate file size (10MB max per file)
        if (file.size > 10 * 1024 * 1024) {
          res.status(400);
          throw new Error(`File ${file.originalname} exceeds 10MB limit`);
        }

        // Read file content as buffer
        const fileBuffer = fs.readFileSync(file.path);

        attachments.push({
          filename: file.originalname,
          data: fileBuffer,
          contentType: file.mimetype,
        });

        // Track temp file for cleanup
        tempFiles.push(file.path);
      }

      // Send email with attachments using Mailgun
      const messageData = {
        from: sent_from,
        to: send_to,
        subject: subject,
        html: generateEmailHTML(message),
        attachment: attachments,
      };

      if (reply_to) {
        messageData["h:Reply-To"] = reply_to;
      }

      // Use the Mailgun client directly for attachments
      const formData = require("form-data");
      const Mailgun = require("mailgun.js");
      const mailgun = new Mailgun(formData);
      const mg = mailgun.client({
        username: "api",
        key: process.env.MAILGUN_API_KEY || "",
        url: process.env.MAILGUN_API_URL || "https://api.mailgun.net",
      });

      await mg.messages.create(process.env.MAILGUN_DOMAIN, messageData);
      console.log(
        `Email with ${attachments.length} attachment(s) sent successfully`
      );
    } else {
      // No attachments - use standard email function
      await sendEmail(
        subject,
        { messageContent: message },
        send_to,
        sent_from,
        reply_to,
        { template: "generic" }
      );
    }

    logActivity(`Sent follow-up email to applicant "${application.fullName}"${attachments.length > 0 ? ` with ${attachments.length} attachment(s)` : ""}`)(req, res);

    res.status(200).json({
      success: true,
      message:
        attachments.length > 0
          ? `Email sent with ${attachments.length} attachment(s)`
          : "Email sent",
    });
  } finally {
    // Clean up temp files
    for (const tempFile of tempFiles) {
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch (cleanupError) {
        console.error("Failed to clean up temp file:", tempFile, cleanupError);
      }
    }
  }
});

/**
 * Generate simple HTML wrapper for email message
 */
function generateEmailHTML(message) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px;">
        <p style="white-space: pre-wrap; line-height: 1.6;">${message}</p>
      </div>
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #888; font-size: 12px;">
        <p>SellSquare Team</p>
      </div>
    </div>
  `;
}

const getBriefByToken = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const brief = await BriefAssignment.findOne({ token }).populate(
    "application"
  );

  if (!brief) {
    res.status(404);
    throw new Error("Brief not found");
  }

  res.status(200).json({
    success: true,
    data: {
      applicant: {
        name: brief.application.fullName,
        position: brief.application.position,
      },
      status: brief.status,
      dueDate: brief.dueDate,
      instructions: brief.instructions,
      questions: BRIEF_QUESTIONS,
    },
  });
});

const submitBriefResponses = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { campaignIdea, channelPlan, measurementPlan, links } = req.body;

  const brief = await BriefAssignment.findOne({ token }).populate(
    "application"
  );
  if (!brief) {
    res.status(404);
    throw new Error("Brief not found");
  }

  brief.responses = {
    campaignIdea: campaignIdea || "",
    channelPlan: channelPlan || "",
    measurementPlan: measurementPlan || "",
    links: links || "",
  };
  brief.status = "submitted";
  brief.submittedAt = new Date();
  await brief.save();

  const send_to = brief.application.email;
  const sent_from = process.env.EMAIL_FROM;
  const reply_to = "careers@sellsquarehub.com";

  // Notify applicant
  await sendEmail(
    "We received your brief - SellSquare",
    {
      messageContent: `Thanks for submitting your brief for the ${brief.application.position} track. We'll review and get back shortly.`,
    },
    send_to,
    sent_from,
    reply_to,
    { template: "generic" }
  );

  // Note: submitBriefResponses doesn't have req.business context (it's token-based),
  // so activity logging is handled externally when needed

  res.status(200).json({ success: true, message: "Brief submitted" });
});

module.exports = {
  submitApplication,
  getApplications,
  getApplicationById,
  updateApplicationStatus,
  sendBriefToApplicant,
  sendFollowUpEmail,
  getBriefByToken,
  submitBriefResponses,
};
