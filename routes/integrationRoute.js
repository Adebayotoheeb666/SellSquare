const express = require("express");
const {
  getPlatformIntegrationSettings,
  connectTikTok,
  disconnectTikTok,
  tiktokOAuthStart,
  connectInstagram,
  disconnectInstagram,
  connectWhatsApp,
  disconnectWhatsApp,
  connectEmail,
  disconnectEmail,
  connectElevenLabs,
  disconnectElevenLabs,
  updateAutomationSettings,
  getSocialMediaEngagement,
  getContentIdeas,
  approveContentIdea,
  getRegistrationFollowups,
  createFollowupTemplate,
  getFollowupTemplates,
} = require("../controllers/integrationController");
const protect = require("../middleWare/authMiddleware");
const requireSuperAdmin = require("../middleWare/requireSuperAdmin");

const router = express.Router();

// Public callback routes (No Auth Required for redirect)
router.get("/tiktok/oauth/start", tiktokOAuthStart);
router.get("/tiktok/callback", require("../controllers/integrationController").tiktokCallback);

// All routes below require authentication and super admin access
router.use(protect);
router.use(requireSuperAdmin);

// Integration Settings
router.get("/settings", getPlatformIntegrationSettings);

// TikTok Integration (Platform Marketing)
router.post("/tiktok/connect", connectTikTok);
router.post("/tiktok/disconnect", disconnectTikTok);

// Instagram Integration (Platform Marketing)
router.post("/instagram/connect", connectInstagram);
router.post("/instagram/disconnect", disconnectInstagram);

// WhatsApp Integration (Registration Follow-ups)
router.post("/whatsapp/connect", connectWhatsApp);
router.post("/whatsapp/disconnect", disconnectWhatsApp);

// Email Integration (Registration Follow-ups)
router.post("/email/connect", connectEmail);
router.post("/email/disconnect", disconnectEmail);

// 11Labs Integration (Audio Content Generation)
router.post("/elevenlabs/connect", connectElevenLabs);
router.post("/elevenlabs/disconnect", disconnectElevenLabs);

// Automation Settings
router.patch("/automation-settings", updateAutomationSettings);

// Social Media Engagement (Platform Marketing)
router.get("/engagement/social-media", getSocialMediaEngagement);

// Content Ideas (Platform Marketing)
router.get("/content-ideas", getContentIdeas);
router.patch("/content-ideas/:ideaId/approve", approveContentIdea);

// Registration Follow-ups (New Platform Signups)
router.get("/followups/registration", getRegistrationFollowups);

// Follow-up Templates
router.post("/templates/followup", createFollowupTemplate);
router.get("/templates/followup", getFollowupTemplates);

module.exports = router;
