const IntegrationSettings = require("../../models/integrationSettingsModel");
const SocialMediaEngagement = require("../../models/socialMediaEngagementModel");
const ContentIdea = require("../../models/contentIdeaModel");
const RegistrationFollowup = require("../../models/registrationFollowupModel");
const FollowupTemplate = require("../../models/followupTemplateModel");
const { eventBus, EventTypes } = require("../../events/EventEmitter");
const logActivity = require("../../middleWare/logActivityMiddleware");
const {
  mockRequest,
  mockResponse,
} = require("../helpers/testHelpers");
const integrationController = require("../../controllers/integrationController");

// Mock models
jest.mock("../../models/integrationSettingsModel");
jest.mock("../../models/socialMediaEngagementModel");
jest.mock("../../models/contentIdeaModel");
jest.mock("../../models/registrationFollowupModel");
jest.mock("../../models/followupTemplateModel");
jest.mock("../../events/EventEmitter");
jest.mock("../../middleWare/logActivityMiddleware");

describe("Integration Controller Tests", () => {
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
    logActivity.mockResolvedValue(undefined);
  });

  // ==================== getPlatformIntegrationSettings ====================

  describe("getPlatformIntegrationSettings", () => {
    it("should get existing platform integration settings", async () => {
      const mockSettings = {
        _id: "settings123",
        business: "platform",
        tiktok: {
          enabled: true,
          apiKey: "tiktok_key",
          apiSecret: "tiktok_secret",
          accessToken: "tiktok_token",
          status: "connected",
        },
        instagram: {
          enabled: false,
          status: "disconnected",
        },
        toObject: jest.fn().mockReturnValue({
          _id: "settings123",
          business: "platform",
          tiktok: {
            enabled: true,
            status: "connected",
          },
          instagram: {
            enabled: false,
            status: "disconnected",
          },
        }),
      };

      IntegrationSettings.findOne.mockResolvedValue(mockSettings);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await integrationController.getPlatformIntegrationSettings(req, res);

      expect(IntegrationSettings.findOne).toHaveBeenCalledWith({
        business: "platform",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          _id: "settings123",
          business: "platform",
        }),
      });
    });

    it("should create settings if they don't exist", async () => {
      const mockSettings = {
        _id: "settings123",
        business: "platform",
        toObject: jest.fn().mockReturnValue({
          _id: "settings123",
          business: "platform",
        }),
      };

      IntegrationSettings.findOne.mockResolvedValueOnce(null);
      IntegrationSettings.create.mockResolvedValue(mockSettings);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await integrationController.getPlatformIntegrationSettings(req, res);

      expect(IntegrationSettings.create).toHaveBeenCalledWith({
        business: "platform",
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should exclude sensitive secrets from response", async () => {
      const mockSettings = {
        _id: "settings123",
        business: "platform",
        tiktok: {
          enabled: true,
          apiKey: "tiktok_key",
          apiSecret: "tiktok_secret",
          accessToken: "tiktok_token",
          refreshToken: "tiktok_refresh",
          status: "connected",
        },
        instagram: {
          enabled: true,
          apiKey: "insta_key",
          accessToken: "insta_token",
          refreshToken: "insta_refresh",
          status: "connected",
        },
        whatsapp: {
          enabled: true,
          accessToken: "wa_token",
          webhookToken: "wa_webhook",
          status: "connected",
        },
        email: {
          enabled: true,
          apiKey: "email_key",
          status: "connected",
        },
        elevenLabs: {
          enabled: true,
          apiKey: "el_key",
          status: "connected",
        },
        toObject: jest.fn().mockReturnValue({
          tiktok: {
            enabled: true,
            apiKey: "tiktok_key",
            apiSecret: "tiktok_secret",
            accessToken: "tiktok_token",
            refreshToken: "tiktok_refresh",
            status: "connected",
          },
          instagram: {
            enabled: true,
            apiKey: "insta_key",
            accessToken: "insta_token",
            refreshToken: "insta_refresh",
            status: "connected",
          },
          whatsapp: {
            enabled: true,
            accessToken: "wa_token",
            webhookToken: "wa_webhook",
            status: "connected",
          },
          email: {
            enabled: true,
            apiKey: "email_key",
            status: "connected",
          },
          elevenLabs: {
            enabled: true,
            apiKey: "el_key",
            status: "connected",
          },
        }),
      };

      IntegrationSettings.findOne.mockResolvedValue(mockSettings);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await integrationController.getPlatformIntegrationSettings(req, res);

      const responseData = res.json.mock.calls[0][0].data;
      expect(responseData.tiktok?.apiKey).toBeUndefined();
      expect(responseData.tiktok?.apiSecret).toBeUndefined();
      expect(responseData.tiktok?.accessToken).toBeUndefined();
      expect(responseData.instagram?.apiKey).toBeUndefined();
      expect(responseData.whatsapp?.accessToken).toBeUndefined();
      expect(responseData.email?.apiKey).toBeUndefined();
      expect(responseData.elevenLabs?.apiKey).toBeUndefined();
    });
  });

  // ==================== connectTikTok / disconnectTikTok ====================

  describe("connectTikTok", () => {
    it("should connect TikTok successfully with provided credentials", async () => {
      const mockSettings = {
        _id: "settings123",
        business: "platform",
        tiktok: {},
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne.mockResolvedValue(mockSettings);

      const req = mockRequest(
        {
          apiKey: "tiktok_key",
          apiSecret: "tiktok_secret",
          businessAccountId: "account123",
          automationSettings: { monitoringEnabled: true },
        },
        {},
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await integrationController.connectTikTok(req, res);

      expect(mockSettings.save).toHaveBeenCalled();
      expect(mockSettings.tiktok.enabled).toBe(true);
      expect(mockSettings.tiktok.status).toBe("connected");
      expect(mockSettings.tiktok.apiKey).toBe("tiktok_key");
      expect(mockSettings.tiktok.apiSecret).toBe("tiktok_secret");
      expect(logActivity).toHaveBeenCalledWith(
        "Platform TikTok integration connected",
        expect.objectContaining({
          action: "integration_connected",
          platform: "tiktok",
        })
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        EventTypes.INTEGRATION_UPDATED,
        expect.objectContaining({
          platform: "tiktok",
          status: "connected",
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should fail if credentials are missing", async () => {
      const req = mockRequest(
        {
          // Missing apiKey and apiSecret
          businessAccountId: "account123",
        },
        {},
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();
      res.status.mockReturnValue(res);

      await expect(integrationController.connectTikTok(req, res)).rejects.toThrow(
        "TikTok API credentials not found"
      );
    });

    it("should create settings if they don't exist", async () => {
      const mockSettings = {
        _id: "settings123",
        business: "platform",
        tiktok: {},
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne.mockResolvedValueOnce(null);
      IntegrationSettings.create.mockResolvedValue(mockSettings);

      const req = mockRequest(
        {
          apiKey: "tiktok_key",
          apiSecret: "tiktok_secret",
          businessAccountId: "account123",
        },
        {},
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await integrationController.connectTikTok(req, res);

      expect(IntegrationSettings.create).toHaveBeenCalledWith({
        business: "platform",
      });
      expect(mockSettings.save).toHaveBeenCalled();
    });
  });

  describe("disconnectTikTok", () => {
    it("should disconnect TikTok successfully", async () => {
      const mockSettings = {
        _id: "settings123",
        business: "platform",
        tiktok: { enabled: true, status: "connected" },
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne.mockResolvedValue(mockSettings);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await integrationController.disconnectTikTok(req, res);

      expect(mockSettings.tiktok.enabled).toBe(false);
      expect(mockSettings.tiktok.status).toBe("disconnected");
      expect(mockSettings.save).toHaveBeenCalled();
      expect(eventBus.emit).toHaveBeenCalledWith(
        EventTypes.INTEGRATION_UPDATED,
        expect.objectContaining({
          platform: "tiktok",
          status: "disconnected",
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should throw error if settings not found", async () => {
      IntegrationSettings.findOne.mockResolvedValue(null);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();
      res.status.mockReturnValue(res);

      await expect(integrationController.disconnectTikTok(req, res)).rejects.toThrow(
        "Integration settings not found"
      );
    });
  });

  // ==================== connectInstagram / disconnectInstagram ====================

  describe("connectInstagram", () => {
    it("should connect Instagram successfully with provided credentials", async () => {
      const mockSettings = {
        _id: "settings123",
        business: "platform",
        instagram: {},
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne.mockResolvedValue(mockSettings);

      const req = mockRequest(
        {
          accessToken: "insta_token",
          businessAccountId: "account123",
          igUserId: "user123",
          automationSettings: { monitoringEnabled: true },
        },
        {},
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await integrationController.connectInstagram(req, res);

      expect(mockSettings.instagram.enabled).toBe(true);
      expect(mockSettings.instagram.status).toBe("connected");
      expect(mockSettings.instagram.accessToken).toBe("insta_token");
      expect(mockSettings.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should fail if access token is missing", async () => {
      const req = mockRequest(
        {
          businessAccountId: "account123",
        },
        {},
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();
      res.status.mockReturnValue(res);

      await expect(integrationController.connectInstagram(req, res)).rejects.toThrow(
        "Instagram access token not found"
      );
    });
  });

  describe("disconnectInstagram", () => {
    it("should disconnect Instagram successfully", async () => {
      const mockSettings = {
        _id: "settings123",
        business: "platform",
        instagram: { enabled: true, status: "connected" },
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne.mockResolvedValue(mockSettings);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await integrationController.disconnectInstagram(req, res);

      expect(mockSettings.instagram.enabled).toBe(false);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== connectWhatsApp / disconnectWhatsApp ====================

  describe("connectWhatsApp", () => {
    it("should connect WhatsApp successfully", async () => {
      const mockSettings = {
        _id: "settings123",
        business: "platform",
        whatsapp: {},
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne.mockResolvedValue(mockSettings);

      const req = mockRequest(
        {
          businessPhoneNumberId: "phone123",
          accessToken: "wa_token",
          automationSettings: { followupEnabled: true },
        },
        {},
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await integrationController.connectWhatsApp(req, res);

      expect(mockSettings.whatsapp.enabled).toBe(true);
      expect(mockSettings.whatsapp.status).toBe("connected");
      expect(mockSettings.whatsapp.businessPhoneNumberId).toBe("phone123");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should fail if required fields are missing", async () => {
      const req = mockRequest(
        {
          businessPhoneNumberId: "phone123",
          // Missing accessToken
        },
        {},
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();
      res.status.mockReturnValue(res);

      await expect(integrationController.connectWhatsApp(req, res)).rejects.toThrow(
        "Business Phone Number ID and Access Token are required"
      );
    });
  });

  describe("disconnectWhatsApp", () => {
    it("should disconnect WhatsApp successfully", async () => {
      const mockSettings = {
        _id: "settings123",
        business: "platform",
        whatsapp: { enabled: true, status: "connected" },
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne.mockResolvedValue(mockSettings);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await integrationController.disconnectWhatsApp(req, res);

      expect(mockSettings.whatsapp.enabled).toBe(false);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== connectEmail / disconnectEmail ====================

  describe("connectEmail", () => {
    it("should connect Email successfully", async () => {
      const mockSettings = {
        _id: "settings123",
        business: "platform",
        email: {},
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne.mockResolvedValue(mockSettings);

      const req = mockRequest(
        {
          provider: "sendgrid",
          apiKey: "email_key",
          senderEmail: "noreply@platform.com",
          senderName: "Platform",
          automationSettings: { followupEnabled: true },
        },
        {},
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await integrationController.connectEmail(req, res);

      expect(mockSettings.email.enabled).toBe(true);
      expect(mockSettings.email.provider).toBe("sendgrid");
      expect(mockSettings.email.senderEmail).toBe("noreply@platform.com");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should fail if required fields are missing", async () => {
      const req = mockRequest(
        {
          provider: "sendgrid",
          // Missing apiKey and senderEmail
        },
        {},
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();
      res.status.mockReturnValue(res);

      await expect(integrationController.connectEmail(req, res)).rejects.toThrow(
        "Provider, API Key, and Sender Email are required"
      );
    });
  });

  describe("disconnectEmail", () => {
    it("should disconnect Email successfully", async () => {
      const mockSettings = {
        _id: "settings123",
        business: "platform",
        email: { enabled: true, status: "connected" },
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne.mockResolvedValue(mockSettings);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await integrationController.disconnectEmail(req, res);

      expect(mockSettings.email.enabled).toBe(false);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== connectElevenLabs / disconnectElevenLabs ====================

  describe("connectElevenLabs", () => {
    it("should connect ElevenLabs successfully", async () => {
      const mockSettings = {
        _id: "settings123",
        business: "platform",
        elevenLabs: {},
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne.mockResolvedValue(mockSettings);

      const req = mockRequest(
        {
          apiKey: "el_key",
          voiceId: "voice123",
        },
        {},
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await integrationController.connectElevenLabs(req, res);

      expect(mockSettings.elevenLabs.enabled).toBe(true);
      expect(mockSettings.elevenLabs.apiKey).toBe("el_key");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should fail if API key is missing", async () => {
      const req = mockRequest(
        {
          voiceId: "voice123",
        },
        {},
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();
      res.status.mockReturnValue(res);

      await expect(integrationController.connectElevenLabs(req, res)).rejects.toThrow(
        "11Labs API key not found"
      );
    });
  });

  describe("disconnectElevenLabs", () => {
    it("should disconnect ElevenLabs successfully", async () => {
      const mockSettings = {
        _id: "settings123",
        business: "platform",
        elevenLabs: { enabled: true, status: "connected" },
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne.mockResolvedValue(mockSettings);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await integrationController.disconnectElevenLabs(req, res);

      expect(mockSettings.elevenLabs.enabled).toBe(false);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== updateAutomationSettings ====================

  describe("updateAutomationSettings", () => {
    it("should update automation settings for a platform", async () => {
      const mockSettings = {
        _id: "settings123",
        business: "platform",
        tiktok: {
          enabled: true,
          automationSettings: { monitoringEnabled: false },
        },
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne.mockResolvedValue(mockSettings);

      const req = mockRequest(
        {
          platform: "tiktok",
          automationSettings: { monitoringEnabled: true, frequency: "daily" },
        },
        {},
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await integrationController.updateAutomationSettings(req, res);

      expect(mockSettings.tiktok.automationSettings.monitoringEnabled).toBe(true);
      expect(mockSettings.tiktok.automationSettings.frequency).toBe("daily");
      expect(eventBus.emit).toHaveBeenCalledWith(
        EventTypes.AUTOMATION_SETTINGS_UPDATED,
        expect.objectContaining({
          platform: "tiktok",
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should fail if platform is invalid", async () => {
      const req = mockRequest(
        {
          platform: "invalid_platform",
          automationSettings: {},
        },
        {},
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();
      res.status.mockReturnValue(res);

      await expect(integrationController.updateAutomationSettings(req, res)).rejects.toThrow(
        "Invalid platform"
      );
    });

    it("should fail if settings not found", async () => {
      IntegrationSettings.findOne.mockResolvedValue(null);

      const req = mockRequest(
        {
          platform: "tiktok",
          automationSettings: {},
        },
        {},
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();
      res.status.mockReturnValue(res);

      await expect(integrationController.updateAutomationSettings(req, res)).rejects.toThrow(
        "Integration settings not found"
      );
    });

    it("should fail if integration is not configured", async () => {
      const mockSettings = {
        _id: "settings123",
        business: "platform",
        tiktok: null,
      };

      IntegrationSettings.findOne.mockResolvedValue(mockSettings);

      const req = mockRequest(
        {
          platform: "tiktok",
          automationSettings: {},
        },
        {},
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();
      res.status.mockReturnValue(res);

      await expect(integrationController.updateAutomationSettings(req, res)).rejects.toThrow(
        "tiktok integration not configured"
      );
    });
  });

  // ==================== getSocialMediaEngagement ====================

  describe("getSocialMediaEngagement", () => {
    it("should get all social media engagements with pagination", async () => {
      const mockEngagements = [
        {
          _id: "engagement1",
          platform: "tiktok",
          platformLevel: true,
          createdAt: new Date(),
        },
      ];

      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockResolvedValue(mockEngagements),
      };

      SocialMediaEngagement.find.mockReturnValue(mockChain);
      SocialMediaEngagement.countDocuments.mockResolvedValue(1);

      const req = mockRequest({}, {}, { platform: "tiktok", limit: "10", skip: "0" }, null, mockBusiness);
      const res = mockResponse();

      await integrationController.getSocialMediaEngagement(req, res);

      expect(SocialMediaEngagement.find).toHaveBeenCalledWith({ platformLevel: true, platform: "tiktok" });
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

  // ==================== getContentIdeas ====================

  describe("getContentIdeas", () => {
    it("should get content ideas with status filter", async () => {
      const mockIdeas = [
        {
          _id: "idea1",
          status: "approved",
          platformLevel: true,
        },
      ];

      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockResolvedValue(mockIdeas),
      };

      ContentIdea.find.mockReturnValue(mockChain);
      ContentIdea.countDocuments.mockResolvedValue(1);

      const req = mockRequest({}, {}, { status: "approved", limit: "20", skip: "0" }, null, mockBusiness);
      const res = mockResponse();

      await integrationController.getContentIdeas(req, res);

      expect(ContentIdea.find).toHaveBeenCalledWith({ platformLevel: true, status: "approved" });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== approveContentIdea ====================

  describe("approveContentIdea", () => {
    it("should approve a content idea", async () => {
      const mockIdea = {
        _id: "idea123",
        status: "approved",
        approvedBy: "business123",
        approvedAt: expect.any(Date),
        approvalNotes: "Great content!",
      };

      ContentIdea.findOneAndUpdate.mockResolvedValue(mockIdea);

      const req = mockRequest(
        {
          status: "approved",
          notes: "Great content!",
        },
        {
          ideaId: "idea123",
        },
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await integrationController.approveContentIdea(req, res);

      expect(ContentIdea.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "idea123", platformLevel: true },
        expect.objectContaining({
          status: "approved",
        }),
        { new: true }
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        EventTypes.CONTENT_IDEA_UPDATED,
        expect.objectContaining({
          ideaId: "idea123",
          status: "approved",
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should reject a content idea", async () => {
      const mockIdea = {
        _id: "idea123",
        status: "rejected",
        approvalNotes: "Not suitable for platform",
      };

      ContentIdea.findOneAndUpdate.mockResolvedValue(mockIdea);

      const req = mockRequest(
        {
          status: "rejected",
          notes: "Not suitable for platform",
        },
        {
          ideaId: "idea123",
        },
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await integrationController.approveContentIdea(req, res);

      expect(ContentIdea.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "idea123", platformLevel: true },
        expect.objectContaining({
          status: "rejected",
        }),
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should fail if status is invalid", async () => {
      const req = mockRequest(
        {
          status: "invalid_status",
          notes: "test",
        },
        {
          ideaId: "idea123",
        },
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();
      res.status.mockReturnValue(res);

      await expect(integrationController.approveContentIdea(req, res)).rejects.toThrow(
        "Status must be 'approved' or 'rejected'"
      );
    });

    it("should throw error if idea not found", async () => {
      ContentIdea.findOneAndUpdate.mockResolvedValue(null);

      const req = mockRequest(
        {
          status: "approved",
          notes: "Great content!",
        },
        {
          ideaId: "idea123",
        },
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();
      res.status.mockReturnValue(res);

      await expect(integrationController.approveContentIdea(req, res)).rejects.toThrow(
        "Content idea not found"
      );
    });
  });

  // ==================== getRegistrationFollowups ====================

  describe("getRegistrationFollowups", () => {
    it("should get registration follow-ups with status filter", async () => {
      const mockFollowups = [
        {
          _id: "followup1",
          status: "in_sequence",
          platformLevel: true,
        },
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

      await integrationController.getRegistrationFollowups(req, res);

      expect(RegistrationFollowup.find).toHaveBeenCalledWith({
        platformLevel: true,
        status: "in_sequence",
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== createFollowupTemplate ====================

  describe("createFollowupTemplate", () => {
    it("should create a follow-up template successfully", async () => {
      const mockTemplate = {
        _id: "template123",
        name: "Welcome Email",
        channel: "email",
        body: "Welcome to our platform!",
        subject: "Welcome",
        callToAction: "Get Started",
        sequencePosition: 1,
        platformLevel: true,
        createdBy: "business123",
      };

      FollowupTemplate.create.mockResolvedValue(mockTemplate);

      const req = mockRequest(
        {
          name: "Welcome Email",
          channel: "email",
          body: "Welcome to our platform!",
          subject: "Welcome",
          callToAction: "Get Started",
          sequencePosition: 1,
        },
        {},
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await integrationController.createFollowupTemplate(req, res);

      expect(FollowupTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Welcome Email",
          channel: "email",
          business: "platform",
        })
      );
      expect(logActivity).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("should fail if required fields are missing", async () => {
      const req = mockRequest(
        {
          name: "Welcome Email",
          // Missing channel and body
        },
        {},
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();
      res.status.mockReturnValue(res);

      await expect(integrationController.createFollowupTemplate(req, res)).rejects.toThrow(
        "Name, channel, and body are required"
      );
    });
  });

  // ==================== getFollowupTemplates ====================

  describe("getFollowupTemplates", () => {
    it("should get follow-up templates with channel filter", async () => {
      const mockTemplates = [
        {
          _id: "template1",
          name: "Welcome Email",
          channel: "email",
          platformLevel: true,
        },
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

      await integrationController.getFollowupTemplates(req, res);

      expect(FollowupTemplate.find).toHaveBeenCalledWith(
        expect.objectContaining({
          active: true,
          platformLevel: true,
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
