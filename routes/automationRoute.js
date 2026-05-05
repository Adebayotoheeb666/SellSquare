const express = require("express");
const automationController = require("../controllers/automationController");
const protect = require("../middleWare/authMiddleware");
const requireSuperAdmin = require("../middleWare/requireSuperAdmin");

const router = express.Router();

// ==================== Public Webhooks (No Auth Required) ====================

// WhatsApp webhook receiver for incoming messages (public, from Twilio/Meta)
router.post("/webhooks/whatsapp", automationController.handleWhatsAppWebhook);

// ==================== Protected Routes ====================

// All routes below require authentication AND super admin access
router.use(protect);
router.use(requireSuperAdmin);

// ==================== Automation Status ====================
router.get("/status", automationController.getAutomationStatus);
router.get("/jobs/status", automationController.getJobStatus);
router.post("/scheduler/start", automationController.startScheduler);
router.post("/scheduler/stop", automationController.stopScheduler);
router.patch("/schedules/update", automationController.updateAutomationSchedules);

// ==================== Integration Testing ====================

// NEW: Aliases to match frontend service (GET /api/automation/test-[platform])
router.get("/test-tiktok", automationController.testTikTokConnection);
router.get("/test-instagram", automationController.testInstagramConnection);
router.get("/test-whatsapp", automationController.testWhatsAppConnection);
router.get("/test-email", automationController.testEmailConnection);
router.get("/test-elevenlabs", automationController.testElevenLabsConnection);

// TikTok integration test
router.post("/integrations/tiktok/test", automationController.testTikTokConnection);

// Instagram integration test
router.post("/integrations/instagram/test", automationController.testInstagramConnection);

// WhatsApp integration test
router.post("/integrations/whatsapp/test", automationController.testWhatsAppConnection);

// Email integration test
router.post("/integrations/email/test", automationController.testEmailConnection);

// 11 Labs integration test
router.post("/integrations/elevenlabs/test", automationController.testElevenLabsConnection);

// ==================== Social Media Automations ====================

// Get social media engagement records
router.get("/engagements", automationController.getSocialMediaEngagements);

// Get engagement details
router.get("/engagements/:engagementId", automationController.getEngagementDetails);

// Archive engagement
router.patch("/engagements/:engagementId/archive", automationController.archiveEngagement);

// ==================== Content Ideas Management ====================

// Get all content ideas
router.get("/ideas", automationController.getContentIdeas);

// Get idea details
router.get("/ideas/:ideaId", automationController.getIdeaDetails);

// Approve content idea for auto-posting
router.patch("/ideas/:ideaId/approve", automationController.approveContentIdea);

// Reject content idea
router.patch("/ideas/:ideaId/reject", automationController.rejectContentIdea);

// Schedule content idea for publishing
router.post("/ideas/:ideaId/schedule", automationController.scheduleContentIdea);

// Reschedule content
router.patch("/ideas/:ideaId/reschedule", automationController.rescheduleContent);

// Get idea statistics
router.get("/ideas/stats/dashboard", automationController.getIdeaStats);

// ==================== Registration Follow-up Management ====================

// Get registration follow-ups
router.get("/followups", automationController.getRegistrationFollowups);

// Get follow-up details
router.get("/followups/:followupId", automationController.getFollowupDetails);

// Get follow-up conversation history
router.get("/followups/:followupId/history", automationController.getFollowupHistory);

// Pause follow-up sequence
router.patch("/followups/:followupId/pause", automationController.pauseFollowup);

// Resume follow-up sequence
router.patch("/followups/:followupId/resume", automationController.resumeFollowup);

// Unsubscribe follow-up
router.patch("/followups/:followupId/unsubscribe", automationController.unsubscribeFollowup);

// ==================== Follow-up Campaigns ====================

// Get all campaigns
router.get("/campaigns", automationController.getCampaigns);

// Get campaign details
router.get("/campaigns/:campaignId", automationController.getCampaignDetails);

// Create new campaign
router.post("/campaigns", automationController.createCampaign);

// Update campaign
router.patch("/campaigns/:campaignId", automationController.updateCampaign);

// Activate campaign
router.post("/campaigns/:campaignId/activate", automationController.activateCampaign);

// Pause campaign
router.post("/campaigns/:campaignId/pause", automationController.pauseCampaign);

// Archive campaign
router.post("/campaigns/:campaignId/archive", automationController.archiveCampaign);

// Duplicate campaign
router.post("/campaigns/:campaignId/duplicate", automationController.duplicateCampaign);

// Get campaign performance stats
router.get("/campaigns/:campaignId/stats", automationController.getCampaignStats);

// Add recipients to campaign
router.post("/campaigns/:campaignId/recipients", automationController.addCampaignRecipients);

// Update campaign message sequence
router.patch("/campaigns/:campaignId/sequence", automationController.updateCampaignSequence);

// ==================== Follow-up Templates ====================

// Get templates
router.get("/templates", automationController.getFollowupTemplates);

// Create template
router.post("/templates", automationController.createFollowupTemplate);

// Update template
router.patch("/templates/:templateId", automationController.updateFollowupTemplate);

// Delete template
router.delete("/templates/:templateId", automationController.deleteFollowupTemplate);

// ==================== Dashboard & Analytics ====================

// Get automation dashboard overview
router.get("/dashboard/overview", automationController.getDashboardOverview);

// Get engagement metrics
router.get("/analytics/engagement", automationController.getEngagementMetrics);

// Get campaign performance metrics
router.get("/analytics/campaigns", automationController.getCampaignMetrics);

// Get content performance metrics
router.get("/analytics/content", automationController.getContentMetrics);

// Get follow-up metrics
router.get("/analytics/followups", automationController.getFollowupMetrics);

// ==================== Manual Triggers ====================

// Manually trigger tiktok-automation (alias for triggers/tiktok)
router.post("/trigger/tiktok-automation", automationController.triggerTikTokAutomation);

// Manually trigger instagram-automation (alias for triggers/instagram)
router.post("/trigger/instagram-automation", automationController.triggerInstagramAutomation);

// Catch-all for other triggers
router.post("/trigger/:jobId", automationController.triggerAutomation);

router.post("/triggers/tiktok", automationController.triggerTikTokAutomation);
router.post("/triggers/instagram", automationController.triggerInstagramAutomation);
router.post("/triggers/followups", automationController.triggerFollowupProcessing);
router.post("/triggers/publishing", automationController.triggerContentPublishing);

module.exports = router;
