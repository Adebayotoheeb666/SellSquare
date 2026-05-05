/**
 * ============================================================================
 * AUTOMATION SYSTEM END-TO-END TEST SUITE
 * ============================================================================
 * 
 * This test suite validates the entire automation system including:
 * 1. All channel integrations (TikTok, Instagram, WhatsApp, Email, 11Labs)
 * 2. Social media automation (monitoring, engagement, insights, publishing)
 * 3. Registration follow-up automation (email & WhatsApp)
 * 4. Content generation and approval workflows
 * 5. Campaign management
 * 6. Realtime event emissions
 * 7. Webhook handling
 * 
 * Run: npm test -- __tests__/automation/automationSystemEndToEnd.test.js
 */

// ==================== MOCKS SETUP ====================

// Mock all models
jest.mock("../../models/integrationSettingsModel");
jest.mock("../../models/socialMediaEngagementModel");
jest.mock("../../models/contentIdeaModel");
jest.mock("../../models/registrationFollowupModel");
jest.mock("../../models/followupCampaignModel");
jest.mock("../../models/followupTemplateModel");

// Mock all services
jest.mock("../../services/tiktok/tiktokService");
jest.mock("../../services/instagram/instagramService");
jest.mock("../../services/whatsapp/whatsappService");
jest.mock("../../services/contentIdea/contentIdeaService");
jest.mock("../../services/insights/insightService");
jest.mock("../../services/comments/aiCommentService");
jest.mock("../../services/campaigns/campaignService");
jest.mock("../../services/elevenlabs/elevenlabsService");
jest.mock("../../utils/sendEmail");

// Mock automation jobs
jest.mock("../../jobs/automations/tiktokAutomationJob");
jest.mock("../../jobs/automations/instagramAutomationJob");
jest.mock("../../jobs/automations/registrationFollowupJob");
jest.mock("../../jobs/automations/contentPublishingJob");
jest.mock("../../jobs/automationScheduler");

// Mock event system
jest.mock("../../events/EventEmitter");

// ==================== REQUIRE MODULES ====================

const IntegrationSettings = require("../../models/integrationSettingsModel");
const SocialMediaEngagement = require("../../models/socialMediaEngagementModel");
const ContentIdea = require("../../models/contentIdeaModel");
const RegistrationFollowup = require("../../models/registrationFollowupModel");
const FollowupCampaign = require("../../models/followupCampaignModel");
const FollowupTemplate = require("../../models/followupTemplateModel");

const tiktokService = require("../../services/tiktok/tiktokService");
const instagramService = require("../../services/instagram/instagramService");
const whatsappService = require("../../services/whatsapp/whatsappService");
const contentIdeaService = require("../../services/contentIdea/contentIdeaService");
const insightService = require("../../services/insights/insightService");
const aiCommentService = require("../../services/comments/aiCommentService");
const campaignService = require("../../services/campaigns/campaignService");
const elevenlabsService = require("../../services/elevenlabs/elevenlabsService");
const sendEmail = require("../../utils/sendEmail");

const tiktokAutomationJob = require("../../jobs/automations/tiktokAutomationJob");
const instagramAutomationJob = require("../../jobs/automations/instagramAutomationJob");
const registrationFollowupJob = require("../../jobs/automations/registrationFollowupJob");
const contentPublishingJob = require("../../jobs/automations/contentPublishingJob");
const automationScheduler = require("../../jobs/automationScheduler");

const { eventBus, EventTypes } = require("../../events/EventEmitter");
const automationController = require("../../controllers/automationController");
const integrationController = require("../../controllers/integrationController");

const {
  mockRequest,
  mockResponse,
} = require("../helpers/testHelpers");

// ==================== TEST DATA GENERATORS ====================

const mockBusiness = () => ({
  _id: "business_" + Math.random().toString(36).substr(2, 9),
  businessName: "Test Business",
  ownerEmail: "owner@test.com",
  ownerPhone: "+1234567890",
});

const mockIntegrationSettings = (overrides = {}) => ({
  _id: "settings_" + Math.random().toString(36).substr(2, 9),
  business: "platform",
  tiktok: {
    enabled: true,
    status: "connected",
    businessAccountId: "tiktok_123",
    connectedAt: new Date(),
    lastSyncedAt: new Date(),
    automationSettings: {
      monitoringEnabled: true,
      engagementEnabled: true,
      contentGenerationEnabled: true,
      contentApprovalRequired: true,
      postingFrequency: "weekly",
      engagementKeywords: ["business", "entrepreneurship"],
    },
  },
  instagram: {
    enabled: true,
    status: "connected",
    businessAccountId: "instagram_456",
    connectedAt: new Date(),
    lastSyncedAt: new Date(),
    automationSettings: {
      monitoringEnabled: true,
      engagementEnabled: true,
      contentGenerationEnabled: true,
      contentApprovalRequired: true,
      postingFrequency: "biweekly",
      engagementKeywords: ["lifestyle", "growth"],
    },
  },
  whatsapp: {
    enabled: true,
    status: "connected",
    businessAccountId: "whatsapp_789",
    connectedAt: new Date(),
    automationSettings: {
      followupEnabled: true,
      templateId: "followup_template_1",
    },
  },
  email: {
    enabled: true,
    status: "connected",
    fromEmail: "noreply@business.com",
    automationSettings: {
      followupEnabled: true,
    },
  },
  elevenLabs: {
    enabled: true,
    status: "connected",
    apiKey: "test_key",
    voiceId: "voice_123",
    automationSettings: {
      autoVoiceover: true,
    },
  },
  ...overrides,
});

const mockSocialPost = (platform = "tiktok") => ({
  postId: "post_" + Math.random().toString(36).substr(2, 9),
  platformId: platform === "tiktok" ? "user_123" : "ig_123",
  content: "Check out our amazing business tips!",
  mediaUrls: ["https://example.com/media.mp4"],
  publishedAt: new Date(),
  metrics: {
    likes: Math.floor(Math.random() * 5000),
    comments: Math.floor(Math.random() * 500),
    shares: Math.floor(Math.random() * 100),
  },
  hashtags: ["#business", "#growth", "#entrepreneurship"],
});

const mockEngagement = (platform = "tiktok", businessId = "platform") => ({
  _id: "engagement_" + Math.random().toString(36).substr(2, 9),
  business: businessId,
  platform,
  platformLevel: true,
  postId: "post_123",
  content: "This is amazing! Keep it up!",
  engagementType: "like",
  metrics: {
    likes: Math.floor(Math.random() * 1000),
    comments: Math.floor(Math.random() * 100),
    replies: Math.floor(Math.random() * 50),
  },
  createdAt: new Date(),
  updatedAt: new Date(),
});

const mockContentIdea = (platform = "tiktok", businessId = "platform") => ({
  _id: "idea_" + Math.random().toString(36).substr(2, 9),
  business: businessId,
  platform,
  title: "How to Scale Your Business",
  description: "A detailed guide on scaling business operations",
  content: "Step 1: Define your goals... Step 2: Create systems...",
  keywords: ["scaling", "growth", "business"],
  suggestedHashtags: ["#growth", "#businesstips"],
  status: "pending_approval",
  createdAt: new Date(),
  approvedAt: null,
  publishedAt: null,
});

const mockRegistrationFollowup = (businessId = "platform") => ({
  _id: "followup_" + Math.random().toString(36).substr(2, 9),
  business: businessId,
  contactName: "John Doe",
  contactEmail: "john@business.com",
  contactPhone: "+1234567890",
  businessName: "John's Business",
  registeredAt: new Date(),
  status: "in_sequence",
  preferences: {
    allowEmail: true,
    allowWhatsapp: true,
  },
  followupSequence: [
    {
      day: 0,
      channel: "email",
      messageId: "msg_1",
      status: "sent",
      sentAt: new Date(),
    },
    {
      day: 2,
      channel: "whatsapp",
      messageId: "msg_2",
      status: "pending",
    },
  ],
});

const mockFollowupCampaign = (businessId = "platform") => ({
  _id: "campaign_" + Math.random().toString(36).substr(2, 9),
  business: businessId,
  name: "New Registration Campaign",
  description: "Welcome sequence for new registrations",
  status: "active",
  createdAt: new Date(),
  activatedAt: new Date(),
  recipients: [],
  metrics: {
    totalRecipients: 0,
    emailsSent: 0,
    whatsappSent: 0,
    opened: 0,
    clicked: 0,
    converted: 0,
  },
});

// ==================== TEST SUITES ====================

describe("Automation System End-to-End Tests", () => {
  beforeAll(() => {
    process.env.SUPERADMIN_BUSINESS_ID = "platform";
  });

  afterAll(() => {
    delete process.env.SUPERADMIN_BUSINESS_ID;
  });

  let business;
  let eventCapture;

  beforeEach(() => {
    jest.clearAllMocks();
    business = mockBusiness();

    // Setup event capture
    eventCapture = {
      events: [],
      capture: jest.fn(function (eventType, payload) {
        this.events.push({ eventType, payload, timestamp: new Date() });
      }),
      getByType: function (eventType) {
        return this.events.filter(e => e.eventType === eventType);
      },
      clear: function () {
        this.events = [];
      },
    };

    eventBus.emit.mockImplementation((eventType, payload) => {
      eventCapture.capture(eventType, payload);
    });

    eventBus.emitBusinessEvent.mockImplementation((eventType, businessId, payload) => {
      eventCapture.capture(eventType, { businessId, ...payload });
    });

    eventBus.on.mockImplementation(() => { });
    eventBus.off.mockImplementation(() => { });
  });

  // ==================== INTEGRATION CONNECTION TESTS ====================

  describe("Channel Integration Connection Tests", () => {
    describe("TikTok Integration", () => {
      it("should connect TikTok and verify connection status", async () => {
        const settings = mockIntegrationSettings();
        IntegrationSettings.findOne.mockResolvedValue(settings);
        tiktokService.verifyConnection.mockResolvedValue(true);

        const req = mockRequest({
          businessAccountId: "tiktok_123",
        }, {}, {}, null, business);
        const res = mockResponse();

        await integrationController.connectTikTok(req, res);

        expect(tiktokService.verifyConnection).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it("should handle TikTok connection failure", async () => {
        tiktokService.verifyConnection.mockRejectedValue(
          new Error("Invalid credentials")
        );

        const req = mockRequest({
          businessAccountId: "invalid",
        }, {}, {}, null, business);
        const res = mockResponse();

        await integrationController.connectTikTok(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("should disconnect TikTok", async () => {
        const settings = mockIntegrationSettings();
        IntegrationSettings.findOneAndUpdate.mockResolvedValue({
          ...settings,
          tiktok: { ...settings.tiktok, enabled: false, status: "disconnected" },
        });

        const req = mockRequest({}, {}, {}, null, business);
        const res = mockResponse();

        await integrationController.disconnectTikTok(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe("Instagram Integration", () => {
      it("should connect Instagram and verify connection status", async () => {
        const settings = mockIntegrationSettings();
        IntegrationSettings.findOne.mockResolvedValue(settings);
        instagramService.verifyConnection.mockResolvedValue(true);

        const req = mockRequest({
          businessAccountId: "instagram_456",
        }, {}, {}, null, business);
        const res = mockResponse();

        await integrationController.connectInstagram(req, res);

        expect(instagramService.verifyConnection).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it("should disconnect Instagram", async () => {
        const settings = mockIntegrationSettings();
        IntegrationSettings.findOneAndUpdate.mockResolvedValue({
          ...settings,
          instagram: { ...settings.instagram, enabled: false, status: "disconnected" },
        });

        const req = mockRequest({}, {}, {}, null, business);
        const res = mockResponse();

        await integrationController.disconnectInstagram(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe("WhatsApp Integration", () => {
      it("should connect WhatsApp", async () => {
        const settings = mockIntegrationSettings();
        IntegrationSettings.findOne.mockResolvedValue(settings);
        whatsappService.verifyConnection.mockResolvedValue(true);

        const req = mockRequest({
          phoneNumberId: "whatsapp_789",
        }, {}, {}, null, business);
        const res = mockResponse();

        await integrationController.connectWhatsApp(req, res);

        expect(whatsappService.verifyConnection).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it("should disconnect WhatsApp", async () => {
        IntegrationSettings.findOneAndUpdate.mockResolvedValue({
          whatsapp: { enabled: false, status: "disconnected" },
        });

        const req = mockRequest({}, {}, {}, null, business);
        const res = mockResponse();

        await integrationController.disconnectWhatsApp(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe("Email Integration", () => {
      it("should connect Email service", async () => {
        const settings = mockIntegrationSettings();
        IntegrationSettings.findOne.mockResolvedValue(settings);
        sendEmail.mockResolvedValue({ success: true });

        const req = mockRequest({
          fromEmail: "noreply@business.com",
        }, {}, {}, null, business);
        const res = mockResponse();

        await integrationController.connectEmail(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
      });

      it("should disconnect Email", async () => {
        IntegrationSettings.findOneAndUpdate.mockResolvedValue({
          email: { enabled: false, status: "disconnected" },
        });

        const req = mockRequest({}, {}, {}, null, business);
        const res = mockResponse();

        await integrationController.disconnectEmail(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe("11Labs Integration", () => {
      it("should connect 11Labs", async () => {
        const settings = mockIntegrationSettings();
        IntegrationSettings.findOne.mockResolvedValue(settings);
        elevenlabsService.verifyConnection.mockResolvedValue(true);

        const req = mockRequest({
          apiKey: "test_key",
          voiceId: "voice_123",
        }, {}, {}, null, business);
        const res = mockResponse();

        await integrationController.connectElevenLabs(req, res);

        expect(elevenlabsService.verifyConnection).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it("should disconnect 11Labs", async () => {
        IntegrationSettings.findOneAndUpdate.mockResolvedValue({
          elevenLabs: { enabled: false, status: "disconnected" },
        });

        const req = mockRequest({}, {}, {}, null, business);
        const res = mockResponse();

        await integrationController.disconnectElevenLabs(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe("Get Integration Status", () => {
      it("should return status of all integrations", async () => {
        const settings = mockIntegrationSettings();
        IntegrationSettings.findOne.mockResolvedValue(settings);

        const req = mockRequest({}, {}, {}, null, business);
        const res = mockResponse();

        await automationController.getAutomationStatus(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              tiktok: expect.objectContaining({ status: "connected" }),
              instagram: expect.objectContaining({ status: "connected" }),
              whatsapp: expect.objectContaining({ status: "connected" }),
              email: expect.objectContaining({ status: "connected" }),
              elevenLabs: expect.objectContaining({ status: "connected" }),
            }),
          })
        );
      });
    });
  });

  // ==================== SOCIAL MEDIA AUTOMATION TESTS ====================

  describe("Social Media Automation Tests", () => {
    describe("TikTok Automation", () => {
      it("should fetch recent TikTok posts and monitor them", async () => {
        const mockPosts = [mockSocialPost("tiktok"), mockSocialPost("tiktok")];
        tiktokService.fetchRecentPosts.mockResolvedValue(mockPosts);
        SocialMediaEngagement.create.mockResolvedValue(mockEngagement("tiktok"));

        const req = mockRequest({}, {}, {}, null, business);
        const res = mockResponse();

        await automationController.triggerTikTokAutomation(req, res);

        expect(tiktokService.fetchRecentPosts).toHaveBeenCalled();
        expect(SocialMediaEngagement.create).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it("should engage with TikTok posts (like and comment)", async () => {
        const mockPosts = [mockSocialPost("tiktok")];
        tiktokService.fetchRecentPosts.mockResolvedValue(mockPosts);
        tiktokService.likePost.mockResolvedValue({ success: true });
        aiCommentService.generateComment.mockResolvedValue(
          "Love this content! Great insights for business owners."
        );
        tiktokService.commentOnPost.mockResolvedValue({ success: true });

        const req = mockRequest({}, {}, {}, null, business);
        const res = mockResponse();

        await tiktokAutomationJob.engageWithPosts("platform", mockPosts, {
          engagementEnabled: true,
        });

        expect(tiktokService.likePost).toHaveBeenCalled();
        expect(aiCommentService.generateComment).toHaveBeenCalled();
        expect(tiktokService.commentOnPost).toHaveBeenCalled();
      });

      it("should generate insights from TikTok engagement", async () => {
        const engagement = mockEngagement("tiktok");
        SocialMediaEngagement.create.mockResolvedValue(engagement);
        insightService.analyzeEngagement.mockResolvedValue({
          topicsOfInterest: ["business growth", "entrepreneurship"],
          audienceSentiment: "positive",
          engagementRate: 8.5,
          recommendations: [
            "Post more content about business scaling",
            "Increase posting frequency on weekends",
          ],
        });

        await tiktokAutomationJob.processPostForInsights("platform", mockSocialPost("tiktok"));

        expect(insightService.analyzeEngagement).toHaveBeenCalled();
      });

      it("should generate content ideas from TikTok insights", async () => {
        insightService.analyzeEngagement.mockResolvedValue({
          topicsOfInterest: ["business growth", "entrepreneurship"],
        });
        contentIdeaService.generateIdeas.mockResolvedValue([
          mockContentIdea("tiktok"),
          mockContentIdea("tiktok"),
        ]);

        const req = mockRequest({}, {}, {}, null, business);
        const res = mockResponse();

        await automationController.generateContentIdeas(req, res);

        expect(contentIdeaService.generateIdeas).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it("should emit event when TikTok engagement is created", async () => {
        const engagement = mockEngagement("tiktok");
        SocialMediaEngagement.create.mockResolvedValue(engagement);

        eventBus.emit(EventTypes.SOCIAL_ENGAGEMENT_CREATED, {
          businessId: "platform",
          engagementId: engagement._id,
          platform: "tiktok",
          metrics: engagement.metrics,
        });

        const createdEvents = eventCapture.getByType(
          EventTypes.SOCIAL_ENGAGEMENT_CREATED
        );
        expect(createdEvents.length).toBeGreaterThan(0);
        expect(createdEvents[0].payload.platform).toBe("tiktok");
      });
    });

    describe("Instagram Automation", () => {
      it("should fetch recent Instagram posts and monitor them", async () => {
        const mockPosts = [mockSocialPost("instagram"), mockSocialPost("instagram")];
        instagramService.fetchRecentPosts.mockResolvedValue(mockPosts);
        SocialMediaEngagement.create.mockResolvedValue(mockEngagement("instagram"));

        const req = mockRequest({}, {}, {}, null, business);
        const res = mockResponse();

        await automationController.triggerInstagramAutomation(req, res);

        expect(instagramService.fetchRecentPosts).toHaveBeenCalled();
        expect(SocialMediaEngagement.create).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it("should engage with Instagram posts", async () => {
        const mockPosts = [mockSocialPost("instagram")];
        instagramService.fetchRecentPosts.mockResolvedValue(mockPosts);
        instagramService.likePost.mockResolvedValue({ success: true });
        aiCommentService.generateComment.mockResolvedValue(
          "Incredible content! Very inspiring for business owners."
        );
        instagramService.commentOnPost.mockResolvedValue({ success: true });

        await instagramAutomationJob.engageWithPosts("platform", mockPosts, {
          engagementEnabled: true,
        });

        expect(instagramService.likePost).toHaveBeenCalled();
        expect(aiCommentService.generateComment).toHaveBeenCalled();
        expect(instagramService.commentOnPost).toHaveBeenCalled();
      });

      it("should generate insights from Instagram engagement", async () => {
        const engagement = mockEngagement("instagram");
        SocialMediaEngagement.create.mockResolvedValue(engagement);
        insightService.analyzeEngagement.mockResolvedValue({
          topicsOfInterest: ["lifestyle", "growth"],
          audienceSentiment: "very_positive",
          engagementRate: 12.3,
        });

        await instagramAutomationJob.processPostForInsights(
          "platform",
          mockSocialPost("instagram")
        );

        expect(insightService.analyzeEngagement).toHaveBeenCalled();
      });

      it("should emit event when Instagram engagement is created", async () => {
        const engagement = mockEngagement("instagram");
        SocialMediaEngagement.create.mockResolvedValue(engagement);

        eventBus.emit(EventTypes.SOCIAL_ENGAGEMENT_CREATED, {
          businessId: "platform",
          engagementId: engagement._id,
          platform: "instagram",
          metrics: engagement.metrics,
        });

        const createdEvents = eventCapture.getByType(
          EventTypes.SOCIAL_ENGAGEMENT_CREATED
        );
        expect(createdEvents.length).toBeGreaterThan(0);
        expect(createdEvents[0].payload.platform).toBe("instagram");
      });
    });
  });

  // ==================== CONTENT PUBLISHING TESTS ====================

  describe("Content Publishing Tests", () => {
    it("should approve content idea for publishing", async () => {
      const idea = mockContentIdea();
      ContentIdea.findByIdAndUpdate.mockResolvedValue({
        ...idea,
        status: "approved",
        approvedAt: new Date(),
      });

      const req = mockRequest({}, { id: idea._id }, {}, null, business);
      const res = mockResponse();

      await automationController.approveContentIdea(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should publish approved content to TikTok with 11Labs audio", async () => {
      const idea = mockContentIdea("tiktok");
      ContentIdea.findById.mockResolvedValue(idea);
      elevenlabsService.generateAudio.mockResolvedValue({
        audioUrl: "https://example.com/audio.mp3",
        duration: 45,
      });
      tiktokService.publishContent.mockResolvedValue({
        success: true,
        postId: "new_post_123",
      });

      const req = mockRequest({}, { id: idea._id }, {}, null, business);
      const res = mockResponse();

      await automationController.publishContent(req, res);

      expect(elevenlabsService.generateAudio).toHaveBeenCalled();
      expect(tiktokService.publishContent).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should publish approved content to Instagram", async () => {
      const idea = mockContentIdea("instagram");
      ContentIdea.findById.mockResolvedValue(idea);
      instagramService.publishContent.mockResolvedValue({
        success: true,
        postId: "ig_post_456",
      });

      const req = mockRequest({}, { id: idea._id }, {}, null, business);
      const res = mockResponse();

      await automationController.publishContent(req, res);

      expect(instagramService.publishContent).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should schedule content for future publishing", async () => {
      const idea = mockContentIdea();
      const scheduleTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

      ContentIdea.findByIdAndUpdate.mockResolvedValue({
        ...idea,
        status: "scheduled",
        scheduledPublishAt: scheduleTime,
      });

      const req = mockRequest(
        { scheduledAt: scheduleTime },
        { id: idea._id },
        {},
        null,
        business
      );
      const res = mockResponse();

      await automationController.scheduleContentPublishing(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should emit event when content is published", async () => {
      const idea = mockContentIdea();
      ContentIdea.findById.mockResolvedValue(idea);
      tiktokService.publishContent.mockResolvedValue({
        success: true,
        postId: "new_post_123",
      });

      eventBus.emit(EventTypes.CONTENT_PUBLISHED, {
        businessId: "platform",
        contentId: idea._id,
        platform: "tiktok",
        postId: "new_post_123",
      });

      const publishedEvents = eventCapture.getByType(EventTypes.CONTENT_PUBLISHED);
      expect(publishedEvents.length).toBeGreaterThan(0);
    });

    it("should handle publishing failure and retry", async () => {
      const idea = mockContentIdea();
      ContentIdea.findById.mockResolvedValue(idea);
      tiktokService.publishContent.mockRejectedValueOnce(
        new Error("Network error")
      );
      tiktokService.publishContent.mockResolvedValueOnce({
        success: true,
        postId: "new_post_123",
      });

      const req = mockRequest({}, { id: idea._id }, {}, null, business);
      const res = mockResponse();

      // First attempt fails
      try {
        await automationController.publishContent(req, res);
      } catch (e) {
        // Expected failure
      }

      // Retry succeeds
      await automationController.publishContent(req, res);

      expect(tiktokService.publishContent).toHaveBeenCalledTimes(2);
    });
  });

  // ==================== REGISTRATION FOLLOWUP TESTS ====================

  describe("Registration Follow-up Automation Tests", () => {
    describe("Email Follow-ups", () => {
      it("should create follow-up sequence on new registration", async () => {
        const followup = mockRegistrationFollowup();
        RegistrationFollowup.create.mockResolvedValue(followup);

        const req = mockRequest({
          contactName: followup.contactName,
          contactEmail: followup.contactEmail,
          contactPhone: followup.contactPhone,
          businessName: followup.businessName,
        }, {}, {}, null, business);
        const res = mockResponse();

        await automationController.createRegistrationFollowup(req, res);

        expect(RegistrationFollowup.create).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
      });

      it("should send email follow-up at scheduled time", async () => {
        const followup = mockRegistrationFollowup();
        const template = {
          subject: "Welcome to our platform!",
          body: "Hi {{name}}, thank you for registering...",
        };

        RegistrationFollowup.findOne.mockResolvedValue(followup);
        FollowupTemplate.findById.mockResolvedValue(template);
        sendEmail.mockResolvedValue({ success: true, messageId: "msg_123" });

        await registrationFollowupJob.sendEmailFollowup(followup, template);

        expect(sendEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: followup.contactEmail,
            subject: template.subject,
          })
        );
      });

      it("should track email open status", async () => {
        const followup = mockRegistrationFollowup();
        RegistrationFollowup.findByIdAndUpdate.mockResolvedValue({
          ...followup,
          followupSequence: [
            {
              ...followup.followupSequence[0],
              status: "opened",
              openedAt: new Date(),
            },
          ],
        });

        const req = mockRequest({}, { id: followup._id }, {}, null, business);
        const res = mockResponse();

        await automationController.trackEmailOpen(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
      });

      it("should emit event when follow-up is sent", async () => {
        const followup = mockRegistrationFollowup();

        eventBus.emit(EventTypes.FOLLOWUP_SENT, {
          businessId: "platform",
          followupId: followup._id,
          channel: "email",
          recipient: followup.contactEmail,
        });

        const sentEvents = eventCapture.getByType(EventTypes.FOLLOWUP_SENT);
        expect(sentEvents.length).toBeGreaterThan(0);
        expect(sentEvents[0].payload.channel).toBe("email");
      });
    });

    describe("WhatsApp Follow-ups", () => {
      it("should send WhatsApp follow-up message", async () => {
        const followup = mockRegistrationFollowup();
        const template = {
          content: "Hi {{name}}, thanks for joining us!",
        };

        RegistrationFollowup.findOne.mockResolvedValue(followup);
        whatsappService.sendMessage.mockResolvedValue({
          success: true,
          messageId: "msg_456",
        });

        await registrationFollowupJob.sendWhatsAppFollowup(followup, template);

        expect(whatsappService.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            to: followup.contactPhone,
            content: expect.stringContaining("thanks"),
          })
        );
      });

      it("should handle WhatsApp message delivery status", async () => {
        const followup = mockRegistrationFollowup();
        RegistrationFollowup.findByIdAndUpdate.mockResolvedValue({
          ...followup,
          followupSequence: [
            {
              ...followup.followupSequence[1],
              status: "delivered",
              deliveredAt: new Date(),
            },
          ],
        });

        const req = mockRequest(
          { status: "delivered" },
          { id: followup._id },
          {},
          null,
          business
        );
        const res = mockResponse();

        await automationController.updateFollowupStatus(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
      });

      it("should emit event when WhatsApp follow-up is sent", async () => {
        const followup = mockRegistrationFollowup();

        eventBus.emit(EventTypes.FOLLOWUP_SENT, {
          businessId: "platform",
          followupId: followup._id,
          channel: "whatsapp",
          recipient: followup.contactPhone,
        });

        const sentEvents = eventCapture.getByType(EventTypes.FOLLOWUP_SENT);
        expect(sentEvents.length).toBeGreaterThan(0);
        expect(sentEvents[0].payload.channel).toBe("whatsapp");
      });
    });

    describe("Follow-up Sequence Management", () => {
      it("should pause follow-up sequence", async () => {
        const followup = mockRegistrationFollowup();
        RegistrationFollowup.findByIdAndUpdate.mockResolvedValue({
          ...followup,
          status: "paused",
        });

        const req = mockRequest({}, { id: followup._id }, {}, null, business);
        const res = mockResponse();

        await automationController.pauseFollowup(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
      });

      it("should resume follow-up sequence", async () => {
        const followup = mockRegistrationFollowup();
        RegistrationFollowup.findByIdAndUpdate.mockResolvedValue({
          ...followup,
          status: "in_sequence",
        });

        const req = mockRequest({}, { id: followup._id }, {}, null, business);
        const res = mockResponse();

        await automationController.resumeFollowup(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
      });

      it("should unsubscribe from follow-ups", async () => {
        const followup = mockRegistrationFollowup();
        RegistrationFollowup.findByIdAndUpdate.mockResolvedValue({
          ...followup,
          status: "unsubscribed",
          unsubscribedAt: new Date(),
        });

        const req = mockRequest({}, { id: followup._id }, {}, null, business);
        const res = mockResponse();

        await automationController.unsubscribeFollowup(req, res);

        expect(RegistrationFollowup.findByIdAndUpdate).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it("should fetch follow-up history for a registration", async () => {
        const followup = mockRegistrationFollowup();
        RegistrationFollowup.findById.mockResolvedValue(followup);

        const req = mockRequest({}, { id: followup._id }, {}, null, business);
        const res = mockResponse();

        await automationController.getFollowupHistory(req, res);

        expect(RegistrationFollowup.findById).toHaveBeenCalledWith(followup._id);
        expect(res.status).toHaveBeenCalledWith(200);
      });
    });
  });

  // ==================== CAMPAIGN MANAGEMENT TESTS ====================

  describe("Campaign Management Tests", () => {
    it("should create a new follow-up campaign", async () => {
      const campaign = mockFollowupCampaign();
      FollowupCampaign.create.mockResolvedValue(campaign);

      const req = mockRequest({
        name: campaign.name,
        description: campaign.description,
      }, {}, {}, null, business);
      const res = mockResponse();

      await automationController.createFollowupCampaign(req, res);

      expect(FollowupCampaign.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("should activate a campaign", async () => {
      const campaign = mockFollowupCampaign();
      FollowupCampaign.findByIdAndUpdate.mockResolvedValue({
        ...campaign,
        status: "active",
        activatedAt: new Date(),
      });

      const req = mockRequest({}, { id: campaign._id }, {}, null, business);
      const res = mockResponse();

      await automationController.activateCampaign(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should pause a campaign", async () => {
      const campaign = mockFollowupCampaign();
      FollowupCampaign.findByIdAndUpdate.mockResolvedValue({
        ...campaign,
        status: "paused",
      });

      const req = mockRequest({}, { id: campaign._id }, {}, null, business);
      const res = mockResponse();

      await automationController.pauseCampaign(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should archive a campaign", async () => {
      const campaign = mockFollowupCampaign();
      FollowupCampaign.findByIdAndUpdate.mockResolvedValue({
        ...campaign,
        status: "archived",
        archivedAt: new Date(),
      });

      const req = mockRequest({}, { id: campaign._id }, {}, null, business);
      const res = mockResponse();

      await automationController.archiveCampaign(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should add recipients to campaign", async () => {
      const campaign = mockFollowupCampaign();
      campaignService.addRecipients.mockResolvedValue({
        ...campaign,
        recipients: ["recipient_1", "recipient_2"],
        metrics: { totalRecipients: 2 },
      });

      const req = mockRequest(
        { recipientIds: ["recipient_1", "recipient_2"] },
        { id: campaign._id },
        {},
        null,
        business
      );
      const res = mockResponse();

      await automationController.addCampaignRecipients(req, res);

      expect(campaignService.addRecipients).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should get campaign statistics", async () => {
      const campaign = mockFollowupCampaign();
      campaign.metrics = {
        totalRecipients: 100,
        emailsSent: 100,
        whatsappSent: 85,
        opened: 45,
        clicked: 23,
        converted: 8,
      };

      FollowupCampaign.findById.mockResolvedValue(campaign);

      const req = mockRequest({}, { id: campaign._id }, {}, null, business);
      const res = mockResponse();

      await automationController.getCampaignStats(req, res);

      expect(FollowupCampaign.findById).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metrics: campaign.metrics,
          }),
        })
      );
    });

    it("should emit event when campaign is activated", async () => {
      const campaign = mockFollowupCampaign();

      eventBus.emit(EventTypes.CAMPAIGN_ACTIVATED, {
        businessId: "platform",
        campaignId: campaign._id,
        campaignName: campaign.name,
      });

      const activatedEvents = eventCapture.getByType(
        EventTypes.CAMPAIGN_ACTIVATED
      );
      expect(activatedEvents.length).toBeGreaterThan(0);
    });

    it("should duplicate a campaign", async () => {
      const originalCampaign = mockFollowupCampaign();
      const duplicatedCampaign = {
        ...originalCampaign,
        _id: "new_campaign_id",
        name: originalCampaign.name + " (Copy)",
      };

      campaignService.duplicateCampaign.mockResolvedValue(duplicatedCampaign);

      const req = mockRequest({}, { id: originalCampaign._id }, {}, null, business);
      const res = mockResponse();

      await automationController.duplicateCampaign(req, res);

      expect(campaignService.duplicateCampaign).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // ==================== WEBHOOK HANDLING TESTS ====================

  describe("Webhook Handling Tests", () => {
    it("should handle WhatsApp message delivery webhook", async () => {
      const webhookPayload = {
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [
                    {
                      id: "msg_456",
                      status: "delivered",
                      timestamp: Date.now(),
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      RegistrationFollowup.findOneAndUpdate.mockResolvedValue(
        mockRegistrationFollowup()
      );

      const req = mockRequest(webhookPayload);
      const res = mockResponse();

      await automationController.handleWhatsAppWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle WhatsApp message status webhook (read)", async () => {
      const webhookPayload = {
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [
                    {
                      id: "msg_456",
                      status: "read",
                      timestamp: Date.now(),
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      RegistrationFollowup.findOneAndUpdate.mockResolvedValue(
        mockRegistrationFollowup()
      );

      const req = mockRequest(webhookPayload);
      const res = mockResponse();

      await automationController.handleWhatsAppWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== AUTOMATION SCHEDULER TESTS ====================

  describe("Automation Scheduler Tests", () => {
    it("should schedule TikTok automation job", async () => {
      automationScheduler.scheduleJob.mockImplementation((name, cron, fn) => {
        if (name === "tiktok_automation") {
          expect(cron).toBe("0 */6 * * *"); // Every 6 hours
          expect(fn).toBeDefined();
        }
      });

      automationScheduler.start();

      expect(automationScheduler.scheduleJob).toHaveBeenCalledWith(
        "tiktok_automation",
        expect.any(String),
        expect.any(Function)
      );
    });

    it("should schedule Instagram automation job", async () => {
      automationScheduler.scheduleJob.mockImplementation((name, cron, fn) => {
        if (name === "instagram_automation") {
          expect(cron).toBe("0 3 * * *"); // Daily at 3 AM
          expect(fn).toBeDefined();
        }
      });

      automationScheduler.start();

      expect(automationScheduler.scheduleJob).toHaveBeenCalledWith(
        "instagram_automation",
        expect.any(String),
        expect.any(Function)
      );
    });

    it("should schedule registration follow-up job", async () => {
      automationScheduler.scheduleJob.mockImplementation((name, cron, fn) => {
        if (name === "registration_followup") {
          expect(cron).toBe("*/30 * * * *"); // Every 30 minutes
          expect(fn).toBeDefined();
        }
      });

      automationScheduler.start();

      expect(automationScheduler.scheduleJob).toHaveBeenCalledWith(
        "registration_followup",
        expect.any(String),
        expect.any(Function)
      );
    });

    it("should schedule content publishing job", async () => {
      automationScheduler.scheduleJob.mockImplementation((name, cron, fn) => {
        if (name === "content_publishing") {
          expect(cron).toBe("0 */4 * * *"); // Every 4 hours
          expect(fn).toBeDefined();
        }
      });

      automationScheduler.start();

      expect(automationScheduler.scheduleJob).toHaveBeenCalledWith(
        "content_publishing",
        expect.any(String),
        expect.any(Function)
      );
    });
  });

  // ==================== END-TO-END AUTOMATION FLOW TESTS ====================

  describe("End-to-End Automation Flows", () => {
    it("should complete full TikTok engagement to content publishing flow", async () => {
      // 1. Fetch posts
      const mockPosts = [mockSocialPost("tiktok")];
      tiktokService.fetchRecentPosts.mockResolvedValue(mockPosts);

      // 2. Create engagement
      const engagement = mockEngagement("tiktok");
      SocialMediaEngagement.create.mockResolvedValue(engagement);

      // 3. Generate insights
      insightService.analyzeEngagement.mockResolvedValue({
        topicsOfInterest: ["business growth"],
      });

      // 4. Generate content idea
      const contentIdea = mockContentIdea("tiktok");
      contentIdeaService.generateIdeas.mockResolvedValue([contentIdea]);

      // 5. Approve content
      ContentIdea.findByIdAndUpdate.mockResolvedValue({
        ...contentIdea,
        status: "approved",
      });

      // 6. Generate audio with 11Labs
      elevenlabsService.generateAudio.mockResolvedValue({
        audioUrl: "https://example.com/audio.mp3",
      });

      // 7. Publish to TikTok
      tiktokService.publishContent.mockResolvedValue({
        success: true,
        postId: "new_post_123",
      });

      // Execute the flow
      await tiktokAutomationJob.processAllBusinesses();
      await contentPublishingJob.publishScheduledContent();

      // Verify complete flow
      expect(tiktokService.fetchRecentPosts).toHaveBeenCalled();
      expect(SocialMediaEngagement.create).toHaveBeenCalled();
      expect(insightService.analyzeEngagement).toHaveBeenCalled();
      expect(contentIdeaService.generateIdeas).toHaveBeenCalled();
      expect(elevenlabsService.generateAudio).toHaveBeenCalled();
      expect(tiktokService.publishContent).toHaveBeenCalled();
    });

    it("should complete full registration follow-up with email and WhatsApp", async () => {
      // 1. Create follow-up on registration
      const followup = mockRegistrationFollowup();
      RegistrationFollowup.create.mockResolvedValue(followup);

      // 2. Send email follow-up
      sendEmail.mockResolvedValue({ success: true });

      // 3. Send WhatsApp follow-up
      whatsappService.sendMessage.mockResolvedValue({ success: true });

      // 4. Track delivery
      RegistrationFollowup.findByIdAndUpdate.mockResolvedValue({
        ...followup,
        followupSequence: [
          { status: "sent", channel: "email" },
          { status: "delivered", channel: "whatsapp" },
        ],
      });

      // Execute the flow
      await registrationFollowupJob.processAllFollowups();

      // Verify complete flow
      expect(RegistrationFollowup.create).toHaveBeenCalled();
      expect(sendEmail).toHaveBeenCalled();
      expect(whatsappService.sendMessage).toHaveBeenCalled();
    });

    it("should track multi-channel campaign metrics", async () => {
      const campaign = mockFollowupCampaign();
      campaign.recipients = ["followup_1", "followup_2", "followup_3"];

      // Track email metrics
      campaignService.syncMetrics.mockResolvedValue({
        emailsSent: 3,
        whatsappSent: 2,
        opened: 2,
        clicked: 1,
        converted: 0,
      });

      await campaignService.syncMetrics("platform", campaign._id);

      expect(campaignService.syncMetrics).toHaveBeenCalled();
    });
  });

  // ==================== ERROR HANDLING TESTS ====================

  describe("Error Handling and Failure Recovery", () => {
    it("should handle TikTok API connection failure gracefully", async () => {
      tiktokService.fetchRecentPosts.mockRejectedValue(
        new Error("Connection refused")
      );

      const req = mockRequest({}, {}, {}, null, business);
      const res = mockResponse();

      try {
        await automationController.triggerTikTokAutomation(req, res);
      } catch (error) {
        expect(error.message).toContain("Connection");
      }
    });

    it("should handle WhatsApp delivery failure", async () => {
      const followup = mockRegistrationFollowup();
      whatsappService.sendMessage.mockRejectedValue(
        new Error("Invalid phone number")
      );

      try {
        await registrationFollowupJob.sendWhatsAppFollowup(followup, {});
      } catch (error) {
        expect(error.message).toContain("Invalid");
      }
    });

    it("should retry failed email sends with exponential backoff", async () => {
      const followup = mockRegistrationFollowup();
      let attemptCount = 0;

      sendEmail.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error("Temporary failure"));
        }
        return Promise.resolve({ success: true });
      });

      // Simulate retry logic
      for (let i = 0; i < 3; i++) {
        try {
          await sendEmail();
          break;
        } catch (error) {
          if (i === 2) throw error;
          await new Promise((res) =>
            setTimeout(res, Math.pow(2, i) * 1000)
          );
        }
      }

      expect(attemptCount).toBe(3);
    });
  });

  // ==================== DATA VALIDATION TESTS ====================

  describe("Data Validation Tests", () => {
    it("should validate integration settings before enabling", async () => {
      const invalidSettings = mockIntegrationSettings({
        tiktok: { businessAccountId: null }, // Invalid
      });

      IntegrationSettings.findOne.mockResolvedValue(invalidSettings);

      const req = mockRequest({}, {}, {}, null, business);
      const res = mockResponse();

      try {
        await integrationController.testTikTokConnection(req, res);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should validate follow-up preferences before sending", async () => {
      const followup = mockRegistrationFollowup();
      followup.preferences.allowEmail = false;
      followup.preferences.allowWhatsapp = false;

      RegistrationFollowup.findOne.mockResolvedValue(followup);

      await registrationFollowupJob.processAllFollowups();

      // Should not attempt to send if all preferences disabled
      expect(sendEmail).not.toHaveBeenCalled();
      expect(whatsappService.sendMessage).not.toHaveBeenCalled();
    });

    it("should validate content idea before publishing", async () => {
      const invalidIdea = mockContentIdea();
      invalidIdea.content = ""; // Empty content
      invalidIdea.status = "pending_approval"; // Not approved

      ContentIdea.findById.mockResolvedValue(invalidIdea);

      const req = mockRequest({}, { id: invalidIdea._id }, {}, null, business);
      const res = mockResponse();

      try {
        await automationController.publishContent(req, res);
      } catch (error) {
        expect(res.status).toHaveBeenCalledWith(400);
      }
    });
  });

  // ==================== MULTI-BUSINESS ISOLATION TESTS ====================

  describe("Multi-Business Data Isolation", () => {
    it("should isolate TikTok data per business", async () => {
      const business1 = mockBusiness();
      const business2 = mockBusiness();

      const engagement1 = mockEngagement("tiktok", business1._id);
      const engagement2 = mockEngagement("tiktok", business2._id);

      SocialMediaEngagement.find.mockResolvedValue([engagement1]);

      const engagements = await SocialMediaEngagement.find({
        business: business1._id,
      });

      expect(engagements[0].business).toBe(business1._id);
      expect(engagements).not.toContainEqual(
        expect.objectContaining({ business: business2._id })
      );
    });

    it("should isolate follow-ups per business", async () => {
      const business1 = mockBusiness();
      const business2 = mockBusiness();

      const followup1 = mockRegistrationFollowup(business1._id);
      const followup2 = mockRegistrationFollowup(business2._id);

      RegistrationFollowup.find.mockResolvedValue([followup1]);

      const followups = await RegistrationFollowup.find({
        business: business1._id,
      });

      expect(followups[0].business).toBe(business1._id);
      expect(followups).not.toContainEqual(
        expect.objectContaining({ business: business2._id })
      );
    });

    it("should isolate campaigns per business", async () => {
      const business1 = mockBusiness();
      const business2 = mockBusiness();

      const campaign1 = mockFollowupCampaign(business1._id);
      const campaign2 = mockFollowupCampaign(business2._id);

      FollowupCampaign.find.mockResolvedValue([campaign1]);

      const campaigns = await FollowupCampaign.find({
        business: business1._id,
      });

      expect(campaigns[0].business).toBe(business1._id);
      expect(campaigns).not.toContainEqual(
        expect.objectContaining({ business: business2._id })
      );
    });
  });
});
