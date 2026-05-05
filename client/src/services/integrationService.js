import axios from "axios";
import { toast } from "sonner";
import { BACKEND_URL } from "../config/apiConfig";

const getErrorMessage = (error) => {
  if (error.response && error.response.data) {
    return error.response.data.message || JSON.stringify(error.response.data);
  }
  return error.message || "An unexpected error occurred";
};

/**
 * Get integration settings for the business
 */
export const getIntegrationSettings = async () => {
  try {
    const res = await axios.get(`${BACKEND_URL}/api/integrations/settings`);
    return res.data?.data || {};
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

/**
 * Connect TikTok integration (using environment variables for super admin)
 */
export const connectTikTok = async (automationSettings = {}) => {
  try {
    const res = await axios.post(`${BACKEND_URL}/api/integrations/tiktok/connect`, {
      automationSettings,
    });
    toast.success("TikTok connected successfully");
    return res.data?.data;
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

/**
 * Disconnect TikTok integration
 */
export const disconnectTikTok = async () => {
  try {
    const res = await axios.post(`${BACKEND_URL}/api/integrations/tiktok/disconnect`);
    toast.success("TikTok disconnected successfully");
    return res.data?.data;
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

/**
 * Connect Instagram integration (using environment variables for super admin)
 */
export const connectInstagram = async (automationSettings = {}) => {
  try {
    const res = await axios.post(`${BACKEND_URL}/api/integrations/instagram/connect`, {
      automationSettings,
    });
    toast.success("Instagram connected successfully");
    return res.data?.data;
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

/**
 * Disconnect Instagram integration
 */
export const disconnectInstagram = async () => {
  try {
    const res = await axios.post(`${BACKEND_URL}/api/integrations/instagram/disconnect`);
    toast.success("Instagram disconnected successfully");
    return res.data?.data;
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

/**
 * Connect WhatsApp integration
 * Credentials are read from env vars on the backend; pass empty object or override fields if needed.
 */
export const connectWhatsApp = async (data = {}) => {
  try {
    const res = await axios.post(`${BACKEND_URL}/api/integrations/whatsapp/connect`, data);
    toast.success("WhatsApp connected successfully");
    return res.data?.data;
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

/**
 * Disconnect WhatsApp integration
 */
export const disconnectWhatsApp = async () => {
  try {
    const res = await axios.post(`${BACKEND_URL}/api/integrations/whatsapp/disconnect`);
    toast.success("WhatsApp disconnected successfully");
    return res.data?.data;
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

/**
 * Connect Email integration
 * Credentials are read from env vars on the backend; pass empty object or override fields if needed.
 */
export const connectEmail = async (data = {}) => {
  try {
    const res = await axios.post(`${BACKEND_URL}/api/integrations/email/connect`, data);
    toast.success("Email connected successfully");
    return res.data?.data;
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

/**
 * Disconnect Email integration
 */
export const disconnectEmail = async () => {
  try {
    const res = await axios.post(`${BACKEND_URL}/api/integrations/email/disconnect`);
    toast.success("Email disconnected successfully");
    return res.data?.data;
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

/**
 * Connect ElevenLabs integration
 */
export const connectElevenLabs = async (apiKey) => {
  try {
    const res = await axios.post(`${BACKEND_URL}/api/integrations/elevenlabs/connect`, {
      apiKey,
    });
    toast.success("ElevenLabs connected successfully");
    return res.data?.data;
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

/**
 * Disconnect ElevenLabs integration
 */
export const disconnectElevenLabs = async () => {
  try {
    const res = await axios.post(`${BACKEND_URL}/api/integrations/elevenlabs/disconnect`);
    toast.success("ElevenLabs disconnected successfully");
    return res.data?.data;
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

/**
 * Update automation settings for a platform
 */
export const updateAutomationSettings = async (platform, automationSettings) => {
  try {
    const res = await axios.patch(`${BACKEND_URL}/api/integrations/automation-settings`, {
      platform,
      automationSettings,
    });
    toast.success("Automation settings updated");
    return res.data?.data;
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

/**
 * Update global automation schedules
 */
export const updateSchedules = async (schedules) => {
  try {
    const res = await axios.patch(`${BACKEND_URL}/api/automation/schedules/update`, schedules);
    toast.success("Automation schedules updated successfully");
    return res.data?.data;
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

/**
 * Get social media engagement data
 */
export const getSocialMediaEngagement = async (platform, limit = 20, skip = 0) => {
  try {
    const res = await axios.get(`${BACKEND_URL}/api/integrations/engagement/social-media`, {
      params: { platform, limit, skip },
    });
    return res.data?.data || [];
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

/**
 * Get content ideas
 */
export const getContentIdeas = async (status, limit = 20, skip = 0) => {
  try {
    const res = await axios.get(`${BACKEND_URL}/api/integrations/content-ideas`, {
      params: { status, limit, skip },
    });
    return res.data?.data || [];
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

/**
 * Approve a content idea
 */
export const approveContentIdea = async (ideaId) => {
  try {
    const res = await axios.patch(`${BACKEND_URL}/api/integrations/content-ideas/${ideaId}/approve`);
    toast.success("Content idea approved");
    return res.data?.data;
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

/**
 * Get registration follow-ups
 */
export const getRegistrationFollowups = async () => {
  try {
    const res = await axios.get(`${BACKEND_URL}/api/integrations/followups/registration`);
    return res.data?.data || [];
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

/**
 * Create a follow-up template
 */
export const createFollowupTemplate = async (templateData) => {
  try {
    const res = await axios.post(`${BACKEND_URL}/api/integrations/templates/followup`, templateData);
    toast.success("Follow-up template created");
    return res.data?.data;
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

/**
 * Get follow-up templates
 */
export const getFollowupTemplates = async () => {
  try {
    const res = await axios.get(`${BACKEND_URL}/api/integrations/templates/followup`);
    return res.data?.data || [];
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};
/**
 * Test an integration connection
 */
export const testIntegration = async (platform) => {
  try {
    const res = await axios.get(`${BACKEND_URL}/api/automation/test-${platform}`);
    return res.data?.data;
  } catch (error) {
    const message = getErrorMessage(error);
    throw new Error(message);
  }
};
