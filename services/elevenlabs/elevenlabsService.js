const axios = require("axios");
const IntegrationSettings = require("../../models/integrationSettingsModel");
const ContentIdea = require("../../models/contentIdeaModel");

class ElevenLabsService {
  constructor() {
    this.baseUrl = "https://api.elevenlabs.io";
    this.apiKey = process.env.ELEVENLABS_API_KEY;
  }

  /**
   * Get ElevenLabs credentials
   */
  async getElevenLabsClient(businessId) {
    const settings = await IntegrationSettings.findOne({ business: businessId }).select(
      "+elevenLabs.apiKey +elevenLabs.voiceId"
    );

    if (!settings?.elevenLabs.enabled) {
      throw new Error("ElevenLabs integration not configured for this business");
    }

    if (!settings.elevenLabs.apiKey) {
      throw new Error("ElevenLabs API key not found");
    }

    return {
      apiKey: settings.elevenLabs.apiKey || this.apiKey,
      voiceId: settings.elevenLabs.voiceId || "21m00Tcm4TlvDq8ikWAM", // Default voice
    };
  }

  /**
   * Generate audio from text for TikTok/Instagram Reels
   */
  async generateAudio(businessId, text, voiceId = null) {
    try {
      const client = await this.getElevenLabsClient(businessId);
      const voice = voiceId || client.voiceId;

      const response = await axios.post(
        `${this.baseUrl}/v1/text-to-speech/${voice}`,
        {
          text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        },
        {
          headers: {
            "xi-api-key": client.apiKey,
            "Content-Type": "application/json",
          },
          responseType: "arraybuffer",
        }
      );

      return {
        success: true,
        audioBuffer: response.data,
        duration: this.estimateAudioDuration(text),
      };
    } catch (error) {
      console.error("ElevenLabs audio generation error:", error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Estimate audio duration from text
   */
  estimateAudioDuration(text) {
    // Average speaking rate: 150 words per minute
    const wordCount = text.split(/\s+/).length;
    return Math.ceil((wordCount / 150) * 60); // seconds
  }

  /**
   * Get available voices
   */
  async getAvailableVoices(apiKey = null) {
    try {
      const key = apiKey || this.apiKey;

      const response = await axios.get(`${this.baseUrl}/v1/voices`, {
        headers: {
          "xi-api-key": key,
        },
      });

      return response.data.voices;
    } catch (error) {
      console.error("Failed to get ElevenLabs voices:", error.message);
      throw error;
    }
  }

  /**
   * Generate video script for TikTok/Instagram from content idea
   */
  async generateVideoScript(contentIdea) {
    const scriptTemplate = `
[HOOK - 0-2 seconds]
${contentIdea.variations.tiktok.script || "Grab attention with an eye-catching opening"}

[BODY - 2-10 seconds]
${contentIdea.suggestedContent.body || "Share the main message or value proposition"}

[CTA - 10-15 seconds]
${contentIdea.suggestedContent.callToAction || "Direct viewers to take action"}

Suggested audio: ${contentIdea.variations.tiktok.audioSuggestion || "upbeat"}
Duration: ${contentIdea.variations.tiktok.duration || 15} seconds
Hashtags: ${contentIdea.variations.tiktok.hashtags?.join(" ") || "#content #engage"}
    `;

    return scriptTemplate.trim();
  }

  /**
   * Generate complete content package for posting
   */
  async generateContentPackage(businessId, contentIdeaId) {
    try {
      const idea = await ContentIdea.findOne({
        _id: contentIdeaId,
        business: businessId,
      });

      if (!idea) {
        throw new Error("Content idea not found");
      }

      // Generate video script
      const script = await this.generateVideoScript(idea);

      // Generate audio (optional, depends on media type)
      let audioUrl = null;
      if (idea.suggestedContent.mediaType === "video" || idea.suggestedContent.mediaType === "reels") {
        try {
          const audioData = await this.generateAudio(businessId, script);
          // In production, upload to storage service
          // audioUrl = await uploadToStorage(audioData.audioBuffer);
          console.log(`Generated audio for idea ${contentIdeaId}, duration: ${audioData.duration}s`);
        } catch (error) {
          console.error("Failed to generate audio:", error.message);
        }
      }

      return {
        ideaId: contentIdeaId,
        script,
        audioUrl,
        videoScript: idea.variations.tiktok?.script,
        caption: idea.variations.instagram?.caption,
        hashtags: {
          tiktok: idea.variations.tiktok?.hashtags || [],
          instagram: idea.variations.instagram?.hashtags || [],
        },
        cta: idea.suggestedContent.callToAction,
        mediaType: idea.suggestedContent.mediaType,
        duration: idea.variations.tiktok?.duration,
        readyForApproval: true,
      };
    } catch (error) {
      console.error("Error generating content package:", error.message);
      throw error;
    }
  }

  /**
   * Submit content for manual approval
   */
  async submitForApproval(businessId, contentIdeaId, contentPackage) {
    try {
      const idea = await ContentIdea.findOneAndUpdate(
        { _id: contentIdeaId, business: businessId },
        {
          status: "pending_approval",
          aiGeneration: {
            ...idea.aiGeneration,
            contentPackage,
            submittedForApprovalAt: new Date(),
          },
        },
        { new: true }
      );

      if (!idea) {
        throw new Error("Content idea not found");
      }

      // Emit event for approval notification
      const { eventBus, EventTypes } = require("../../events/EventEmitter");
      eventBus.emit(EventTypes.CONTENT_PENDING_APPROVAL, {
        businessId,
        ideaId: contentIdeaId,
        contentPackage,
      });

      return {
        success: true,
        message: "Content submitted for approval",
        ideaId: contentIdeaId,
      };
    } catch (error) {
      console.error("Error submitting for approval:", error.message);
      throw error;
    }
  }

  /**
   * Approve and schedule content for automatic posting
   */
  async approveAndSchedule(businessId, contentIdeaId, scheduleData) {
    try {
      const idea = await ContentIdea.findOneAndUpdate(
        { _id: contentIdeaId, business: businessId },
        {
          status: "approved",
          approvedAt: new Date(),
          "scheduledFor.platform": scheduleData.platforms,
          "scheduledFor.scheduledDate": scheduleData.scheduledDate,
        },
        { new: true }
      );

      if (!idea) {
        throw new Error("Content idea not found");
      }

      // Emit event for scheduling
      const { eventBus, EventTypes } = require("../../events/EventEmitter");
      eventBus.emit(EventTypes.CONTENT_APPROVED_FOR_POSTING, {
        businessId,
        ideaId: contentIdeaId,
        platforms: scheduleData.platforms,
        scheduledDate: scheduleData.scheduledDate,
      });

      return {
        success: true,
        message: "Content approved and scheduled",
        ideaId: contentIdeaId,
        scheduledDate: scheduleData.scheduledDate,
      };
    } catch (error) {
      console.error("Error approving content:", error.message);
      throw error;
    }
  }

  /**
   * Reject content idea
   */
  async rejectContent(businessId, contentIdeaId, rejectionReason) {
    try {
      const idea = await ContentIdea.findOneAndUpdate(
        { _id: contentIdeaId, business: businessId },
        {
          status: "rejected",
          approvalNotes: rejectionReason,
          approvedAt: null,
        },
        { new: true }
      );

      if (!idea) {
        throw new Error("Content idea not found");
      }

      // Emit event
      const { eventBus, EventTypes } = require("../../events/EventEmitter");
      eventBus.emit(EventTypes.CONTENT_REJECTED, {
        businessId,
        ideaId: contentIdeaId,
        reason: rejectionReason,
      });

      return {
        success: true,
        message: "Content rejected",
        ideaId: contentIdeaId,
      };
    } catch (error) {
      console.error("Error rejecting content:", error.message);
      throw error;
    }
  }

  /**
   * Test ElevenLabs connection
   */
  async testConnection(apiKey) {
    try {
      const response = await axios.get(`${this.baseUrl}/v1/user`, {
        headers: {
          "xi-api-key": apiKey || this.apiKey,
        },
      });

      return {
        connected: true,
        userInfo: {
          subscription_tier: response.data.subscription.tier,
          character_limit: response.data.subscription.character_limit,
          characters_used: response.data.subscription.character_count,
        },
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
      };
    }
  }
}

module.exports = new ElevenLabsService();
