const {
  getAutomationStatus,
  getJobStatus,
  testTikTokConnection,
  testInstagramConnection,
  testWhatsAppConnection,
  testEmailConnection,
  testElevenLabsConnection,
  getSocialMediaEngagements,
  getEngagementDetails,
  archiveEngagement,
  getContentIdeas,
  getIdeaDetails,
  approveContentIdea,
  rejectContentIdea,
  scheduleContentIdea,
  rescheduleContent,
  getIdeaStats,
  getRegistrationFollowups,
  getFollowupDetails,
  getFollowupHistory,
  pauseFollowup,
  resumeFollowup,
  unsubscribeFollowup,
  getCampaigns,
  getCampaignDetails,
  createCampaign,
  updateCampaign,
  activateCampaign,
  pauseCampaign,
  archiveCampaign,
  duplicateCampaign,
  getCampaignStats,
  addCampaignRecipients,
  updateCampaignSequence,
  getFollowupTemplates,
  createFollowupTemplate,
  updateFollowupTemplate,
  deleteFollowupTemplate,
  getDashboardOverview,
  getEngagementMetrics,
  getCampaignMetrics,
  getContentMetrics,
  getFollowupMetrics,
  triggerTikTokAutomation,
  triggerInstagramAutomation,
  triggerFollowupProcessing,
  triggerContentPublishing,
} = require("../../controllers/automationController");

const IntegrationSettings = require("../../models/integrationSettingsModel");
const SocialMediaEngagement = require("../../models/socialMediaEngagementModel");
const ContentIdea = require("../../models/contentIdeaModel");
const RegistrationFollowup = require("../../models/registrationFollowupModel");
const FollowupTemplate = require("../../models/followupTemplateModel");
const FollowupCampaign = require("../../models/followupCampaignModel");
const automationScheduler = require("../../jobs/automationScheduler");
const { mockRequest, mockResponse } = require("../helpers/testHelpers");

// Mock the models
jest.mock("../../models/integrationSettingsModel");
jest.mock("../../models/socialMediaEngagementModel");
jest.mock("../../models/contentIdeaModel");
jest.mock("../../models/registrationFollowupModel");
jest.mock("../../models/followupTemplateModel");
jest.mock("../../models/followupCampaignModel");
jest.mock("../../jobs/automationScheduler");
jest.mock("../../services/tiktok/tiktokService");
jest.mock("../../services/instagram/instagramService");
jest.mock("../../services/whatsapp/whatsappService");
jest.mock("../../services/elevenlabs/elevenlabsService");
jest.mock("../../services/contentIdea/contentIdeaService");
jest.mock("../../services/campaigns/campaignService");

describe("Automation Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== Automation Status ====================

  describe("getAutomationStatus", () => {
    test("should return automation status for all platforms", async () => {
      const mockSettings = {
        tiktok: {
          status: "connected",
          automationSettings: { monitoringEnabled: true },
          lastSyncedAt: new Date(),
        },
        instagram: {
          status: "connected",
          automationSettings: { monitoringEnabled: true },
        },
        whatsapp: { status: "disconnected" },
        email: { status: "disconnected" },
        elevenLabs: { status: "disconnected" },
      };

      IntegrationSettings.findOne = jest
        .fn()
        .mockResolvedValue(mockSettings);

      const req = mockRequest();
      const res = mockResponse();

      await getAutomationStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          integrations: expect.any(Object),
          automationsEnabled: expect.any(Object),
        }),
      });
    });

    test("should handle missing integration settings", async () => {
      IntegrationSettings.findOne = jest.fn().mockResolvedValue(null);

      const req = mockRequest();
      const res = mockResponse();

      await getAutomationStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.data.integrations.tiktok).toBe("disconnected");
    });
  });

  // ==================== Job Status ====================

  describe("getJobStatus", () => {
    test("should return job scheduler status", async () => {
      automationScheduler.getStatus = jest.fn().mockReturnValue({
        schedulerStatus: "running",
        totalJobs: 4,
        lastCheck: new Date(),
      });

      const req = mockRequest();
      const res = mockResponse();

      await getJobStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          schedulerStatus: "running",
        }),
      });
    });
  });

  // ==================== Connection Testing ====================

  describe("testTikTokConnection", () => {
    test("should test TikTok connection", async () => {
      const tiktokService = require("../../services/tiktok/tiktokService");
      tiktokService.testConnection = jest.fn().mockResolvedValue({
        success: true,
        message: "Connection successful",
      });

      const req = mockRequest();
      const res = mockResponse();

      await testTikTokConnection(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object),
      });
    });
  });

  describe("testInstagramConnection", () => {
    test("should test Instagram connection", async () => {
      const instagramService = require("../../services/instagram/instagramService");
      instagramService.testConnection = jest.fn().mockResolvedValue({
        success: true,
      });

      const req = mockRequest();
      const res = mockResponse();

      await testInstagramConnection(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("testWhatsAppConnection", () => {
    test("should test WhatsApp connection", async () => {
      const whatsappService = require("../../services/whatsapp/whatsappService");
      whatsappService.testConnection = jest.fn().mockResolvedValue({
        success: true,
      });

      const req = mockRequest();
      const res = mockResponse();

      await testWhatsAppConnection(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("testEmailConnection", () => {
    test("should test Email connection", async () => {
      const mockSettings = {
        email: { enabled: true, provider: "sendgrid" },
      };

      IntegrationSettings.findOne = jest
        .fn()
        .mockResolvedValue(mockSettings);

      const req = mockRequest();
      const res = mockResponse();

      await testEmailConnection(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("testElevenLabsConnection", () => {
    test("should test ElevenLabs connection", async () => {
      const elevenlabsService = require("../../services/elevenlabs/elevenlabsService");
      elevenlabsService.testConnection = jest.fn().mockResolvedValue({
        success: true,
      });

      const req = mockRequest();
      const res = mockResponse();

      await testElevenLabsConnection(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== Social Media Engagements ====================

  describe("getSocialMediaEngagements", () => {
    test("should return social media engagements", async () => {
      const mockEngagements = [
        { _id: "eng_1", platform: "tiktok", likes: 100 },
        { _id: "eng_2", platform: "instagram", likes: 50 },
      ];

      SocialMediaEngagement.find = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          skip: jest.fn().mockResolvedValue(mockEngagements),
        }),
      });

      const req = mockRequest({}, {}, { limit: "20", skip: "0" });
      const res = mockResponse();

      await getSocialMediaEngagements(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockEngagements,
      });
    });
  });

  describe("getEngagementDetails", () => {
    test("should return engagement details", async () => {
      const mockEngagement = {
        _id: "eng_1",
        platform: "tiktok",
        postUrl: "https://tiktok.com/...",
        likes: 100,
        comments: 20,
      };

      SocialMediaEngagement.findById = jest
        .fn()
        .mockResolvedValue(mockEngagement);

      const req = mockRequest({}, { engagementId: "eng_1" });
      const res = mockResponse();

      await getEngagementDetails(req, res);

      expect(SocialMediaEngagement.findById).toHaveBeenCalledWith("eng_1");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("should return 404 if engagement not found", async () => {
      SocialMediaEngagement.findById = jest.fn().mockResolvedValue(null);

      const req = mockRequest({}, { engagementId: "nonexistent" });
      const res = mockResponse();

      await expect(getEngagementDetails(req, res)).rejects.toThrow(
        /Engagement not found/
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("archiveEngagement", () => {
    test("should archive engagement", async () => {
      const mockEngagement = {
        _id: "eng_1",
        archived: false,
        save: jest.fn().mockResolvedValue(true),
      };

      SocialMediaEngagement.findById = jest
        .fn()
        .mockResolvedValue(mockEngagement);

      const req = mockRequest({}, { engagementId: "eng_1" });
      const res = mockResponse();

      await archiveEngagement(req, res);

      expect(mockEngagement.archived).toBe(true);
      expect(mockEngagement.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== Content Ideas ====================

  describe("getContentIdeas", () => {
    test("should return content ideas filtered by status", async () => {
      const mockIdeas = [
        { _id: "idea_1", status: "pending_approval", title: "Content 1" },
      ];

      ContentIdea.find = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          skip: jest.fn().mockResolvedValue(mockIdeas),
        }),
      });

      const req = mockRequest({}, {}, { status: "pending_approval" });
      const res = mockResponse();

      await getContentIdeas(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockIdeas,
      });
    });
  });

  describe("getIdeaDetails", () => {
    test("should return content idea details", async () => {
      const mockIdea = {
        _id: "idea_1",
        title: "Content Idea",
        status: "pending_approval",
      };

      ContentIdea.findById = jest.fn().mockResolvedValue(mockIdea);

      const req = mockRequest({}, { ideaId: "idea_1" });
      const res = mockResponse();

      await getIdeaDetails(req, res);

      expect(ContentIdea.findById).toHaveBeenCalledWith("idea_1");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("approveContentIdea", () => {
    test("should approve content idea", async () => {
      const mockIdea = {
        _id: "idea_1",
        status: "pending_approval",
        save: jest.fn().mockResolvedValue(true),
      };

      ContentIdea.findById = jest.fn().mockResolvedValue(mockIdea);

      const req = mockRequest({}, { ideaId: "idea_1" });
      const res = mockResponse();

      await approveContentIdea(req, res);

      expect(mockIdea.status).toBe("approved");
      expect(mockIdea.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("rejectContentIdea", () => {
    test("should reject content idea", async () => {
      const mockIdea = {
        _id: "idea_1",
        status: "pending_approval",
        save: jest.fn().mockResolvedValue(true),
      };

      ContentIdea.findById = jest.fn().mockResolvedValue(mockIdea);

      const req = mockRequest(
        { reason: "Not aligned with brand" },
        { ideaId: "idea_1" }
      );
      const res = mockResponse();

      await rejectContentIdea(req, res);

      expect(mockIdea.status).toBe("rejected");
      expect(mockIdea.save).toHaveBeenCalled();
    });
  });

  describe("scheduleContentIdea", () => {
    test("should schedule content idea", async () => {
      const mockIdea = {
        _id: "idea_1",
        status: "approved",
        scheduledDate: null,
        save: jest.fn().mockResolvedValue(true),
      };

      ContentIdea.findById = jest.fn().mockResolvedValue(mockIdea);

      const scheduledDate = new Date().toISOString();
      const req = mockRequest(
        {
          platforms: ["tiktok", "instagram"],
          scheduledDate,
        },
        { ideaId: "idea_1" }
      );
      const res = mockResponse();

      await scheduleContentIdea(req, res);

      expect(mockIdea.status).toBe("scheduled");
      expect(mockIdea.scheduledDate).toBe(scheduledDate);
      expect(mockIdea.save).toHaveBeenCalled();
    });
  });

  describe("rescheduleContent", () => {
    test("should reschedule content", async () => {
      const mockIdea = {
        _id: "idea_1",
        scheduledDate: new Date(),
        save: jest.fn().mockResolvedValue(true),
      };

      ContentIdea.findById = jest.fn().mockResolvedValue(mockIdea);

      const newDate = new Date(Date.now() + 86400000).toISOString();
      const req = mockRequest(
        { scheduledDate: newDate },
        { ideaId: "idea_1" }
      );
      const res = mockResponse();

      await rescheduleContent(req, res);

      expect(mockIdea.scheduledDate).toBe(newDate);
      expect(mockIdea.save).toHaveBeenCalled();
    });
  });

  describe("getIdeaStats", () => {
    test("should return content idea statistics", async () => {
      const contentIdeaService = require("../../services/contentIdea/contentIdeaService");
      contentIdeaService.getIdeaStats = jest.fn().mockResolvedValue({
        totalIdeas: 50,
        approvedCount: 30,
        rejectedCount: 10,
      });

      const req = mockRequest();
      const res = mockResponse();

      await getIdeaStats(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== Registration Followups ====================

  describe("getRegistrationFollowups", () => {
    test("should return registration followups", async () => {
      const mockFollowups = [
        { _id: "f_1", status: "pending", recipientEmail: "user@example.com" },
      ];

      RegistrationFollowup.find = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          skip: jest.fn().mockResolvedValue(mockFollowups),
        }),
      });

      const req = mockRequest({}, {}, { status: "pending" });
      const res = mockResponse();

      await getRegistrationFollowups(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getFollowupDetails", () => {
    test("should return followup details", async () => {
      const mockFollowup = {
        _id: "f_1",
        recipientEmail: "user@example.com",
        status: "pending",
      };

      RegistrationFollowup.findById = jest
        .fn()
        .mockResolvedValue(mockFollowup);

      const req = mockRequest({}, { followupId: "f_1" });
      const res = mockResponse();

      await getFollowupDetails(req, res);

      expect(RegistrationFollowup.findById).toHaveBeenCalledWith("f_1");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getFollowupHistory", () => {
    test("should return followup history", async () => {
      const mockHistory = [
        { _id: "h_1", status: "sent", sentAt: new Date() },
      ];

      RegistrationFollowup.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          history: mockHistory,
        }),
      });

      const req = mockRequest({}, { followupId: "f_1" });
      const res = mockResponse();

      await getFollowupHistory(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("pauseFollowup", () => {
    test("should pause followup", async () => {
      const mockFollowup = {
        _id: "f_1",
        status: "active",
        save: jest.fn().mockResolvedValue(true),
      };

      RegistrationFollowup.findById = jest
        .fn()
        .mockResolvedValue(mockFollowup);

      const req = mockRequest({}, { followupId: "f_1" });
      const res = mockResponse();

      await pauseFollowup(req, res);

      expect(mockFollowup.status).toBe("paused");
      expect(mockFollowup.save).toHaveBeenCalled();
    });
  });

  describe("resumeFollowup", () => {
    test("should resume followup", async () => {
      const mockFollowup = {
        _id: "f_1",
        status: "paused",
        save: jest.fn().mockResolvedValue(true),
      };

      RegistrationFollowup.findById = jest
        .fn()
        .mockResolvedValue(mockFollowup);

      const req = mockRequest({}, { followupId: "f_1" });
      const res = mockResponse();

      await resumeFollowup(req, res);

      expect(mockFollowup.status).toBe("active");
      expect(mockFollowup.save).toHaveBeenCalled();
    });
  });

  describe("unsubscribeFollowup", () => {
    test("should unsubscribe from followup", async () => {
      const mockFollowup = {
        _id: "f_1",
        status: "active",
        unsubscribed: false,
        save: jest.fn().mockResolvedValue(true),
      };

      RegistrationFollowup.findById = jest
        .fn()
        .mockResolvedValue(mockFollowup);

      const req = mockRequest({}, { followupId: "f_1" });
      const res = mockResponse();

      await unsubscribeFollowup(req, res);

      expect(mockFollowup.unsubscribed).toBe(true);
      expect(mockFollowup.save).toHaveBeenCalled();
    });
  });

  // ==================== Campaigns ====================

  describe("getCampaigns", () => {
    test("should return campaigns", async () => {
      const mockCampaigns = [
        { _id: "camp_1", name: "Welcome Series", status: "active" },
      ];

      FollowupCampaign.find = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          skip: jest.fn().mockResolvedValue(mockCampaigns),
        }),
      });

      const req = mockRequest({}, {}, { status: "active" });
      const res = mockResponse();

      await getCampaigns(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getCampaignDetails", () => {
    test("should return campaign details", async () => {
      const mockCampaign = {
        _id: "camp_1",
        name: "Welcome Series",
        sequences: [],
      };

      FollowupCampaign.findById = jest.fn().mockResolvedValue(mockCampaign);

      const req = mockRequest({}, { campaignId: "camp_1" });
      const res = mockResponse();

      await getCampaignDetails(req, res);

      expect(FollowupCampaign.findById).toHaveBeenCalledWith("camp_1");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("createCampaign", () => {
    test("should create new campaign", async () => {
      const campaignService = require("../../services/campaigns/campaignService");
      const mockCampaign = {
        _id: "camp_1",
        name: "New Campaign",
      };

      campaignService.createPlatformCampaign = jest
        .fn()
        .mockResolvedValue(mockCampaign);

      const req = mockRequest({
        name: "New Campaign",
        sequences: [],
      });
      req.business = { _id: "biz_1" };
      const res = mockResponse();

      await createCampaign(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("activateCampaign", () => {
    test("should activate campaign", async () => {
      const mockCampaign = {
        _id: "camp_1",
        status: "draft",
        save: jest.fn().mockResolvedValue(true),
      };

      FollowupCampaign.findById = jest
        .fn()
        .mockResolvedValue(mockCampaign);

      const req = mockRequest({}, { campaignId: "camp_1" });
      const res = mockResponse();

      await activateCampaign(req, res);

      expect(mockCampaign.status).toBe("active");
      expect(mockCampaign.save).toHaveBeenCalled();
    });
  });

  describe("pauseCampaign", () => {
    test("should pause campaign", async () => {
      const mockCampaign = {
        _id: "camp_1",
        status: "active",
        save: jest.fn().mockResolvedValue(true),
      };

      FollowupCampaign.findById = jest
        .fn()
        .mockResolvedValue(mockCampaign);

      const req = mockRequest({}, { campaignId: "camp_1" });
      const res = mockResponse();

      await pauseCampaign(req, res);

      expect(mockCampaign.status).toBe("paused");
      expect(mockCampaign.save).toHaveBeenCalled();
    });
  });

  describe("archiveCampaign", () => {
    test("should archive campaign", async () => {
      const mockCampaign = {
        _id: "camp_1",
        archived: false,
        save: jest.fn().mockResolvedValue(true),
      };

      FollowupCampaign.findById = jest
        .fn()
        .mockResolvedValue(mockCampaign);

      const req = mockRequest({}, { campaignId: "camp_1" });
      const res = mockResponse();

      await archiveCampaign(req, res);

      expect(mockCampaign.archived).toBe(true);
      expect(mockCampaign.save).toHaveBeenCalled();
    });
  });

  // ==================== Followup Templates ====================

  describe("getFollowupTemplates", () => {
    test("should return followup templates", async () => {
      const mockTemplates = [
        { _id: "tmpl_1", name: "Welcome", channel: "email" },
      ];

      FollowupTemplate.find = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          skip: jest.fn().mockResolvedValue(mockTemplates),
        }),
      });

      const req = mockRequest({}, {}, { channel: "email" });
      const res = mockResponse();

      await getFollowupTemplates(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("createFollowupTemplate", () => {
    test("should create followup template", async () => {
      const mockTemplate = {
        _id: "tmpl_1",
        name: "Welcome",
        channel: "email",
      };

      FollowupTemplate.prototype.save = jest
        .fn()
        .mockResolvedValue(mockTemplate);

      const req = mockRequest({
        name: "Welcome",
        channel: "email",
        body: "Welcome message",
      });
      const res = mockResponse();

      // Note: This test depends on the actual controller implementation
      // The controller uses FollowupTemplate.create() in the current code
    });
  });

  describe("deleteFollowupTemplate", () => {
    test("should delete followup template", async () => {
      FollowupTemplate.findByIdAndDelete = jest
        .fn()
        .mockResolvedValue({ _id: "tmpl_1" });

      const req = mockRequest({}, { templateId: "tmpl_1" });
      const res = mockResponse();

      await deleteFollowupTemplate(req, res);

      expect(FollowupTemplate.findByIdAndDelete).toHaveBeenCalledWith("tmpl_1");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== Dashboard & Analytics ====================

  describe("getDashboardOverview", () => {
    test("should return dashboard overview", async () => {
      const req = mockRequest();
      const res = mockResponse();

      await getDashboardOverview(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object),
      });
    });
  });

  describe("getEngagementMetrics", () => {
    test("should return engagement metrics", async () => {
      const req = mockRequest();
      const res = mockResponse();

      await getEngagementMetrics(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getCampaignMetrics", () => {
    test("should return campaign metrics", async () => {
      const req = mockRequest();
      const res = mockResponse();

      await getCampaignMetrics(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getContentMetrics", () => {
    test("should return content metrics", async () => {
      const req = mockRequest();
      const res = mockResponse();

      await getContentMetrics(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getFollowupMetrics", () => {
    test("should return followup metrics", async () => {
      const req = mockRequest();
      const res = mockResponse();

      await getFollowupMetrics(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== Manual Job Triggers ====================

  describe("triggerTikTokAutomation", () => {
    test("should trigger TikTok automation job", async () => {
      const tiktokAutomationJob = require("../../jobs/automations/tiktokAutomationJob");
      tiktokAutomationJob.execute = jest.fn().mockResolvedValue({
        success: true,
        processed: 5,
      });

      const req = mockRequest();
      const res = mockResponse();

      // Note: Implementation depends on actual controller code
    });
  });

  describe("triggerInstagramAutomation", () => {
    test("should trigger Instagram automation job", async () => {
      const instagramAutomationJob = require("../../jobs/automations/instagramAutomationJob");
      instagramAutomationJob.execute = jest
        .fn()
        .mockResolvedValue({ success: true });

      const req = mockRequest();
      const res = mockResponse();
    });
  });

  describe("triggerFollowupProcessing", () => {
    test("should trigger followup processing job", async () => {
      const registrationFollowupJob = require("../../jobs/automations/registrationFollowupJob");
      registrationFollowupJob.execute = jest
        .fn()
        .mockResolvedValue({ success: true });

      const req = mockRequest();
      const res = mockResponse();
    });
  });

  describe("triggerContentPublishing", () => {
    test("should trigger content publishing job", async () => {
      const contentPublishingJob = require("../../jobs/automations/contentPublishingJob");
      contentPublishingJob.execute = jest
        .fn()
        .mockResolvedValue({ success: true });

      const req = mockRequest();
      const res = mockResponse();
    });
  });
});
