const {
  getPlatformIntegrationSettings,
  connectTikTok,
  disconnectTikTok,
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
} = require("../../controllers/integrationController");

const IntegrationSettings = require("../../models/integrationSettingsModel");
const SocialMediaEngagement = require("../../models/socialMediaEngagementModel");
const ContentIdea = require("../../models/contentIdeaModel");
const RegistrationFollowup = require("../../models/registrationFollowupModel");
const FollowupTemplate = require("../../models/followupTemplateModel");
const { eventBus } = require("../../events/EventEmitter");
const { mockRequest, mockResponse } = require("../helpers/testHelpers");

// Mock the models
jest.mock("../../models/integrationSettingsModel");
jest.mock("../../models/socialMediaEngagementModel");
jest.mock("../../models/contentIdeaModel");
jest.mock("../../models/registrationFollowupModel");
jest.mock("../../models/followupTemplateModel");
jest.mock("../../events/EventEmitter", () => ({
  eventBus: { emit: jest.fn() },
  EventTypes: { INTEGRATION_UPDATED: "integration.updated" },
}));
jest.mock("../../middleWare/logActivityMiddleware", () => jest.fn().mockResolvedValue({}));

describe("Integration Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TIKTOK_CLIENT_ID = "test_tiktok_id";
    process.env.TIKTOK_CLIENT_SECRET = "test_tiktok_secret";
  });

  // ==================== Get Platform Integration Settings ====================

  describe("getPlatformIntegrationSettings", () => {
    test("should return existing platform integration settings", async () => {
      const mockSettings = {
        _id: "settings_1",
        business: "platform",
        tiktok: { enabled: true, status: "connected" },
        instagram: { enabled: false },
        toObject: jest.fn().mockReturnValue({
          _id: "settings_1",
          business: "platform",
          tiktok: { enabled: true, status: "connected" },
          instagram: { enabled: false },
        }),
      };

      IntegrationSettings.findOne = jest
        .fn()
        .mockResolvedValue(mockSettings);

      const req = mockRequest();
      const res = mockResponse();

      await getPlatformIntegrationSettings(req, res);

      expect(IntegrationSettings.findOne).toHaveBeenCalledWith({
        business: "platform",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object),
      });
    });

    test("should create new settings if they don't exist", async () => {
      IntegrationSettings.findOne = jest.fn().mockResolvedValue(null);

      const mockNewSettings = {
        _id: "settings_2",
        business: "platform",
        toObject: jest.fn().mockReturnValue({
          _id: "settings_2",
          business: "platform",
        }),
      };

      IntegrationSettings.create = jest
        .fn()
        .mockResolvedValue(mockNewSettings);

      const req = mockRequest();
      const res = mockResponse();

      await getPlatformIntegrationSettings(req, res);

      expect(IntegrationSettings.create).toHaveBeenCalledWith({
        business: "platform",
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("should exclude sensitive data from response", async () => {
      const mockSettings = {
        _id: "settings_1",
        business: "platform",
        tiktok: {
          enabled: true,
          apiKey: "secret_key",
          apiSecret: "secret_secret",
          accessToken: "access_token",
          refreshToken: "refresh_token",
        },
        instagram: {
          apiKey: "insta_key",
          accessToken: "insta_token",
          refreshToken: "insta_refresh",
        },
        toObject: jest.fn().mockReturnValue({
          tiktok: {
            enabled: true,
            apiKey: "secret_key",
            apiSecret: "secret_secret",
            accessToken: "access_token",
            refreshToken: "refresh_token",
          },
          instagram: {
            apiKey: "insta_key",
            accessToken: "insta_token",
            refreshToken: "insta_refresh",
          },
        }),
      };

      IntegrationSettings.findOne = jest
        .fn()
        .mockResolvedValue(mockSettings);

      const req = mockRequest();
      const res = mockResponse();

      await getPlatformIntegrationSettings(req, res);

      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.data.tiktok).not.toHaveProperty("apiKey");
      expect(callArgs.data.tiktok).not.toHaveProperty("apiSecret");
      expect(callArgs.data.instagram).not.toHaveProperty("apiKey");
    });
  });

  // ==================== Connect/Disconnect TikTok ====================

  describe("connectTikTok", () => {
    test("should connect TikTok with provided credentials", async () => {
      const mockSettings = {
        _id: "settings_1",
        business: "platform",
        tiktok: undefined,
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne = jest
        .fn()
        .mockResolvedValue(mockSettings);

      const req = mockRequest({
        apiKey: "custom_api_key",
        apiSecret: "custom_api_secret",
        businessAccountId: "biz_123",
        automationSettings: { monitoringEnabled: true },
      });
      const res = mockResponse();

      await connectTikTok(req, res);

      expect(mockSettings.save).toHaveBeenCalled();
      expect(mockSettings.tiktok).toEqual(
        expect.objectContaining({
          enabled: true,
          apiKey: "custom_api_key",
          status: "connected",
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(eventBus.emit).toHaveBeenCalled();
    });

    test("should use environment variables if credentials not provided", async () => {
      const mockSettings = {
        _id: "settings_1",
        business: "platform",
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne = jest
        .fn()
        .mockResolvedValue(mockSettings);

      const req = mockRequest({
        businessAccountId: "biz_123",
      });
      const res = mockResponse();

      await connectTikTok(req, res);

      expect(mockSettings.tiktok.apiKey).toBe("test_tiktok_id");
      expect(mockSettings.tiktok.apiSecret).toBe("test_tiktok_secret");
    });

    test("should throw error if no credentials provided or in env", async () => {
      delete process.env.TIKTOK_CLIENT_ID;
      delete process.env.TIKTOK_CLIENT_SECRET;

      const req = mockRequest({ businessAccountId: "biz_123" });
      const res = mockResponse();

      await expect(connectTikTok(req, res)).rejects.toThrow(
        /TikTok API credentials not found/
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("should create settings if they don't exist", async () => {
      IntegrationSettings.findOne = jest.fn().mockResolvedValue(null);

      const mockNewSettings = {
        _id: "settings_2",
        business: "platform",
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.create = jest
        .fn()
        .mockResolvedValue(mockNewSettings);

      const req = mockRequest({ businessAccountId: "biz_123" });
      const res = mockResponse();

      await connectTikTok(req, res);

      expect(IntegrationSettings.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("disconnectTikTok", () => {
    test("should disconnect TikTok integration", async () => {
      const mockSettings = {
        _id: "settings_1",
        business: "platform",
        tiktok: { enabled: true, status: "connected" },
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne = jest
        .fn()
        .mockResolvedValue(mockSettings);

      const req = mockRequest();
      const res = mockResponse();

      await disconnectTikTok(req, res);

      expect(mockSettings.tiktok.enabled).toBe(false);
      expect(mockSettings.tiktok.status).toBe("disconnected");
      expect(mockSettings.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(eventBus.emit).toHaveBeenCalled();
    });
  });

  // ==================== Connect/Disconnect Instagram ====================

  describe("connectInstagram", () => {
    test("should connect Instagram integration", async () => {
      const mockSettings = {
        _id: "settings_1",
        business: "platform",
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne = jest
        .fn()
        .mockResolvedValue(mockSettings);

      const req = mockRequest({
        accessToken: "ig_access_token",
        businessAccountId: "ig_123",
        igUserId: "user_123",
        automationSettings: { monitoringEnabled: true },
      });
      const res = mockResponse();

      await connectInstagram(req, res);

      expect(mockSettings.instagram).toEqual(
        expect.objectContaining({
          enabled: true,
          accessToken: "ig_access_token",
          status: "connected",
        })
      );
      expect(mockSettings.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("disconnectInstagram", () => {
    test("should disconnect Instagram integration", async () => {
      const mockSettings = {
        _id: "settings_1",
        business: "platform",
        instagram: { enabled: true, status: "connected" },
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne = jest
        .fn()
        .mockResolvedValue(mockSettings);

      const req = mockRequest();
      const res = mockResponse();

      await disconnectInstagram(req, res);

      expect(mockSettings.instagram.enabled).toBe(false);
      expect(mockSettings.instagram.status).toBe("disconnected");
      expect(mockSettings.save).toHaveBeenCalled();
    });
  });

  // ==================== WhatsApp Integration ====================

  describe("connectWhatsApp", () => {
    test("should connect WhatsApp integration", async () => {
      const mockSettings = {
        _id: "settings_1",
        business: "platform",
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne = jest
        .fn()
        .mockResolvedValue(mockSettings);

      const req = mockRequest({
        businessPhoneNumberId: "phone_123",
        accessToken: "whatsapp_token",
        automationSettings: { followupEnabled: true },
      });
      const res = mockResponse();

      await connectWhatsApp(req, res);

      expect(mockSettings.whatsapp).toEqual(
        expect.objectContaining({
          enabled: true,
          status: "connected",
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("disconnectWhatsApp", () => {
    test("should disconnect WhatsApp integration", async () => {
      const mockSettings = {
        _id: "settings_1",
        business: "platform",
        whatsapp: { enabled: true },
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne = jest
        .fn()
        .mockResolvedValue(mockSettings);

      const req = mockRequest();
      const res = mockResponse();

      await disconnectWhatsApp(req, res);

      expect(mockSettings.whatsapp.enabled).toBe(false);
      expect(mockSettings.save).toHaveBeenCalled();
    });
  });

  // ==================== Email Integration ====================

  describe("connectEmail", () => {
    test("should connect Email integration", async () => {
      const mockSettings = {
        _id: "settings_1",
        business: "platform",
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne = jest
        .fn()
        .mockResolvedValue(mockSettings);

      const req = mockRequest({
        provider: "sendgrid",
        apiKey: "sg_key_123",
        senderEmail: "admin@sellsquare.com",
        senderName: "SellSquare Admin",
        automationSettings: { followupEnabled: true },
      });
      const res = mockResponse();

      await connectEmail(req, res);

      expect(mockSettings.email).toEqual(
        expect.objectContaining({
          enabled: true,
          provider: "sendgrid",
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("disconnectEmail", () => {
    test("should disconnect Email integration", async () => {
      const mockSettings = {
        _id: "settings_1",
        business: "platform",
        email: { enabled: true },
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne = jest
        .fn()
        .mockResolvedValue(mockSettings);

      const req = mockRequest();
      const res = mockResponse();

      await disconnectEmail(req, res);

      expect(mockSettings.email.enabled).toBe(false);
      expect(mockSettings.save).toHaveBeenCalled();
    });
  });

  // ==================== ElevenLabs Integration ====================

  describe("connectElevenLabs", () => {
    test("should connect ElevenLabs integration", async () => {
      const mockSettings = {
        _id: "settings_1",
        business: "platform",
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne = jest
        .fn()
        .mockResolvedValue(mockSettings);

      const req = mockRequest({
        apiKey: "eleven_key",
        voiceId: "voice_123",
      });
      const res = mockResponse();

      await connectElevenLabs(req, res);

      expect(mockSettings.elevenLabs).toEqual(
        expect.objectContaining({
          enabled: true,
          apiKey: "eleven_key",
          voiceId: "voice_123",
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("disconnectElevenLabs", () => {
    test("should disconnect ElevenLabs integration", async () => {
      const mockSettings = {
        _id: "settings_1",
        business: "platform",
        elevenLabs: { enabled: true },
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne = jest
        .fn()
        .mockResolvedValue(mockSettings);

      const req = mockRequest();
      const res = mockResponse();

      await disconnectElevenLabs(req, res);

      expect(mockSettings.elevenLabs.enabled).toBe(false);
      expect(mockSettings.save).toHaveBeenCalled();
    });
  });

  // ==================== Update Automation Settings ====================

  describe("updateAutomationSettings", () => {
    test("should update automation settings for a platform", async () => {
      const mockSettings = {
        _id: "settings_1",
        business: "platform",
        tiktok: {
          automationSettings: {
            monitoringEnabled: false,
          },
        },
        save: jest.fn().mockResolvedValue(true),
      };

      IntegrationSettings.findOne = jest
        .fn()
        .mockResolvedValue(mockSettings);

      const req = mockRequest({
        platform: "tiktok",
        automationSettings: {
          monitoringEnabled: true,
          engagementEnabled: true,
        },
      });
      const res = mockResponse();

      await updateAutomationSettings(req, res);

      expect(mockSettings.tiktok.automationSettings.monitoringEnabled).toBe(
        true
      );
      expect(mockSettings.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== Get Social Media Engagement ====================

  describe("getSocialMediaEngagement", () => {
    test("should return social media engagements", async () => {
      const mockEngagements = [
        { _id: "eng_1", platform: "tiktok", likes: 100 },
        { _id: "eng_2", platform: "instagram", likes: 50 },
      ];

      SocialMediaEngagement.find = jest
        .fn()
        .mockReturnValue({
          limit: jest.fn().mockReturnValue({
            skip: jest.fn().mockResolvedValue(mockEngagements),
          }),
        });

      const req = mockRequest({}, {}, { limit: "20", skip: "0" });
      const res = mockResponse();

      await getSocialMediaEngagement(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockEngagements,
      });
    });

    test("should filter by platform if provided", async () => {
      const mockEngagements = [
        { _id: "eng_1", platform: "tiktok", likes: 100 },
      ];

      SocialMediaEngagement.find = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          skip: jest.fn().mockResolvedValue(mockEngagements),
        }),
      });

      const req = mockRequest(
        {},
        {},
        { platform: "tiktok", limit: "20", skip: "0" }
      );
      const res = mockResponse();

      await getSocialMediaEngagement(req, res);

      const findCall = SocialMediaEngagement.find.mock.calls[0][0];
      expect(findCall.platform).toBe("tiktok");
    });
  });

  // ==================== Get Content Ideas ====================

  describe("getContentIdeas", () => {
    test("should return content ideas", async () => {
      const mockIdeas = [
        { _id: "idea_1", title: "Content 1", status: "pending_approval" },
        { _id: "idea_2", title: "Content 2", status: "approved" },
      ];

      ContentIdea.find = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          skip: jest.fn().mockResolvedValue(mockIdeas),
        }),
      });

      const req = mockRequest(
        {},
        {},
        { status: "pending_approval", limit: "20", skip: "0" }
      );
      const res = mockResponse();

      await getContentIdeas(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockIdeas,
      });
    });
  });

  // ==================== Approve Content Idea ====================

  describe("approveContentIdea", () => {
    test("should approve a content idea", async () => {
      const mockIdea = {
        _id: "idea_1",
        status: "pending_approval",
        save: jest.fn().mockResolvedValue(true),
      };

      ContentIdea.findById = jest.fn().mockResolvedValue(mockIdea);

      const req = mockRequest(
        { notes: "Looks good" },
        { ideaId: "idea_1" }
      );
      const res = mockResponse();

      await approveContentIdea(req, res);

      expect(mockIdea.status).toBe("approved");
      expect(mockIdea.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("should throw error if idea not found", async () => {
      ContentIdea.findById = jest.fn().mockResolvedValue(null);

      const req = mockRequest({}, { ideaId: "nonexistent" });
      const res = mockResponse();

      await expect(approveContentIdea(req, res)).rejects.toThrow(
        /Content idea not found/
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ==================== Get Registration Followups ====================

  describe("getRegistrationFollowups", () => {
    test("should return registration followups", async () => {
      const mockFollowups = [
        { _id: "followup_1", status: "pending" },
        { _id: "followup_2", status: "completed" },
      ];

      RegistrationFollowup.find = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          skip: jest.fn().mockResolvedValue(mockFollowups),
        }),
      });

      const req = mockRequest(
        {},
        {},
        { status: "pending", limit: "20", skip: "0" }
      );
      const res = mockResponse();

      await getRegistrationFollowups(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== Followup Templates ====================

  describe("createFollowupTemplate", () => {
    test("should create a new followup template", async () => {
      const mockTemplate = {
        _id: "template_1",
        name: "Welcome Template",
        channel: "email",
        body: "Welcome to SellSquare!",
      };

      FollowupTemplate.create = jest
        .fn()
        .mockResolvedValue(mockTemplate);

      const req = mockRequest({
        name: "Welcome Template",
        channel: "email",
        body: "Welcome to SellSquare!",
        subject: "Welcome",
        callToAction: "Get Started",
        sequencePosition: 1,
      });
      const res = mockResponse();

      await createFollowupTemplate(req, res);

      expect(FollowupTemplate.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("getFollowupTemplates", () => {
    test("should return followup templates", async () => {
      const mockTemplates = [
        { _id: "template_1", name: "Welcome", channel: "email" },
        { _id: "template_2", name: "Follow-up", channel: "email" },
      ];

      FollowupTemplate.find = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          skip: jest.fn().mockResolvedValue(mockTemplates),
        }),
      });

      const req = mockRequest({}, {}, { channel: "email", limit: "20" });
      const res = mockResponse();

      await getFollowupTemplates(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTemplates,
      });
    });
  });
});
