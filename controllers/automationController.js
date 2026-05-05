const asyncHandler = require("express-async-handler");
const IntegrationSettings = require("../models/integrationSettingsModel");
const SocialMediaEngagement = require("../models/socialMediaEngagementModel");
const ContentIdea = require("../models/contentIdeaModel");
const RegistrationFollowup = require("../models/registrationFollowupModel");
const FollowupTemplate = require("../models/followupTemplateModel");
const FollowupCampaign = require("../models/followupCampaignModel");

// Services
const tiktokService = require("../services/tiktok/tiktokService");
const instagramService = require("../services/instagram/instagramService");
const whatsappService = require("../services/whatsapp/whatsappService");
const contentIdeaService = require("../services/contentIdea/contentIdeaService");
const campaignService = require("../services/campaigns/campaignService");
const elevenlabsService = require("../services/elevenlabs/elevenlabsService");

// Jobs
const tiktokAutomationJob = require("../jobs/automations/tiktokAutomationJob");
const instagramAutomationJob = require("../jobs/automations/instagramAutomationJob");
const registrationFollowupJob = require("../jobs/automations/registrationFollowupJob");
const contentPublishingJob = require("../jobs/automations/contentPublishingJob");
const automationScheduler = require("../jobs/automationScheduler");

// ==================== Automation Status ====================

/**
 * Get automation status for platform-level integrations
 * Shows which integrations are connected and enabled
 */
exports.getAutomationStatus = asyncHandler(async (req, res) => {
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;

  const settings = await IntegrationSettings.findOne({ business: platformId });

  const statuses = {
    tiktok: settings?.tiktok?.status || "disconnected",
    instagram: settings?.instagram?.status || "disconnected",
    whatsapp: settings?.whatsapp?.status || "disconnected",
    email: settings?.email?.status || "disconnected",
    elevenlabs: settings?.elevenLabs?.status || "disconnected",
  };

  const automationEnabled = {
    tiktok: settings?.tiktok?.automationSettings?.monitoringEnabled || false,
    instagram: settings?.instagram?.automationSettings?.monitoringEnabled || false,
    whatsapp: settings?.whatsapp?.automationSettings?.followupEnabled || false,
    email: settings?.email?.automationSettings?.followupEnabled || false,
  };

  res.status(200).json({
    success: true,
    data: {
      integrations: statuses,
      automationsEnabled: automationEnabled,
      lastSyncedAt: {
        tiktok: settings?.tiktok?.lastSyncedAt,
        instagram: settings?.instagram?.lastSyncedAt,
      },
    },
  });
});

/**
 * Get job scheduler status
 */
exports.getJobStatus = asyncHandler(async (req, res) => {
  const schedulerStatus = automationScheduler.getStatus();

  res.status(200).json({
    success: true,
    data: schedulerStatus,
  });
});

/**
 * Start the automation scheduler
 */
exports.startScheduler = asyncHandler(async (req, res) => {
  if (automationScheduler.isRunning) {
    return res.status(200).json({
      success: true,
      message: "Scheduler is already running",
      data: automationScheduler.getStatus(),
    });
  }

  automationScheduler.initializeJobs();

  res.status(200).json({
    success: true,
    message: "Automation scheduler started successfully",
    data: automationScheduler.getStatus(),
  });
});

/**
 * Stop the automation scheduler
 */
exports.stopScheduler = asyncHandler(async (req, res) => {
  if (!automationScheduler.isRunning) {
    res.status(400);
    throw new Error("Scheduler is not running");
  }

  automationScheduler.stopAllJobs();

  res.status(200).json({
    success: true,
    message: "Automation scheduler stopped successfully",
    data: automationScheduler.getStatus(),
  });
});

// ==================== Integration Testing ====================

/**
 * Test Instagram connection
 */
exports.testInstagramConnection = asyncHandler(async (req, res) => {
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;
  const settings = await IntegrationSettings.findOne({ business: platformId }).select("+instagram.accessToken");

  const token = settings?.instagram?.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN;
  const businessId = settings?.instagram?.businessAccountId || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (!token || token.includes("your_")) {
    res.status(400);
    throw new Error("Instagram Access Token is missing or a placeholder in .env.automation");
  }
  if (!businessId || businessId.includes("your_")) {
    res.status(400);
    throw new Error("Instagram Business Account ID is missing or a placeholder in .env.automation");
  }

  const result = await instagramService.testConnection(platformId);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Test TikTok connection
 */
exports.testTikTokConnection = asyncHandler(async (req, res) => {
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;
  const settings = await IntegrationSettings.findOne({ business: platformId }).select("+tiktok.accessToken");

  const token = settings?.tiktok?.accessToken || process.env.TIKTOK_ACCESS_TOKEN;
  if (!token || token.includes("your_")) {
    res.status(400);
    throw new Error("TikTok Access Token is missing or a placeholder in .env.automation");
  }

  const result = await tiktokService.testConnection(platformId);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Update automation job schedules
 */
exports.updateAutomationSchedules = asyncHandler(async (req, res) => {
  const { tiktokSchedule, instagramSchedule, followupSchedule, publishingSchedule } = req.body;
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;
  const automationScheduler = require("../jobs/automationScheduler");

  let settings = await IntegrationSettings.findOne({ business: platformId });
  if (!settings) {
    settings = await IntegrationSettings.create({ business: platformId });
  }

  // Update TikTok schedule
  if (tiktokSchedule) {
    settings.tiktok.automationSettings.jobSchedule = tiktokSchedule;
    automationScheduler.rescheduleJob("tiktok_automation", tiktokSchedule);
  }

  // Update Instagram schedule
  if (instagramSchedule) {
    settings.instagram.automationSettings.jobSchedule = instagramSchedule;
    automationScheduler.rescheduleJob("instagram_automation", instagramSchedule);
  }

  // Update Followup schedule (WhatsApp/Email shares this in the scheduler)
  if (followupSchedule) {
    settings.whatsapp.automationSettings.jobSchedule = followupSchedule;
    settings.email.automationSettings.jobSchedule = followupSchedule;
    automationScheduler.rescheduleJob("registration_followup", followupSchedule);
  }

  // Update Publishing schedule
  if (publishingSchedule) {
    settings.contentPublishingSchedule = publishingSchedule;
    automationScheduler.rescheduleJob("content_publishing", publishingSchedule);
  }

  await settings.save();

  res.status(200).json({
    success: true,
    message: "Automation schedules updated successfully",
    data: {
      tiktok: settings.tiktok.automationSettings.jobSchedule,
      instagram: settings.instagram.automationSettings.jobSchedule,
      followups: settings.whatsapp.automationSettings.jobSchedule,
      publishing: settings.contentPublishingSchedule
    }
  });
});

/**
 * Test WhatsApp connection
 */
exports.testWhatsAppConnection = asyncHandler(async (req, res) => {
  const result = await whatsappService.testConnection(process.env.SUPERADMIN_BUSINESS_ID);

  // Return the result directly. The service will indicate if it's connected or not
  // and the frontend test connection handler will display the error.
  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Test Email connection
 */
exports.testEmailConnection = asyncHandler(async (req, res) => {
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;
  const settings = await IntegrationSettings.findOne({ business: platformId }).select("+email.apiKey");

  if (!settings?.email?.enabled) {
    res.status(400);
    throw new Error("Email integration not configured. Click Connect first.");
  }

  const apiKey = settings.email.apiKey || process.env.EMAIL_API_KEY;
  if (!apiKey) {
    throw new Error("Email API key missing from settings and environment");
  }

  // Attempt to verify with SendGrid if it's the provider
  if (settings.email.provider === "sendgrid") {
    try {
      const axios = require("axios");
      await axios.get("https://api.sendgrid.com/v3/scopes", {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "SendGrid API key verification failed: " + (error.response?.data?.errors?.[0]?.message || error.message)
      });
    }
  }

  res.status(200).json({
    success: true,
    data: {
      connected: true,
      provider: settings.email.provider,
      senderEmail: settings.email.senderEmail,
      verified: true
    },
  });
});

/**
 * Test 11Labs connection
 */
exports.testElevenLabsConnection = asyncHandler(async (req, res) => {
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;
  const settings = await IntegrationSettings.findOne({ business: platformId }).select("+elevenLabs.apiKey");

  const apiKey = settings?.elevenLabs?.apiKey || process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    res.status(400);
    throw new Error("ElevenLabs API key not found in settings or environment");
  }

  const result = await elevenlabsService.testConnection(apiKey);

  res.status(200).json({
    success: true,
    data: result,
  });
});

// ==================== Social Media Engagements ====================

/**
 * Get social media engagements from platform accounts
 */
exports.getSocialMediaEngagements = asyncHandler(async (req, res) => {
  const { platform, limit = 20, skip = 0 } = req.query;

  const query = { platformLevel: true };
  if (platform) query.platform = platform;

  const engagements = await SocialMediaEngagement.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .populate("generatedContentIdea");

  const total = await SocialMediaEngagement.countDocuments(query);

  res.status(200).json({
    success: true,
    data: engagements,
    pagination: { total, limit: parseInt(limit), skip: parseInt(skip) },
  });
});

/**
 * Get details for a specific engagement
 */
exports.getEngagementDetails = asyncHandler(async (req, res) => {
  const { engagementId } = req.params;

  const engagement = await SocialMediaEngagement.findOne({
    _id: engagementId,
    platformLevel: true,
  }).populate("generatedContentIdea");

  if (!engagement) {
    res.status(404);
    throw new Error("Engagement not found");
  }

  res.status(200).json({
    success: true,
    data: engagement,
  });
});

/**
 * Archive an engagement record
 */
exports.archiveEngagement = asyncHandler(async (req, res) => {
  const { engagementId } = req.params;

  const engagement = await SocialMediaEngagement.findOneAndUpdate(
    { _id: engagementId, platformLevel: true },
    { status: "archived" },
    { new: true }
  );

  if (!engagement) {
    res.status(404);
    throw new Error("Engagement not found");
  }

  res.status(200).json({
    success: true,
    message: "Engagement archived",
    data: engagement,
  });
});

// ==================== Content Ideas ====================

/**
 * Get content ideas generated from social media insights
 */
exports.getContentIdeas = asyncHandler(async (req, res) => {
  const { status, limit = 20, skip = 0 } = req.query;

  const query = { platformLevel: true };
  if (status) query.status = status;

  const ideas = await ContentIdea.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .populate("sourceEngagement");

  const total = await ContentIdea.countDocuments(query);

  res.status(200).json({
    success: true,
    data: ideas,
    pagination: { total, limit: parseInt(limit), skip: parseInt(skip) },
  });
});

/**
 * Get details for a specific content idea
 */
exports.getIdeaDetails = asyncHandler(async (req, res) => {
  const { ideaId } = req.params;

  const idea = await ContentIdea.findOne({
    _id: ideaId,
    platformLevel: true,
  }).populate("sourceEngagement");

  if (!idea) {
    res.status(404);
    throw new Error("Content idea not found");
  }

  res.status(200).json({
    success: true,
    data: idea,
  });
});

/**
 * Approve a content idea for auto-posting
 */
exports.approveContentIdea = asyncHandler(async (req, res) => {
  const { ideaId } = req.params;
  const { notes } = req.body;

  const idea = await ContentIdea.findOneAndUpdate(
    { _id: ideaId, platformLevel: true },
    {
      status: "approved",
      approvedAt: new Date(),
      approvedBy: req.business._id,
      approvalNotes: notes,
    },
    { new: true }
  );

  if (!idea) {
    res.status(404);
    throw new Error("Content idea not found");
  }

  res.status(200).json({
    success: true,
    message: "Content idea approved for auto-posting",
    data: idea,
  });
});

/**
 * Reject a content idea
 */
exports.rejectContentIdea = asyncHandler(async (req, res) => {
  const { ideaId } = req.params;
  const { reason } = req.body;

  const idea = await ContentIdea.findOneAndUpdate(
    { _id: ideaId, platformLevel: true },
    {
      status: "rejected",
      approvalNotes: reason,
    },
    { new: true }
  );

  if (!idea) {
    res.status(404);
    throw new Error("Content idea not found");
  }

  res.status(200).json({
    success: true,
    message: "Content idea rejected",
    data: idea,
  });
});

/**
 * Schedule a content idea for publishing to social media
 */
exports.scheduleContentIdea = asyncHandler(async (req, res) => {
  const { ideaId } = req.params;
  const { platforms, scheduledDate } = req.body;

  if (!platforms || !scheduledDate) {
    res.status(400);
    throw new Error("Platforms and scheduled date are required");
  }

  const idea = await ContentIdea.findOneAndUpdate(
    { _id: ideaId, platformLevel: true },
    {
      status: "scheduled",
      "scheduledFor.platform": platforms,
      "scheduledFor.scheduledDate": new Date(scheduledDate),
    },
    { new: true }
  );

  if (!idea) {
    res.status(404);
    throw new Error("Content idea not found");
  }

  res.status(200).json({
    success: true,
    message: "Content idea scheduled for publishing",
    data: idea,
  });
});

/**
 * Reschedule a content idea
 */
exports.rescheduleContent = asyncHandler(async (req, res) => {
  const { ideaId } = req.params;
  const { scheduledDate } = req.body;

  const idea = await ContentIdea.findOneAndUpdate(
    { _id: ideaId, platformLevel: true },
    {
      "scheduledFor.scheduledDate": new Date(scheduledDate),
    },
    { new: true }
  );

  if (!idea) {
    res.status(404);
    throw new Error("Content idea not found");
  }

  res.status(200).json({
    success: true,
    message: "Content idea rescheduled",
    data: idea,
  });
});

/**
 * Get content idea statistics
 */
exports.getIdeaStats = asyncHandler(async (req, res) => {
  const stats = await contentIdeaService.getIdeaStats(process.env.SUPERADMIN_BUSINESS_ID);

  res.status(200).json({
    success: true,
    data: stats,
  });
});

// ==================== Registration Follow-ups ====================

/**
 * Get registration follow-ups for new platform signups
 */
exports.getRegistrationFollowups = asyncHandler(async (req, res) => {
  const { status, limit = 20, skip = 0 } = req.query;

  const query = { platformLevel: true };
  if (status) query.status = status;

  const followups = await RegistrationFollowup.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip));

  const total = await RegistrationFollowup.countDocuments(query);

  res.status(200).json({
    success: true,
    data: followups,
    pagination: { total, limit: parseInt(limit), skip: parseInt(skip) },
  });
});

/**
 * Get follow-up details
 */
exports.getFollowupDetails = asyncHandler(async (req, res) => {
  const { followupId } = req.params;

  const followup = await RegistrationFollowup.findOne({
    _id: followupId,
    platformLevel: true,
  }).populate("followupSequence.templateId", "assignedCampaigns.campaignId");

  if (!followup) {
    res.status(404);
    throw new Error("Follow-up not found");
  }

  res.status(200).json({
    success: true,
    data: followup,
  });
});

/**
 * Get follow-up history/interactions
 */
exports.getFollowupHistory = asyncHandler(async (req, res) => {
  const { followupId } = req.params;

  const followup = await RegistrationFollowup.findOne({
    _id: followupId,
    platformLevel: true,
  });

  if (!followup) {
    res.status(404);
    throw new Error("Follow-up not found");
  }

  res.status(200).json({
    success: true,
    data: {
      followupId,
      contactEmail: followup.contactEmail,
      contactPhone: followup.contactPhone,
      interactions: followup.interactions,
      metrics: followup.engagementMetrics,
    },
  });
});

/**
 * Pause a follow-up sequence
 */
exports.pauseFollowup = asyncHandler(async (req, res) => {
  const { followupId } = req.params;
  const { reason } = req.body;

  const followup = await RegistrationFollowup.findOneAndUpdate(
    { _id: followupId, platformLevel: true },
    {
      status: "paused",
      pausedAt: new Date(),
      pauseReason: reason,
    },
    { new: true }
  );

  if (!followup) {
    res.status(404);
    throw new Error("Follow-up not found");
  }

  res.status(200).json({
    success: true,
    message: "Follow-up paused",
    data: followup,
  });
});

/**
 * Resume a paused follow-up sequence
 */
exports.resumeFollowup = asyncHandler(async (req, res) => {
  const { followupId } = req.params;

  const followup = await RegistrationFollowup.findOneAndUpdate(
    { _id: followupId, platformLevel: true },
    {
      status: "in_sequence",
      pausedAt: null,
      pauseReason: null,
    },
    { new: true }
  );

  if (!followup) {
    res.status(404);
    throw new Error("Follow-up not found");
  }

  res.status(200).json({
    success: true,
    message: "Follow-up resumed",
    data: followup,
  });
});

/**
 * Unsubscribe a contact from follow-ups
 */
exports.unsubscribeFollowup = asyncHandler(async (req, res) => {
  const { followupId } = req.params;

  const followup = await RegistrationFollowup.findOneAndUpdate(
    { _id: followupId, platformLevel: true },
    {
      status: "unsubscribed",
      unsubscribedAt: new Date(),
      "preferences.allowEmail": false,
      "preferences.allowWhatsapp": false,
    },
    { new: true }
  );

  if (!followup) {
    res.status(404);
    throw new Error("Follow-up not found");
  }

  res.status(200).json({
    success: true,
    message: "Contact unsubscribed from follow-ups",
    data: followup,
  });
});

// ==================== Follow-up Campaigns ====================

/**
 * Get all follow-up campaigns
 */
exports.getCampaigns = asyncHandler(async (req, res) => {
  const { status, limit = 20, skip = 0 } = req.query;

  const result = await campaignService.getPlatformCampaigns({
    status,
    limit: parseInt(limit),
    skip: parseInt(skip),
  });

  res.status(200).json({
    success: true,
    data: result.campaigns,
    pagination: result.pagination,
  });
});

/**
 * Get campaign details
 */
exports.getCampaignDetails = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;

  const campaign = await FollowupCampaign.findOne({
    _id: campaignId,
    platformLevel: true,
  }).populate("messageSequence.templateId");

  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }

  res.status(200).json({
    success: true,
    data: campaign,
  });
});

/**
 * Create a new follow-up campaign
 */
exports.createCampaign = asyncHandler(async (req, res) => {
  const campaign = await campaignService.createPlatformCampaign(req.body, req.business._id);

  res.status(201).json({
    success: true,
    message: "Campaign created successfully",
    data: campaign,
  });
});

/**
 * Update a campaign
 */
exports.updateCampaign = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;

  const campaign = await FollowupCampaign.findOneAndUpdate(
    { _id: campaignId, platformLevel: true },
    req.body,
    { new: true }
  );

  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }

  res.status(200).json({
    success: true,
    message: "Campaign updated successfully",
    data: campaign,
  });
});

/**
 * Activate a campaign
 */
exports.activateCampaign = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;

  const campaign = await campaignService.activatePlatformCampaign(campaignId);

  res.status(200).json({
    success: true,
    message: "Campaign activated",
    data: campaign,
  });
});

/**
 * Pause a campaign
 */
exports.pauseCampaign = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;

  const campaign = await campaignService.pausePlatformCampaign(campaignId);

  res.status(200).json({
    success: true,
    message: "Campaign paused",
    data: campaign,
  });
});

/**
 * Archive a campaign
 */
exports.archiveCampaign = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;

  const campaign = await campaignService.archivePlatformCampaign(campaignId);

  res.status(200).json({
    success: true,
    message: "Campaign archived",
    data: campaign,
  });
});

/**
 * Duplicate a campaign
 */
exports.duplicateCampaign = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;

  const campaign = await campaignService.duplicatePlatformCampaign(campaignId, req.business._id);

  res.status(201).json({
    success: true,
    message: "Campaign duplicated successfully",
    data: campaign,
  });
});

/**
 * Get campaign performance stats
 */
exports.getCampaignStats = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;

  const stats = await campaignService.getPlatformCampaignStats(campaignId);

  res.status(200).json({
    success: true,
    data: stats,
  });
});

/**
 * Add recipients to a campaign
 */
exports.addCampaignRecipients = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;
  const { followupIds } = req.body;

  if (!followupIds || !Array.isArray(followupIds)) {
    res.status(400);
    throw new Error("followupIds array is required");
  }

  const campaign = await campaignService.addRecipientsToplatformCampaign(campaignId, followupIds);

  res.status(200).json({
    success: true,
    message: `Added ${followupIds.length} recipients to campaign`,
    data: campaign,
  });
});

/**
 * Update campaign message sequence
 */
exports.updateCampaignSequence = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;
  const { messageSequence } = req.body;

  const campaign = await campaignService.updatePlatformCampaignSequence(campaignId, messageSequence);

  res.status(200).json({
    success: true,
    message: "Campaign message sequence updated",
    data: campaign,
  });
});

// ==================== Follow-up Templates ====================

/**
 * Get follow-up templates for registration sequence
 */
exports.getFollowupTemplates = asyncHandler(async (req, res) => {
  const { channel, limit = 20, skip = 0 } = req.query;

  const platformId = process.env.SUPERADMIN_BUSINESS_ID;
  const query = { business: platformId, active: true, platformLevel: true };
  if (channel) query.channel = channel;

  const templates = await FollowupTemplate.find(query)
    .sort({ sequencePosition: 1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip));

  const total = await FollowupTemplate.countDocuments(query);

  res.status(200).json({
    success: true,
    data: templates,
    pagination: { total, limit: parseInt(limit), skip: parseInt(skip) },
  });
});

/**
 * Create a follow-up template
 */
exports.createFollowupTemplate = asyncHandler(async (req, res) => {
  const template = await FollowupTemplate.create({
    business: process.env.SUPERADMIN_BUSINESS_ID,
    ...req.body,
    createdBy: req.business._id,
    platformLevel: true,
  });

  res.status(201).json({
    success: true,
    message: "Template created successfully",
    data: template,
  });
});

/**
 * Update a follow-up template
 */
exports.updateFollowupTemplate = asyncHandler(async (req, res) => {
  const { templateId } = req.params;

  const template = await FollowupTemplate.findOneAndUpdate(
    { _id: templateId, platformLevel: true },
    req.body,
    { new: true }
  );

  if (!template) {
    res.status(404);
    throw new Error("Template not found");
  }

  res.status(200).json({
    success: true,
    message: "Template updated successfully",
    data: template,
  });
});

/**
 * Delete (deactivate) a follow-up template
 */
exports.deleteFollowupTemplate = asyncHandler(async (req, res) => {
  const { templateId } = req.params;

  const template = await FollowupTemplate.findOneAndUpdate(
    { _id: templateId, platformLevel: true },
    { active: false },
    { new: true }
  );

  if (!template) {
    res.status(404);
    throw new Error("Template not found");
  }

  res.status(200).json({
    success: true,
    message: "Template deleted successfully",
  });
});



// ==================== Manual Triggers ====================

/**
 * Manually trigger TikTok automation for platform account
 */
exports.triggerTikTokAutomation = asyncHandler(async (req, res) => {
  // Run TikTok automation for platform marketing
  tiktokAutomationJob
    .processPlatformTikTokAutomation()
    .catch((error) => console.error("TikTok automation error:", error.message));

  res.status(200).json({
    success: true,
    message: "TikTok automation triggered for platform account",
  });
});

/**
 * Manually trigger Instagram automation for platform account
 */
exports.triggerInstagramAutomation = asyncHandler(async (req, res) => {
  // Run Instagram automation for platform marketing
  instagramAutomationJob
    .processPlatformInstagramAutomation()
    .catch((error) => console.error("Instagram automation error:", error.message));

  res.status(200).json({
    success: true,
    message: "Instagram automation triggered for platform account",
  });
});

/**
 * Manually trigger registration follow-up processing
 */
exports.triggerFollowupProcessing = asyncHandler(async (req, res) => {
  // Process all follow-ups for new registrations
  registrationFollowupJob
    .processAllFollowups()
    .catch((error) => console.error("Follow-up processing error:", error.message));

  res.status(200).json({
    success: true,
    message: "Registration follow-up processing triggered",
  });
});

/**
 * Manually trigger content publishing
 */
exports.triggerContentPublishing = asyncHandler(async (req, res) => {
  // Publish scheduled content approved by super admin
  contentPublishingJob
    .publishScheduledContent()
    .catch((error) => console.error("Content publishing error:", error.message));

  res.status(200).json({
    success: true,
    message: "Content publishing triggered for scheduled posts",
  });
});

/**
 * Generic trigger handler for all automation jobs
 * Supports various naming conventions from frontend (e.g., tiktok-automation, tiktok, followups)
 */
exports.triggerAutomation = asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  // Map frontend IDs to internal keys
  const mapping = {
    "tiktok-automation": "tiktok",
    "instagram-automation": "instagram",
    "followup-processing": "followups",
    "content-publishing": "publishing",
    "tiktok": "tiktok",
    "instagram": "instagram",
    "followups": "followups",
    "publishing": "publishing"
  };

  const normalizedId = mapping[jobId] || jobId.replace("-automation", "");

  let triggered = false;
  let message = "";

  switch (normalizedId) {
    case "tiktok":
      automationScheduler.runJob("tiktok_automation");
      triggered = true;
      message = "TikTok automation triggered";
      break;
    case "instagram":
      automationScheduler.runJob("instagram_automation");
      triggered = true;
      message = "Instagram automation triggered";
      break;
    case "followups":
      automationScheduler.runJob("registration_followup");
      triggered = true;
      message = "Registration follow-up processing triggered";
      break;
    case "publishing":
      automationScheduler.runJob("content_publishing");
      triggered = true;
      message = "Content publishing triggered";
      break;
    default:
      return res.status(404).json({
        success: false,
        message: `Unknown job ID: ${jobId}`,
      });
  }

  res.status(200).json({
    success: true,
    message,
    jobId: normalizedId,
  });
});

// ==================== WhatsApp Webhook Handler ====================

/**
 * Handle incoming WhatsApp messages from Twilio/Meta webhook
 * Public endpoint - no authentication required
 */
exports.handleWhatsAppWebhook = asyncHandler(async (req, res) => {
  // Twilio sends incoming messages with this structure
  const messageData = req.body;

  try {
    // Handle the incoming message
    const result = await whatsappService.handleIncomingMessage(messageData);

    // Emit realtime event for follow-up interaction
    const { eventBus, EventTypes } = require("../events/EventEmitter");
    eventBus.emitBusinessEvent(
      EventTypes.FOLLOWUP_INTERACTION,
      messageData.business || process.env.SUPERADMIN_BUSINESS_ID,
      {
        followupId: result?.followupId,
        type: "whatsapp_reply",
        messageBody: messageData.Body,
      }
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[WhatsApp Webhook] Error processing webhook:", error.message);
    // Return 200 to acknowledge receipt even if processing failed
    res.status(200).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== Real Metrics Endpoints ====================

/**
 * Get automation dashboard overview with real data
 */
exports.getDashboardOverview = asyncHandler(async (req, res) => {
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;

  try {
    // Get counts for different automations
    const totalEngagements = await SocialMediaEngagement.countDocuments({
      platformLevel: true,
    });

    const totalContentIdeas = await ContentIdea.countDocuments({
      platformLevel: true,
    });

    const approvedIdeas = await ContentIdea.countDocuments({
      platformLevel: true,
      status: "approved",
    });

    const publishedContent = await ContentIdea.countDocuments({
      platformLevel: true,
      status: "published",
    });

    const totalFollowups = await RegistrationFollowup.countDocuments({
      business: platformId,
    });

    const activeFollowups = await RegistrationFollowup.countDocuments({
      business: platformId,
      status: { $in: ["in_sequence", "pending"] },
    });

    const convertedFollowups = await RegistrationFollowup.countDocuments({
      business: platformId,
      "engagementMetrics.converted": true,
    });

    // Get recent activity
    const recentEngagements = await SocialMediaEngagement.find({
      platformLevel: true,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("platform engagement createdAt");

    const recentIdeas = await ContentIdea.find({
      platformLevel: true,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title status sourcePlatform createdAt");

    res.status(200).json({
      success: true,
      data: {
        socialMedia: {
          totalEngagements,
          totalContentIdeas,
          approvedIdeas,
          publishedContent,
          recentEngagements,
          recentIdeas,
        },
        followups: {
          totalFollowups,
          activeFollowups,
          convertedFollowups,
          conversionRate: totalFollowups > 0 ? ((convertedFollowups / totalFollowups) * 100).toFixed(2) : 0,
        },
      },
    });
  } catch (error) {
    console.error("[Dashboard] Error fetching overview:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get engagement metrics with real data
 */
exports.getEngagementMetrics = asyncHandler(async (req, res) => {
  const { startDate, endDate, platform } = req.query;

  try {
    const query = { platformLevel: true };

    // Add date filter if provided
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Add platform filter if provided
    if (platform) {
      query.platform = platform;
    }

    // Get engagement data
    const engagements = await SocialMediaEngagement.find(query).populate(
      "generatedContentIdea"
    );

    // Calculate metrics
    const totalEngagements = engagements.length;
    const likesGiven = engagements.filter((e) => e.engagementType === "like").length;
    const commentsGiven = engagements.filter((e) => e.engagementType === "comment").length;
    const sharesGiven = engagements.filter((e) => e.engagementType === "share").length;

    // Group by platform
    const byPlatform = {
      tiktok: engagements.filter((e) => e.platform === "tiktok").length,
      instagram: engagements.filter((e) => e.platform === "instagram").length,
    };

    // Get engagement types
    const byType = {
      like: likesGiven,
      comment: commentsGiven,
      share: sharesGiven,
    };

    // Get average sentiment from generated ideas
    const ideas = engagements
      .filter((e) => e.generatedContentIdea)
      .map((e) => e.generatedContentIdea.resonanceScore || 0);

    const averageResonance =
      ideas.length > 0 ? (ideas.reduce((a, b) => a + b, 0) / ideas.length).toFixed(2) : 0;

    res.status(200).json({
      success: true,
      data: {
        totalEngagements,
        byPlatform,
        byType,
        averageResonance,
        engagementRate: totalEngagements > 0 ? ((commentsGiven / totalEngagements) * 100).toFixed(2) : 0,
        recentEngagements: engagements.slice(0, 10),
      },
    });
  } catch (error) {
    console.error("[Engagement Metrics] Error fetching metrics:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get campaign metrics with real data
 */
exports.getCampaignMetrics = asyncHandler(async (req, res) => {
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;
  const { startDate, endDate } = req.query;

  try {
    const query = { business: platformId };

    // Add date filter if provided
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Get campaign data
    const campaigns = await FollowupCampaign.find(query).populate("recipients");

    // Calculate metrics
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
    const completedCampaigns = campaigns.filter((c) => c.status === "completed").length;

    // Aggregate followup metrics from linked followups
    const followups = await RegistrationFollowup.find(query);

    const totalEmailsSent = followups.reduce(
      (sum, f) => sum + (f.engagementMetrics?.emailsSent || 0),
      0
    );

    const totalWhatsappSent = followups.reduce(
      (sum, f) => sum + (f.engagementMetrics?.whatsappMessagesSent || 0),
      0
    );

    const totalOpens = followups.reduce(
      (sum, f) => sum + (f.engagementMetrics?.emailsOpened || 0),
      0
    );

    const totalConverted = followups.filter(
      (f) => f.engagementMetrics?.converted
    ).length;

    const openRate =
      totalEmailsSent > 0 ? ((totalOpens / totalEmailsSent) * 100).toFixed(2) : 0;

    const conversionRate =
      followups.length > 0 ? ((totalConverted / followups.length) * 100).toFixed(2) : 0;

    res.status(200).json({
      success: true,
      data: {
        totalCampaigns,
        activeCampaigns,
        completedCampaigns,
        totalEmailsSent,
        totalWhatsappSent,
        totalOpens,
        totalConverted,
        openRate,
        conversionRate,
        campaigns: campaigns.slice(0, 10),
      },
    });
  } catch (error) {
    console.error("[Campaign Metrics] Error fetching metrics:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get content performance metrics with real data
 */
exports.getContentMetrics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    const query = { platformLevel: true };

    // Add date filter if provided
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Get content data
    const ideas = await ContentIdea.find(query);

    // Calculate metrics
    const totalIdeas = ideas.length;
    const approvedIdeas = ideas.filter((i) => i.status === "approved").length;
    const publishedIdeas = ideas.filter((i) => i.status === "published").length;
    const rejectedIdeas = ideas.filter((i) => i.status === "rejected").length;

    // Performance metrics from published content
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;

    ideas.forEach((idea) => {
      idea.publishingHistory.forEach((history) => {
        totalViews += history.performance?.views || 0;
        totalLikes += history.performance?.likes || 0;
        totalComments += history.performance?.comments || 0;
        totalShares += history.performance?.shares || 0;
      });
    });

    // Average resonance score
    const resonanceScores = ideas
      .filter((i) => i.resonanceScore)
      .map((i) => i.resonanceScore);

    const averageResonance =
      resonanceScores.length > 0
        ? (
          resonanceScores.reduce((a, b) => a + b, 0) / resonanceScores.length
        ).toFixed(2)
        : 0;

    // Engagement rate
    const totalPublishedPosts = ideas.reduce(
      (sum, i) => sum + i.publishingHistory.length,
      0
    );

    const engagementRate =
      totalPublishedPosts > 0
        ? ((totalComments / totalPublishedPosts) * 100).toFixed(2)
        : 0;

    res.status(200).json({
      success: true,
      data: {
        totalIdeas,
        approvedIdeas,
        publishedIdeas,
        rejectedIdeas,
        approvalRate:
          totalIdeas > 0 ? ((approvedIdeas / totalIdeas) * 100).toFixed(2) : 0,
        publishRate:
          approvedIdeas > 0
            ? ((publishedIdeas / approvedIdeas) * 100).toFixed(2)
            : 0,
        performance: {
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          averageEngagement:
            totalPublishedPosts > 0
              ? Math.round(
                (totalLikes + totalComments + totalShares) / totalPublishedPosts
              )
              : 0,
        },
        averageResonance,
        engagementRate,
        topIdeas: ideas
          .filter((i) => i.publishingHistory.length > 0)
          .sort((a, b) => {
            const aTotal = a.publishingHistory.reduce(
              (sum, h) => sum + (h.performance?.likes || 0),
              0
            );
            const bTotal = b.publishingHistory.reduce(
              (sum, h) => sum + (h.performance?.likes || 0),
              0
            );
            return bTotal - aTotal;
          })
          .slice(0, 5),
      },
    });
  } catch (error) {
    console.error("[Content Metrics] Error fetching metrics:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get follow-up metrics with real data
 */
exports.getFollowupMetrics = asyncHandler(async (req, res) => {
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;
  const { startDate, endDate } = req.query;

  try {
    const query = { business: platformId };

    // Add date filter if provided
    if (startDate && endDate) {
      query.registeredAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Get follow-up data
    const followups = await RegistrationFollowup.find(query);

    // Calculate metrics
    const totalFollowups = followups.length;
    const activeFollowups = followups.filter(
      (f) => f.status === "in_sequence" || f.status === "pending"
    ).length;
    const completedFollowups = followups.filter(
      (f) => f.status === "completed"
    ).length;
    const unsubscribedFollowups = followups.filter(
      (f) => f.status === "unsubscribed"
    ).length;

    // Engagement metrics
    const totalEmailsSent = followups.reduce(
      (sum, f) => sum + (f.engagementMetrics?.emailsSent || 0),
      0
    );

    const totalEmailsOpened = followups.reduce(
      (sum, f) => sum + (f.engagementMetrics?.emailsOpened || 0),
      0
    );

    const totalWhatsappSent = followups.reduce(
      (sum, f) => sum + (f.engagementMetrics?.whatsappMessagesSent || 0),
      0
    );

    const totalWhatsappRead = followups.reduce(
      (sum, f) => sum + (f.engagementMetrics?.whatsappMessagesRead || 0),
      0
    );

    const totalConverted = followups.filter(
      (f) => f.engagementMetrics?.converted
    ).length;

    const emailOpenRate =
      totalEmailsSent > 0
        ? ((totalEmailsOpened / totalEmailsSent) * 100).toFixed(2)
        : 0;

    const whatsappReadRate =
      totalWhatsappSent > 0
        ? ((totalWhatsappRead / totalWhatsappSent) * 100).toFixed(2)
        : 0;

    const conversionRate =
      totalFollowups > 0 ? ((totalConverted / totalFollowups) * 100).toFixed(2) : 0;

    res.status(200).json({
      success: true,
      data: {
        totalFollowups,
        activeFollowups,
        completedFollowups,
        unsubscribedFollowups,
        unsubscribeRate:
          totalFollowups > 0
            ? ((unsubscribedFollowups / totalFollowups) * 100).toFixed(2)
            : 0,
        emailMetrics: {
          totalSent: totalEmailsSent,
          totalOpened: totalEmailsOpened,
          openRate: emailOpenRate,
        },
        whatsappMetrics: {
          totalSent: totalWhatsappSent,
          totalRead: totalWhatsappRead,
          readRate: whatsappReadRate,
        },
        conversion: {
          totalConverted,
          conversionRate,
        },
        averageEngagementScore: followups.length > 0
          ? (
            followups.reduce(
              (sum, f) => sum + Object.values(f.engagementMetrics || {}).reduce((a, b) => a + (b || 0), 0),
              0
            ) / followups.length
          ).toFixed(2)
          : 0,
      },
    });
  } catch (error) {
    console.error("[Followup Metrics] Error fetching metrics:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = exports;
