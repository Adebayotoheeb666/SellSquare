const asyncHandler = require("express-async-handler");
const IntegrationSettings = require("../models/integrationSettingsModel");
const SocialMediaEngagement = require("../models/socialMediaEngagementModel");
const ContentIdea = require("../models/contentIdeaModel");
const RegistrationFollowup = require("../models/registrationFollowupModel");
const FollowupTemplate = require("../models/followupTemplateModel");
const { eventBus, EventTypes } = require("../events/EventEmitter");
const logActivity = require("../middleWare/logActivityMiddleware");

/**
 * Get or create PLATFORM-LEVEL integration settings for super admin
 * (used for marketing the platform on social media, not for individual businesses)
 */
exports.getPlatformIntegrationSettings = asyncHandler(async (req, res) => {
  // Use empty string or "platform" as the identifier for platform-level integrations
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;

  let settings = await IntegrationSettings.findOne({ business: platformId });

  if (!settings) {
    settings = await IntegrationSettings.create({
      business: platformId,
    });
  }

  // Exclude sensitive data from response
  const settingsObj = settings.toObject();
  delete settingsObj.tiktok?.apiKey;
  delete settingsObj.tiktok?.apiSecret;
  delete settingsObj.tiktok?.accessToken;
  delete settingsObj.tiktok?.refreshToken;
  delete settingsObj.instagram?.apiKey;
  delete settingsObj.instagram?.accessToken;
  delete settingsObj.instagram?.refreshToken;
  delete settingsObj.whatsapp?.accessToken;
  delete settingsObj.whatsapp?.webhookToken;
  delete settingsObj.email?.apiKey;
  delete settingsObj.elevenLabs?.apiKey;

  res.status(200).json({
    success: true,
    data: {
      ...settingsObj,
      tiktok: {
        ...settingsObj.tiktok,
        clientKey: process.env.TIKTOK_CLIENT_ID,
        redirectUri: process.env.TIKTOK_REDIRECT_URI,
      }
    },
  });
});

/**
 * Connect TikTok Integration for Platform Marketing
 * Super admin only
 */
exports.connectTikTok = asyncHandler(async (req, res) => {
  const { apiKey, apiSecret, businessAccountId, automationSettings } = req.body;
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;

  // Use environment variables or request body credentials
  const tiktokApiKey = apiKey || process.env.TIKTOK_CLIENT_ID;
  const tiktokApiSecret = apiSecret || process.env.TIKTOK_CLIENT_SECRET;

  if (!tiktokApiKey || !tiktokApiSecret) {
    res.status(400);
    throw new Error("TikTok API credentials not found. Configure environment variables or provide credentials.");
  }

  let settings = await IntegrationSettings.findOne({ business: platformId });
  if (!settings) {
    settings = await IntegrationSettings.create({ business: platformId });
  }

  settings.tiktok = {
    enabled: true,
    apiKey: tiktokApiKey,
    apiSecret: tiktokApiSecret,
    accessToken: process.env.TIKTOK_ACCESS_TOKEN,
    refreshToken: process.env.TIKTOK_REFRESH_TOKEN,
    businessAccountId,
    status: "connected",
    connectedAt: new Date(),
    automationSettings: automationSettings || settings.tiktok?.automationSettings,
  };

  await settings.save();

  // Log activity for the super admin
  await logActivity("Platform TikTok integration connected", {
    action: "integration_connected",
    platform: "tiktok",
    platformLevel: true,
  });

  // Emit event for realtime update
  eventBus.emit(EventTypes.INTEGRATION_UPDATED, {
    platform: "tiktok",
    status: "connected",
    platformLevel: true,
  });

  res.status(200).json({
    success: true,
    message: "TikTok setup initialized. Please use the login flow to complete connection.",
    data: { platform: "tiktok", status: "pending" },
  });
});

/**
 * TikTok OAuth Start - PKCE flow
 * Generates code_verifier + code_challenge and redirects to TikTok authorization
 */
exports.tiktokOAuthStart = asyncHandler(async (req, res) => {
  const crypto = require("crypto");

  const clientKey = process.env.TIKTOK_CLIENT_ID;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI || "http://localhost:4000/api/integrations/tiktok/callback";

  if (!clientKey) {
    res.status(500);
    throw new Error("TIKTOK_CLIENT_ID is not configured in environment variables.");
  }

  // PKCE: Generate code_verifier (43–128 chars, url-safe)
  const codeVerifier = crypto.randomBytes(64).toString("base64url");

  // PKCE: code_challenge = BASE64URL(SHA256(code_verifier))
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  // Random nonce for state
  const state = crypto.randomBytes(8).toString("hex");

  // Store code_verifier in a short-lived cookie so the callback can retrieve it
  res.cookie("tiktok_pkce_verifier", codeVerifier, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 10 * 60 * 1000, // 10 minutes
  });

  const params = new URLSearchParams({
    client_key: clientKey,
    scope: "user.info.basic,video.list,video.publish",
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const authUrl = `https://www.tiktok.com/v2/auth/authorize?${params.toString()}`;

  res.redirect(authUrl);
});

/**
 * TikTok OAuth Callback Handler
 * Exchanges code for tokens and saves them
 */
exports.tiktokCallback = asyncHandler(async (req, res) => {
  const { code, state } = req.query;
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;
  const axios = require("axios");
  const qs = require("querystring");

  if (!code) {
    return res.status(400).send("No authorization code received from TikTok");
  }

  // Retrieve the PKCE code_verifier stored during OAuth start
  const codeVerifier = req.cookies?.tiktok_pkce_verifier;
  if (!codeVerifier) {
    return res.status(400).send("PKCE verification failed: no code verifier found. Please try connecting again.");
  }
  res.clearCookie("tiktok_pkce_verifier");

  try {
    // Exchange code for tokens (include code_verifier for PKCE)
    const response = await axios.post(
      "https://open.tiktokapis.com/v2/oauth/token/",
      qs.stringify({
        client_key: process.env.TIKTOK_CLIENT_ID,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: process.env.TIKTOK_REDIRECT_URI || "http://localhost:4000/api/integrations/tiktok/callback",
        code_verifier: codeVerifier,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token, open_id, expires_in, refresh_expires_in } = response.data;

    if (!access_token) {
      throw new Error("Failed to obtain TikTok access token");
    }

    // Save tokens to database
    let settings = await IntegrationSettings.findOne({ business: platformId });
    if (!settings) {
      settings = await IntegrationSettings.create({ business: platformId });
    }

    settings.tiktok = {
      ...settings.tiktok,
      enabled: true,
      accessToken: access_token,
      refreshToken: refresh_token,
      businessAccountId: open_id, // Open ID is the user identifier in v2
      status: "connected",
      connectedAt: new Date(),
    };

    await settings.save();

    // Log activity
    await logActivity("TikTok account connected via OAuth", {
      action: "integration_connected",
      platform: "tiktok",
      platformLevel: true,
    });

    // Return success HTML that sends a message to the opener and closes
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: "tiktok_connected", status: "success" }, "*");
            }
            window.close();
          </script>
          <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
            <h2>TikTok Connected Successfully!</h2>
            <p>You can close this window now.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("TikTok Callback Error:", error.response?.data || error.message);
    res.status(500).send("Failed to connect TikTok: " + (error.response?.data?.error_description || error.message));
  }
});

/**
 * Disconnect TikTok Integration
 */
exports.disconnectTikTok = asyncHandler(async (req, res) => {
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;

  let settings = await IntegrationSettings.findOne({ business: platformId });
  if (!settings) {
    res.status(404);
    throw new Error("Integration settings not found");
  }

  settings.tiktok = {
    enabled: false,
    status: "disconnected",
  };

  await settings.save();

  await logActivity("Platform TikTok integration disconnected", {
    action: "integration_disconnected",
    platform: "tiktok",
    platformLevel: true,
  });

  eventBus.emit(EventTypes.INTEGRATION_UPDATED, {
    platform: "tiktok",
    status: "disconnected",
    platformLevel: true,
  });

  res.status(200).json({
    success: true,
    message: "TikTok integration disconnected successfully",
  });
});

/**
 * Connect Instagram Integration for Platform Marketing
 */
exports.connectInstagram = asyncHandler(async (req, res) => {
  const { accessToken, businessAccountId, igUserId, automationSettings } = req.body;
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;

  const instagramAccessToken = accessToken || process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!instagramAccessToken) {
    res.status(400);
    throw new Error("Instagram access token not found. Configure environment variables or provide credentials.");
  }

  let settings = await IntegrationSettings.findOne({ business: platformId });
  if (!settings) {
    settings = await IntegrationSettings.create({ business: platformId });
  }

  settings.instagram = {
    enabled: true,
    accessToken: instagramAccessToken,
    businessAccountId: businessAccountId || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
    igUserId,
    status: "connected",
    connectedAt: new Date(),
    automationSettings: automationSettings || settings.instagram?.automationSettings,
  };

  await settings.save();

  await logActivity("Platform Instagram integration connected", {
    action: "integration_connected",
    platform: "instagram",
    platformLevel: true,
  });

  eventBus.emit(EventTypes.INTEGRATION_UPDATED, {
    platform: "instagram",
    status: "connected",
    platformLevel: true,
  });

  res.status(200).json({
    success: true,
    message: "Instagram integration connected successfully for platform marketing",
    data: { platform: "instagram", status: "connected" },
  });
});

/**
 * Disconnect Instagram Integration
 */
exports.disconnectInstagram = asyncHandler(async (req, res) => {
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;

  let settings = await IntegrationSettings.findOne({ business: platformId });
  if (!settings) {
    res.status(404);
    throw new Error("Integration settings not found");
  }

  settings.instagram = {
    enabled: false,
    status: "disconnected",
  };

  await settings.save();

  await logActivity("Platform Instagram integration disconnected", {
    action: "integration_disconnected",
    platform: "instagram",
    platformLevel: true,
  });

  eventBus.emit(EventTypes.INTEGRATION_UPDATED, {
    platform: "instagram",
    status: "disconnected",
    platformLevel: true,
  });

  res.status(200).json({
    success: true,
    message: "Instagram integration disconnected successfully",
  });
});

/**
 * Connect WhatsApp Integration for Follow-up Messages
 */
exports.connectWhatsApp = asyncHandler(async (req, res) => {
  const { automationSettings } = req.body;
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;

  // Use env variables as the primary source (super admin only)
  const businessPhoneNumberId = req.body.businessPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = req.body.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

  if (!businessPhoneNumberId || !accessToken) {
    res.status(400);
    throw new Error(
      "WhatsApp credentials not found. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN environment variables."
    );
  }

  let settings = await IntegrationSettings.findOne({ business: platformId });
  if (!settings) {
    settings = await IntegrationSettings.create({ business: platformId });
  }

  settings.whatsapp = {
    enabled: true,
    businessPhoneNumberId,
    accessToken,
    status: "connected",
    connectedAt: new Date(),
    automationSettings: automationSettings || settings.whatsapp?.automationSettings,
  };

  await settings.save();

  await logActivity("Platform WhatsApp integration connected", {
    action: "integration_connected",
    platform: "whatsapp",
    platformLevel: true,
  });

  eventBus.emit(EventTypes.INTEGRATION_UPDATED, {
    platform: "whatsapp",
    status: "connected",
    platformLevel: true,
  });

  res.status(200).json({
    success: true,
    message: "WhatsApp integration connected successfully",
    data: { platform: "whatsapp", status: "connected" },
  });
});

/**
 * Disconnect WhatsApp Integration
 */
exports.disconnectWhatsApp = asyncHandler(async (req, res) => {
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;

  let settings = await IntegrationSettings.findOne({ business: platformId });
  if (!settings) {
    res.status(404);
    throw new Error("Integration settings not found");
  }

  settings.whatsapp = {
    enabled: false,
    status: "disconnected",
  };

  await settings.save();

  await logActivity("Platform WhatsApp integration disconnected", {
    action: "integration_disconnected",
    platform: "whatsapp",
    platformLevel: true,
  });

  eventBus.emit(EventTypes.INTEGRATION_UPDATED, {
    platform: "whatsapp",
    status: "disconnected",
    platformLevel: true,
  });

  res.status(200).json({
    success: true,
    message: "WhatsApp integration disconnected successfully",
  });
});

/**
 * Connect Email Integration for Follow-up Sequences
 */
exports.connectEmail = asyncHandler(async (req, res) => {
  const { senderName, automationSettings } = req.body;
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;

  // Use env variables as the primary source (super admin only)
  const provider = req.body.provider || process.env.EMAIL_PROVIDER || "sendgrid";
  const apiKey = req.body.apiKey || process.env.EMAIL_API_KEY;
  const senderEmail = req.body.senderEmail || process.env.EMAIL_SENDER;

  if (!apiKey || !senderEmail) {
    res.status(400);
    throw new Error(
      "Email credentials not found. Set EMAIL_API_KEY and EMAIL_SENDER environment variables."
    );
  }

  let settings = await IntegrationSettings.findOne({ business: platformId });
  if (!settings) {
    settings = await IntegrationSettings.create({ business: platformId });
  }

  settings.email = {
    enabled: true,
    provider,
    apiKey,
    senderEmail,
    senderName,
    status: "connected",
    connectedAt: new Date(),
    automationSettings: automationSettings || settings.email?.automationSettings,
  };

  await settings.save();

  await logActivity("Platform Email integration connected", {
    action: "integration_connected",
    platform: "email",
    platformLevel: true,
  });

  eventBus.emit(EventTypes.INTEGRATION_UPDATED, {
    platform: "email",
    status: "connected",
    platformLevel: true,
  });

  res.status(200).json({
    success: true,
    message: "Email integration connected successfully",
    data: { platform: "email", status: "connected" },
  });
});

/**
 * Disconnect Email Integration
 */
exports.disconnectEmail = asyncHandler(async (req, res) => {
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;

  let settings = await IntegrationSettings.findOne({ business: platformId });
  if (!settings) {
    res.status(404);
    throw new Error("Integration settings not found");
  }

  settings.email = {
    enabled: false,
    status: "disconnected",
  };

  await settings.save();

  await logActivity("Platform Email integration disconnected", {
    action: "integration_disconnected",
    platform: "email",
    platformLevel: true,
  });

  eventBus.emit(EventTypes.INTEGRATION_UPDATED, {
    platform: "email",
    status: "disconnected",
    platformLevel: true,
  });

  res.status(200).json({
    success: true,
    message: "Email integration disconnected successfully",
  });
});

/**
 * Connect 11Labs Integration for Audio Content Generation
 */
exports.connectElevenLabs = asyncHandler(async (req, res) => {
  const { apiKey, voiceId } = req.body;
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;

  const elevenLabsApiKey = apiKey || process.env.ELEVENLABS_API_KEY;

  if (!elevenLabsApiKey) {
    res.status(400);
    throw new Error("11Labs API key not found. Configure environment variables or provide credentials.");
  }

  let settings = await IntegrationSettings.findOne({ business: platformId });
  if (!settings) {
    settings = await IntegrationSettings.create({ business: platformId });
  }

  settings.elevenLabs = {
    enabled: true,
    apiKey: elevenLabsApiKey,
    voiceId: voiceId || process.env.ELEVENLABS_VOICE_ID,
    status: "connected",
    connectedAt: new Date(),
  };

  await settings.save();

  await logActivity("Platform 11Labs integration connected", {
    action: "integration_connected",
    platform: "elevenlabs",
    platformLevel: true,
  });

  eventBus.emit(EventTypes.INTEGRATION_UPDATED, {
    platform: "elevenlabs",
    status: "connected",
    platformLevel: true,
  });

  res.status(200).json({
    success: true,
    message: "11Labs integration connected successfully",
    data: { platform: "elevenlabs", status: "connected" },
  });
});

/**
 * Disconnect 11Labs Integration
 */
exports.disconnectElevenLabs = asyncHandler(async (req, res) => {
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;

  let settings = await IntegrationSettings.findOne({ business: platformId });
  if (!settings) {
    res.status(404);
    throw new Error("Integration settings not found");
  }

  settings.elevenLabs = {
    enabled: false,
    status: "disconnected",
  };

  await settings.save();

  await logActivity("Platform 11Labs integration disconnected", {
    action: "integration_disconnected",
    platform: "elevenlabs",
    platformLevel: true,
  });

  eventBus.emit(EventTypes.INTEGRATION_UPDATED, {
    platform: "elevenlabs",
    status: "disconnected",
    platformLevel: true,
  });

  res.status(200).json({
    success: true,
    message: "11Labs integration disconnected successfully",
  });
});

/**
 * Update automation settings for a platform integration
 */
exports.updateAutomationSettings = asyncHandler(async (req, res) => {
  const { platform, automationSettings } = req.body;
  const platformId = process.env.SUPERADMIN_BUSINESS_ID;

  const validPlatforms = ["tiktok", "instagram", "whatsapp", "email"];
  if (!validPlatforms.includes(platform)) {
    res.status(400);
    throw new Error(`Invalid platform. Must be one of: ${validPlatforms.join(", ")}`);
  }

  let settings = await IntegrationSettings.findOne({ business: platformId });
  if (!settings) {
    res.status(404);
    throw new Error("Integration settings not found");
  }

  if (!settings[platform]) {
    res.status(400);
    throw new Error(`${platform} integration not configured`);
  }

  settings[platform].automationSettings = {
    ...settings[platform].automationSettings,
    ...automationSettings,
  };

  await settings.save();

  await logActivity(`Platform ${platform} automation settings updated`, {
    action: "automation_settings_updated",
    platform,
    platformLevel: true,
  });

  eventBus.emit(EventTypes.AUTOMATION_SETTINGS_UPDATED, {
    platform,
    settings: automationSettings,
    platformLevel: true,
  });

  res.status(200).json({
    success: true,
    message: `${platform} automation settings updated successfully`,
  });
});

/**
 * Get social media engagement data (platform-level)
 */
exports.getSocialMediaEngagement = asyncHandler(async (req, res) => {
  const { platform, limit = 20, skip = 0 } = req.query;

  const query = { platformLevel: true };
  if (platform) {
    query.platform = platform;
  }

  const engagements = await SocialMediaEngagement.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip));

  const total = await SocialMediaEngagement.countDocuments(query);

  res.status(200).json({
    success: true,
    data: engagements,
    pagination: {
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
    },
  });
});

/**
 * Get content ideas for platform marketing
 */
exports.getContentIdeas = asyncHandler(async (req, res) => {
  const { status, limit = 20, skip = 0 } = req.query;

  const query = { platformLevel: true };
  if (status) {
    query.status = status;
  }

  const ideas = await ContentIdea.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip));

  const total = await ContentIdea.countDocuments(query);

  res.status(200).json({
    success: true,
    data: ideas,
    pagination: {
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
    },
  });
});

/**
 * Approve or reject content idea for platform marketing
 */
exports.approveContentIdea = asyncHandler(async (req, res) => {
  const { ideaId } = req.params;
  const { status, notes } = req.body; // status: "approved" or "rejected"

  if (!["approved", "rejected"].includes(status)) {
    res.status(400);
    throw new Error("Status must be 'approved' or 'rejected'");
  }

  const idea = await ContentIdea.findOneAndUpdate(
    { _id: ideaId, platformLevel: true },
    {
      status,
      approvedBy: req.business._id,
      approvedAt: status === "approved" ? new Date() : null,
      approvalNotes: notes || "",
    },
    { new: true }
  );

  if (!idea) {
    res.status(404);
    throw new Error("Content idea not found");
  }

  await logActivity(`Platform content idea ${status}`, {
    action: `content_idea_${status}`,
    ideaId,
    platformLevel: true,
  });

  eventBus.emit(EventTypes.CONTENT_IDEA_UPDATED, {
    ideaId,
    status,
    platformLevel: true,
  });

  res.status(200).json({
    success: true,
    message: `Content idea ${status}`,
    data: idea,
  });
});

/**
 * Get registration follow-ups (for new signups to the platform)
 */
exports.getRegistrationFollowups = asyncHandler(async (req, res) => {
  const { status, limit = 20, skip = 0 } = req.query;

  const query = { platformLevel: true };
  if (status) {
    query.status = status;
  }

  const followups = await RegistrationFollowup.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip));

  const total = await RegistrationFollowup.countDocuments(query);

  res.status(200).json({
    success: true,
    data: followups,
    pagination: {
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
    },
  });
});

/**
 * Create or update follow-up templates
 */
exports.createFollowupTemplate = asyncHandler(async (req, res) => {
  const { name, channel, body, subject, callToAction, sequencePosition } = req.body;

  if (!name || !channel || !body) {
    res.status(400);
    throw new Error("Name, channel, and body are required");
  }

  const template = await FollowupTemplate.create({
    business: process.env.SUPERADMIN_BUSINESS_ID,
    name,
    channel,
    body,
    subject,
    callToAction,
    sequencePosition,
    createdBy: req.business._id,
    platformLevel: true,
  });

  await logActivity("Platform follow-up template created", {
    action: "template_created",
    templateId: template._id,
    platformLevel: true,
  });

  res.status(201).json({
    success: true,
    message: "Follow-up template created successfully",
    data: template,
  });
});

/**
 * Get follow-up templates
 */
exports.getFollowupTemplates = asyncHandler(async (req, res) => {
  const { channel, limit = 20, skip = 0 } = req.query;

  const query = { business: process.env.SUPERADMIN_BUSINESS_ID, active: true, platformLevel: true };
  if (channel) {
    query.channel = channel;
  }

  const templates = await FollowupTemplate.find(query)
    .sort({ sequencePosition: 1, createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip));

  const total = await FollowupTemplate.countDocuments(query);

  res.status(200).json({
    success: true,
    data: templates,
    pagination: {
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
    },
  });
});

module.exports = exports;
