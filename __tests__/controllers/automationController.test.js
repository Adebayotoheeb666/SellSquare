// Mock models
jest.mock("../../models/integrationSettingsModel");
jest.mock("../../models/socialMediaEngagementModel");
jest.mock("../../models/contentIdeaModel");
jest.mock("../../models/registrationFollowupModel");
jest.mock("../../models/followupTemplateModel");
jest.mock("../../models/followupCampaignModel");

// Mock services
jest.mock("../../services/tiktok/tiktokService");
jest.mock("../../services/instagram/instagramService");
jest.mock("../../services/whatsapp/whatsappService");
jest.mock("../../services/contentIdea/contentIdeaService");
jest.mock("../../services/campaigns/campaignService");
jest.mock("../../services/elevenlabs/elevenlabsService");

// Mock jobs
jest.mock("../../jobs/automations/tiktokAutomationJob");
jest.mock("../../jobs/automations/instagramAutomationJob");
jest.mock("../../jobs/automations/registrationFollowupJob");
jest.mock("../../jobs/automations/contentPublishingJob");
jest.mock("../../jobs/automationScheduler");

// Now require modules after mocks are set up
const IntegrationSettings = require("../../models/integrationSettingsModel");
const SocialMediaEngagement = require("../../models/socialMediaEngagementModel");
const ContentIdea = require("../../models/contentIdeaModel");
const RegistrationFollowup = require("../../models/registrationFollowupModel");
const FollowupTemplate = require("../../models/followupTemplateModel");
const FollowupCampaign = require("../../models/followupCampaignModel");
const tiktokService = require("../../services/tiktok/tiktokService");
const instagramService = require("../../services/instagram/instagramService");
const whatsappService = require("../../services/whatsapp/whatsappService");
const contentIdeaService = require("../../services/contentIdea/contentIdeaService");
const campaignService = require("../../services/campaigns/campaignService");
const elevenlabsService = require("../../services/elevenlabs/elevenlabsService");
const tiktokAutomationJob = require("../../jobs/automations/tiktokAutomationJob");
const instagramAutomationJob = require("../../jobs/automations/instagramAutomationJob");
const registrationFollowupJob = require("../../jobs/automations/registrationFollowupJob");
const contentPublishingJob = require("../../jobs/automations/contentPublishingJob");
const automationScheduler = require("../../jobs/automationScheduler");
const {
  mockRequest,
  mockResponse,
} = require("../helpers/testHelpers");
const automationController = require("../../controllers/automationController");

describe("Automation Controller Tests", () => {
  let mockBusiness;

  beforeAll(() => {
    process.env.SUPERADMIN_BUSINESS_ID = "platform";
  });

  afterAll(() => {
    delete process.env.SUPERADMIN_BUSINESS_ID;
  });

  beforeEach(() => {
    mockBusiness = {
      _id: "business123",
      businessName: "Test Business",
    };
    jest.clearAllMocks();
  });

  // ==================== getAutomationStatus ====================

  describe("getAutomationStatus", () => {
    it("should return automation status with all integrations", async () => {
      const mockSettings = {
        _id: "settings123",
        business: "platform",
        tiktok: {
          status: "connected",
          automationSettings: { monitoringEnabled: true },
          lastSyncedAt: new Date("2024-01-15"),
        },
        instagram: {
          status: "connected",
          automationSettings: { monitoringEnabled: false },
          lastSyncedAt: new Date("2024-01-14"),
        },
        whatsapp: {
          status: "disconnected",
          automationSettings: { followupEnabled: false },
        },
        email: {
          status: "connected",
          automationSettings: { followupEnabled: true },
        },
        elevenLabs: {
          status: "disconnected",
        },
      };

      IntegrationSettings.findOne.mockResolvedValue(mockSettings);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.getAutomationStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          integrations: {
            tiktok: "connected",
            instagram: "connected",
            whatsapp: "disconnected",
            email: "connected",
            elevenlabs: "disconnected",
          },
          automationsEnabled: {
            tiktok: true,
            instagram: false,
            whatsapp: false,
            email: true,
          },
          lastSyncedAt: expect.objectContaining({
            tiktok: mockSettings.tiktok.lastSyncedAt,
            instagram: mockSettings.instagram.lastSyncedAt,
          }),
        }),
      });
    });

    it("should handle missing integration settings", async () => {
      IntegrationSettings.findOne.mockResolvedValue(null);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.getAutomationStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          integrations: {
            tiktok: "disconnected",
            instagram: "disconnected",
            whatsapp: "disconnected",
            email: "disconnected",
            elevenlabs: "disconnected",
          },
        }),
      });
    });
  });

  // ==================== getJobStatus ====================

  describe("getJobStatus", () => {
    it("should return scheduler status", async () => {
      const mockStatus = {
        isRunning: true,
        jobs: [
          { name: "tiktokAutomation", lastRun: new Date(), nextRun: new Date() },
          { name: "instagramAutomation", lastRun: new Date(), nextRun: new Date() },
        ],
      };

      automationScheduler.getStatus.mockReturnValue(mockStatus);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.getJobStatus(req, res);

      expect(automationScheduler.getStatus).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockStatus,
      });
    });
  });

  // ==================== Integration Testing ====================

  describe("testTikTokConnection", () => {
    it("should test TikTok connection", async () => {
      const mockResult = { connected: true, accountId: "account123" };
      tiktokService.testConnection.mockResolvedValue(mockResult);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.testTikTokConnection(req, res);

      expect(tiktokService.testConnection).toHaveBeenCalledWith("platform");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });
  });

  describe("testInstagramConnection", () => {
    it("should test Instagram connection", async () => {
      const mockResult = { connected: true, accountId: "account123" };
      instagramService.testConnection.mockResolvedValue(mockResult);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.testInstagramConnection(req, res);

      expect(instagramService.testConnection).toHaveBeenCalledWith("platform");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("testWhatsAppConnection", () => {
    it("should test WhatsApp connection", async () => {
      const mockResult = { connected: true, phoneNumberId: "phone123" };
      whatsappService.testConnection.mockResolvedValue(mockResult);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.testWhatsAppConnection(req, res);

      expect(whatsappService.testConnection).toHaveBeenCalledWith("platform");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("testEmailConnection", () => {
    it("should test email connection when enabled", async () => {
      const mockSettings = {
        _id: "settings123",
        email: {
          enabled: true,
          provider: "sendgrid",
          senderEmail: "noreply@platform.com",
        },
      };

      IntegrationSettings.findOne.mockResolvedValue(mockSettings);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.testEmailConnection(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          connected: true,
          provider: "sendgrid",
          senderEmail: "noreply@platform.com",
        },
      });
    });

    it("should fail if email integration is not configured", async () => {
      const mockSettings = {
        _id: "settings123",
        email: null,
      };

      IntegrationSettings.findOne.mockResolvedValue(mockSettings);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();
      res.status.mockReturnValue(res);

      await expect(automationController.testEmailConnection(req, res)).rejects.toThrow(
        "Email integration not configured"
      );
    });
  });

  describe("testElevenLabsConnection", () => {
    it("should test ElevenLabs connection", async () => {
      const mockResult = { connected: true, voiceId: "voice123" };
      elevenlabsService.testConnection.mockResolvedValue(mockResult);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.testElevenLabsConnection(req, res);

      expect(elevenlabsService.testConnection).toHaveBeenCalledWith("platform");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== Social Media Engagements ====================

  describe("getSocialMediaEngagements", () => {
    it("should get social media engagements with pagination", async () => {
      const mockEngagements = [
        { _id: "engagement1", platform: "tiktok", platformLevel: true },
      ];

      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(mockEngagements),
      };

      SocialMediaEngagement.find.mockReturnValue(mockChain);
      SocialMediaEngagement.countDocuments.mockResolvedValue(1);

      const req = mockRequest({}, {}, { platform: "tiktok", limit: "20", skip: "0" }, null, mockBusiness);
      const res = mockResponse();

      await automationController.getSocialMediaEngagements(req, res);

      expect(SocialMediaEngagement.find).toHaveBeenCalledWith({
        platformLevel: true,
        platform: "tiktok",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockEngagements,
          pagination: expect.objectContaining({
            total: 1,
          }),
        })
      );
    });
  });

  describe("getEngagementDetails", () => {
    it("should get details for a specific engagement", async () => {
      const mockEngagement = {
        _id: "engagement1",
        platform: "tiktok",
        platformLevel: true,
        generatedContentIdea: { _id: "idea1" },
      };

      SocialMediaEngagement.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockEngagement),
      });

      const req = mockRequest({}, { engagementId: "engagement1" }, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.getEngagementDetails(req, res);

      expect(SocialMediaEngagement.findOne).toHaveBeenCalledWith({
        _id: "engagement1",
        platformLevel: true,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should throw error if engagement not found", async () => {
      SocialMediaEngagement.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      const req = mockRequest({}, { engagementId: "engagement1" }, {}, null, mockBusiness);
      const res = mockResponse();
      res.status.mockReturnValue(res);

      await expect(automationController.getEngagementDetails(req, res)).rejects.toThrow(
        "Engagement not found"
      );
    });
  });

  describe("archiveEngagement", () => {
    it("should archive an engagement", async () => {
      const mockEngagement = {
        _id: "engagement1",
        status: "archived",
      };

      SocialMediaEngagement.findOneAndUpdate.mockResolvedValue(mockEngagement);

      const req = mockRequest({}, { engagementId: "engagement1" }, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.archiveEngagement(req, res);

      expect(SocialMediaEngagement.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "engagement1", platformLevel: true },
        { status: "archived" },
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== Content Ideas ====================

  describe("getContentIdeas", () => {
    it("should get content ideas with status filter", async () => {
      const mockIdeas = [
        { _id: "idea1", status: "approved", platformLevel: true },
      ];

      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(mockIdeas),
      };

      ContentIdea.find.mockReturnValue(mockChain);
      ContentIdea.countDocuments.mockResolvedValue(1);

      const req = mockRequest({}, {}, { status: "approved", limit: "20", skip: "0" }, null, mockBusiness);
      const res = mockResponse();

      await automationController.getContentIdeas(req, res);

      expect(ContentIdea.find).toHaveBeenCalledWith({
        platformLevel: true,
        status: "approved",
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getIdeaDetails", () => {
    it("should get details for a specific content idea", async () => {
      const mockIdea = {
        _id: "idea1",
        status: "approved",
        platformLevel: true,
      };

      ContentIdea.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockIdea),
      });

      const req = mockRequest({}, { ideaId: "idea1" }, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.getIdeaDetails(req, res);

      expect(ContentIdea.findOne).toHaveBeenCalledWith({
        _id: "idea1",
        platformLevel: true,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should throw error if idea not found", async () => {
      ContentIdea.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      const req = mockRequest({}, { ideaId: "idea1" }, {}, null, mockBusiness);
      const res = mockResponse();
      res.status.mockReturnValue(res);

      await expect(automationController.getIdeaDetails(req, res)).rejects.toThrow(
        "Content idea not found"
      );
    });
  });

  describe("approveContentIdea", () => {
    it("should approve a content idea", async () => {
      const mockIdea = {
        _id: "idea1",
        status: "approved",
      };

      ContentIdea.findOneAndUpdate.mockResolvedValue(mockIdea);

      const req = mockRequest(
        { notes: "Looks good!" },
        { ideaId: "idea1" },
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await automationController.approveContentIdea(req, res);

      expect(ContentIdea.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "idea1", platformLevel: true },
        expect.objectContaining({
          status: "approved",
        }),
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("rejectContentIdea", () => {
    it("should reject a content idea", async () => {
      const mockIdea = {
        _id: "idea1",
        status: "rejected",
      };

      ContentIdea.findOneAndUpdate.mockResolvedValue(mockIdea);

      const req = mockRequest(
        { reason: "Not relevant" },
        { ideaId: "idea1" },
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await automationController.rejectContentIdea(req, res);

      expect(ContentIdea.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "idea1", platformLevel: true },
        expect.objectContaining({
          status: "rejected",
        }),
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("scheduleContentIdea", () => {
    it("should schedule a content idea for publishing", async () => {
      const mockIdea = {
        _id: "idea1",
        status: "scheduled",
      };

      ContentIdea.findOneAndUpdate.mockResolvedValue(mockIdea);

      const scheduledDate = new Date("2024-02-01");
      const req = mockRequest(
        {
          platforms: ["tiktok", "instagram"],
          scheduledDate: scheduledDate.toISOString(),
        },
        { ideaId: "idea1" },
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await automationController.scheduleContentIdea(req, res);

      expect(ContentIdea.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "idea1", platformLevel: true },
        expect.objectContaining({
          status: "scheduled",
        }),
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should fail if platforms and scheduledDate are missing", async () => {
      const req = mockRequest(
        { platforms: ["tiktok"] },
        { ideaId: "idea1" },
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();
      res.status.mockReturnValue(res);

      await expect(automationController.scheduleContentIdea(req, res)).rejects.toThrow(
        "Platforms and scheduled date are required"
      );
    });
  });

  describe("rescheduleContent", () => {
    it("should reschedule a content idea", async () => {
      const mockIdea = {
        _id: "idea1",
        status: "scheduled",
      };

      ContentIdea.findOneAndUpdate.mockResolvedValue(mockIdea);

      const newDate = new Date("2024-02-15");
      const req = mockRequest(
        { scheduledDate: newDate.toISOString() },
        { ideaId: "idea1" },
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await automationController.rescheduleContent(req, res);

      expect(ContentIdea.findOneAndUpdate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getIdeaStats", () => {
    it("should get content idea statistics", async () => {
      const mockStats = {
        totalIdeas: 100,
        approvedIdeas: 75,
        rejectedIdeas: 15,
        publishedIdeas: 50,
      };

      contentIdeaService.getIdeaStats.mockResolvedValue(mockStats);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.getIdeaStats(req, res);

      expect(contentIdeaService.getIdeaStats).toHaveBeenCalledWith("platform");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats,
      });
    });
  });

  // ==================== Registration Follow-ups ====================

  describe("getRegistrationFollowups", () => {
    it("should get registration follow-ups with status filter", async () => {
      const mockFollowups = [
        { _id: "followup1", status: "in_sequence", platformLevel: true },
      ];

      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockResolvedValue(mockFollowups),
      };

      RegistrationFollowup.find.mockReturnValue(mockChain);
      RegistrationFollowup.countDocuments.mockResolvedValue(1);

      const req = mockRequest({}, {}, { status: "in_sequence", limit: "20", skip: "0" }, null, mockBusiness);
      const res = mockResponse();

      await automationController.getRegistrationFollowups(req, res);

      expect(RegistrationFollowup.find).toHaveBeenCalledWith({
        platformLevel: true,
        status: "in_sequence",
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getFollowupDetails", () => {
    it("should get follow-up details with populated references", async () => {
      const mockFollowup = {
        _id: "followup1",
        platformLevel: true,
      };

      RegistrationFollowup.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockFollowup),
      });

      const req = mockRequest({}, { followupId: "followup1" }, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.getFollowupDetails(req, res);

      expect(RegistrationFollowup.findOne).toHaveBeenCalledWith({
        _id: "followup1",
        platformLevel: true,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getFollowupHistory", () => {
    it("should get follow-up interaction history", async () => {
      const mockFollowup = {
        _id: "followup1",
        contactEmail: "test@example.com",
        contactPhone: "+1234567890",
        interactions: [
          { date: new Date(), action: "email_sent" },
        ],
        engagementMetrics: {
          opens: 1,
          clicks: 0,
        },
      };

      RegistrationFollowup.findOne.mockResolvedValue(mockFollowup);

      const req = mockRequest({}, { followupId: "followup1" }, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.getFollowupHistory(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          followupId: "followup1",
          contactEmail: "test@example.com",
          interactions: expect.any(Array),
          metrics: expect.any(Object),
        }),
      });
    });
  });

  describe("pauseFollowup", () => {
    it("should pause a follow-up sequence", async () => {
      const mockFollowup = {
        _id: "followup1",
        status: "paused",
      };

      RegistrationFollowup.findOneAndUpdate.mockResolvedValue(mockFollowup);

      const req = mockRequest(
        { reason: "Customer requested pause" },
        { followupId: "followup1" },
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await automationController.pauseFollowup(req, res);

      expect(RegistrationFollowup.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "followup1", platformLevel: true },
        expect.objectContaining({
          status: "paused",
        }),
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("resumeFollowup", () => {
    it("should resume a paused follow-up sequence", async () => {
      const mockFollowup = {
        _id: "followup1",
        status: "in_sequence",
      };

      RegistrationFollowup.findOneAndUpdate.mockResolvedValue(mockFollowup);

      const req = mockRequest({}, { followupId: "followup1" }, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.resumeFollowup(req, res);

      expect(RegistrationFollowup.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "followup1", platformLevel: true },
        expect.objectContaining({
          status: "in_sequence",
        }),
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("unsubscribeFollowup", () => {
    it("should unsubscribe a contact from follow-ups", async () => {
      const mockFollowup = {
        _id: "followup1",
        status: "unsubscribed",
      };

      RegistrationFollowup.findOneAndUpdate.mockResolvedValue(mockFollowup);

      const req = mockRequest({}, { followupId: "followup1" }, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.unsubscribeFollowup(req, res);

      expect(RegistrationFollowup.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "followup1", platformLevel: true },
        expect.objectContaining({
          status: "unsubscribed",
        }),
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== Follow-up Campaigns ====================

  describe("getCampaigns", () => {
    it("should get all follow-up campaigns with pagination", async () => {
      const mockResult = {
        campaigns: [{ _id: "campaign1", name: "Welcome Campaign" }],
        pagination: { total: 1, limit: 20, skip: 0 },
      };

      campaignService.getPlatformCampaigns.mockResolvedValue(mockResult);

      const req = mockRequest({}, {}, { status: "active", limit: "20", skip: "0" }, null, mockBusiness);
      const res = mockResponse();

      await automationController.getCampaigns(req, res);

      expect(campaignService.getPlatformCampaigns).toHaveBeenCalledWith({
        status: "active",
        limit: 20,
        skip: 0,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getCampaignDetails", () => {
    it("should get campaign details with populated templates", async () => {
      const mockCampaign = {
        _id: "campaign1",
        name: "Welcome Campaign",
        platformLevel: true,
      };

      FollowupCampaign.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCampaign),
      });

      const req = mockRequest({}, { campaignId: "campaign1" }, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.getCampaignDetails(req, res);

      expect(FollowupCampaign.findOne).toHaveBeenCalledWith({
        _id: "campaign1",
        platformLevel: true,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("createCampaign", () => {
    it("should create a new follow-up campaign", async () => {
      const mockCampaign = {
        _id: "campaign1",
        name: "Welcome Campaign",
      };

      campaignService.createPlatformCampaign.mockResolvedValue(mockCampaign);

      const req = mockRequest(
        {
          name: "Welcome Campaign",
          messageSequence: [],
        },
        {},
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await automationController.createCampaign(req, res);

      expect(campaignService.createPlatformCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Welcome Campaign",
        }),
        mockBusiness._id
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("updateCampaign", () => {
    it("should update a campaign", async () => {
      const mockCampaign = {
        _id: "campaign1",
        name: "Updated Campaign",
      };

      FollowupCampaign.findOneAndUpdate.mockResolvedValue(mockCampaign);

      const req = mockRequest(
        { name: "Updated Campaign" },
        { campaignId: "campaign1" },
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await automationController.updateCampaign(req, res);

      expect(FollowupCampaign.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "campaign1", platformLevel: true },
        expect.objectContaining({
          name: "Updated Campaign",
        }),
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("activateCampaign", () => {
    it("should activate a campaign", async () => {
      const mockCampaign = {
        _id: "campaign1",
        status: "active",
      };

      campaignService.activatePlatformCampaign.mockResolvedValue(mockCampaign);

      const req = mockRequest({}, { campaignId: "campaign1" }, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.activateCampaign(req, res);

      expect(campaignService.activatePlatformCampaign).toHaveBeenCalledWith("campaign1");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("pauseCampaign", () => {
    it("should pause a campaign", async () => {
      const mockCampaign = {
        _id: "campaign1",
        status: "paused",
      };

      campaignService.pausePlatformCampaign.mockResolvedValue(mockCampaign);

      const req = mockRequest({}, { campaignId: "campaign1" }, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.pauseCampaign(req, res);

      expect(campaignService.pausePlatformCampaign).toHaveBeenCalledWith("campaign1");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("archiveCampaign", () => {
    it("should archive a campaign", async () => {
      const mockCampaign = {
        _id: "campaign1",
        status: "archived",
      };

      campaignService.archivePlatformCampaign.mockResolvedValue(mockCampaign);

      const req = mockRequest({}, { campaignId: "campaign1" }, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.archiveCampaign(req, res);

      expect(campaignService.archivePlatformCampaign).toHaveBeenCalledWith("campaign1");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("duplicateCampaign", () => {
    it("should duplicate a campaign", async () => {
      const mockCampaign = {
        _id: "campaign2",
        name: "Welcome Campaign (Copy)",
      };

      campaignService.duplicatePlatformCampaign.mockResolvedValue(mockCampaign);

      const req = mockRequest({}, { campaignId: "campaign1" }, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.duplicateCampaign(req, res);

      expect(campaignService.duplicatePlatformCampaign).toHaveBeenCalledWith(
        "campaign1",
        mockBusiness._id
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("getCampaignStats", () => {
    it("should get campaign statistics", async () => {
      const mockStats = {
        recipientCount: 100,
        sentCount: 100,
        openRate: 0.45,
        clickRate: 0.25,
      };

      campaignService.getPlatformCampaignStats.mockResolvedValue(mockStats);

      const req = mockRequest({}, { campaignId: "campaign1" }, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.getCampaignStats(req, res);

      expect(campaignService.getPlatformCampaignStats).toHaveBeenCalledWith("campaign1");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("addCampaignRecipients", () => {
    it("should add recipients to a campaign", async () => {
      const mockCampaign = {
        _id: "campaign1",
        recipients: ["followup1", "followup2"],
      };

      campaignService.addRecipientsToplatformCampaign.mockResolvedValue(mockCampaign);

      const req = mockRequest(
        { followupIds: ["followup1", "followup2"] },
        { campaignId: "campaign1" },
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await automationController.addCampaignRecipients(req, res);

      expect(campaignService.addRecipientsToplatformCampaign).toHaveBeenCalledWith(
        "campaign1",
        ["followup1", "followup2"]
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should fail if followupIds is not an array", async () => {
      const req = mockRequest(
        { followupIds: "followup1" },
        { campaignId: "campaign1" },
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();
      res.status.mockReturnValue(res);

      await expect(automationController.addCampaignRecipients(req, res)).rejects.toThrow(
        "followupIds array is required"
      );
    });
  });

  describe("updateCampaignSequence", () => {
    it("should update campaign message sequence", async () => {
      const mockCampaign = {
        _id: "campaign1",
        messageSequence: [
          { templateId: "template1", delayDays: 0 },
          { templateId: "template2", delayDays: 3 },
        ],
      };

      campaignService.updatePlatformCampaignSequence.mockResolvedValue(mockCampaign);

      const req = mockRequest(
        {
          messageSequence: [
            { templateId: "template1", delayDays: 0 },
            { templateId: "template2", delayDays: 3 },
          ],
        },
        { campaignId: "campaign1" },
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await automationController.updateCampaignSequence(req, res);

      expect(campaignService.updatePlatformCampaignSequence).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== Follow-up Templates ====================

  describe("getFollowupTemplates", () => {
    it("should get follow-up templates with channel filter", async () => {
      const mockTemplates = [
        { _id: "template1", name: "Welcome", channel: "email" },
      ];

      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockResolvedValue(mockTemplates),
      };

      FollowupTemplate.find.mockReturnValue(mockChain);
      FollowupTemplate.countDocuments.mockResolvedValue(1);

      const req = mockRequest({}, {}, { channel: "email", limit: "20", skip: "0" }, null, mockBusiness);
      const res = mockResponse();

      await automationController.getFollowupTemplates(req, res);

      expect(FollowupTemplate.find).toHaveBeenCalledWith(
        expect.objectContaining({
          active: true,
          platformLevel: true,
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("createFollowupTemplate", () => {
    it("should create a follow-up template", async () => {
      const mockTemplate = {
        _id: "template1",
        name: "Welcome Email",
        channel: "email",
      };

      FollowupTemplate.create.mockResolvedValue(mockTemplate);

      const req = mockRequest(
        {
          name: "Welcome Email",
          channel: "email",
          body: "Welcome to our platform!",
        },
        {},
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await automationController.createFollowupTemplate(req, res);

      expect(FollowupTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Welcome Email",
          channel: "email",
          business: "platform",
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("updateFollowupTemplate", () => {
    it("should update a follow-up template", async () => {
      const mockTemplate = {
        _id: "template1",
        name: "Updated Welcome Email",
      };

      FollowupTemplate.findOneAndUpdate.mockResolvedValue(mockTemplate);

      const req = mockRequest(
        { name: "Updated Welcome Email" },
        { templateId: "template1" },
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await automationController.updateFollowupTemplate(req, res);

      expect(FollowupTemplate.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "template1", platformLevel: true },
        expect.objectContaining({
          name: "Updated Welcome Email",
        }),
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("deleteFollowupTemplate", () => {
    it("should deactivate a follow-up template", async () => {
      const mockTemplate = {
        _id: "template1",
        active: false,
      };

      FollowupTemplate.findOneAndUpdate.mockResolvedValue(mockTemplate);

      const req = mockRequest({}, { templateId: "template1" }, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.deleteFollowupTemplate(req, res);

      expect(FollowupTemplate.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "template1", platformLevel: true },
        { active: false },
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== Dashboard & Analytics ====================

  describe("getDashboardOverview", () => {
    it("should return dashboard overview with real data", async () => {
      SocialMediaEngagement.countDocuments.mockResolvedValue(10);
      ContentIdea.countDocuments.mockResolvedValue(5);
      RegistrationFollowup.countDocuments.mockResolvedValue(20);

      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([]),
      };
      SocialMediaEngagement.find.mockReturnValue(mockChain);
      ContentIdea.find.mockReturnValue(mockChain);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.getDashboardOverview(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            socialMedia: expect.any(Object),
            followups: expect.any(Object),
          }),
        })
      );
    });
  });

  describe("getEngagementMetrics", () => {
    it("should return engagement metrics with real data", async () => {
      const mockEngagements = [
        { _id: "e1", platform: "tiktok", engagementType: "like", generatedContentIdea: { resonanceScore: 80 } },
      ];

      const mockChain = {
        populate: jest.fn().mockResolvedValue(mockEngagements),
      };
      SocialMediaEngagement.find.mockReturnValue(mockChain);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.getEngagementMetrics(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            totalEngagements: 1,
            averageResonance: "80.00",
          }),
        })
      );
    });
  });

  describe("getCampaignMetrics", () => {
    it("should return campaign metrics", async () => {
      const mockCampaigns = [{ _id: "c1", status: "active", recipients: [] }];
      const mockFollowups = [{ _id: "f1", engagementMetrics: {} }];

      FollowupCampaign.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCampaigns),
      });
      RegistrationFollowup.find.mockResolvedValue(mockFollowups);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.getCampaignMetrics(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            totalCampaigns: 1,
            activeCampaigns: 1,
          }),
        })
      );
    });
  });

  describe("getContentMetrics", () => {
    it("should return content metrics", async () => {
      const mockIdeas = [
        { _id: "idea1", status: "approved", publishingHistory: [] },
      ];
      ContentIdea.find.mockResolvedValue(mockIdeas);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.getContentMetrics(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            totalIdeas: 1,
            approvedIdeas: 1,
          }),
        })
      );
    });
  });

  describe("getFollowupMetrics", () => {
    it("should return follow-up metrics", async () => {
      const mockFollowups = [
        { _id: "f1", status: "in_sequence", engagementMetrics: {} },
      ];
      RegistrationFollowup.find.mockResolvedValue(mockFollowups);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.getFollowupMetrics(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            totalFollowups: 1,
            activeFollowups: 1,
          }),
        })
      );
    });
  });

  // ==================== Manual Triggers ====================

  describe("triggerTikTokAutomation", () => {
    it("should trigger TikTok automation", async () => {
      tiktokAutomationJob.processPlatformTikTokAutomation.mockResolvedValue({});

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.triggerTikTokAutomation(req, res);

      expect(tiktokAutomationJob.processPlatformTikTokAutomation).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "TikTok automation triggered for platform account",
      });
    });

    it("should handle job errors gracefully", async () => {
      tiktokAutomationJob.processPlatformTikTokAutomation.mockRejectedValue(
        new Error("Job failed")
      );

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.triggerTikTokAutomation(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "TikTok automation triggered for platform account",
      });
    });
  });

  describe("triggerInstagramAutomation", () => {
    it("should trigger Instagram automation", async () => {
      instagramAutomationJob.processPlatformInstagramAutomation.mockResolvedValue({});

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.triggerInstagramAutomation(req, res);

      expect(instagramAutomationJob.processPlatformInstagramAutomation).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("triggerFollowupProcessing", () => {
    it("should trigger registration follow-up processing", async () => {
      registrationFollowupJob.processAllFollowups.mockResolvedValue({});

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.triggerFollowupProcessing(req, res);

      expect(registrationFollowupJob.processAllFollowups).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("triggerContentPublishing", () => {
    it("should trigger content publishing", async () => {
      contentPublishingJob.publishScheduledContent.mockResolvedValue({});

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await automationController.triggerContentPublishing(req, res);

      expect(contentPublishingJob.publishScheduledContent).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
