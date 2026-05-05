const ContentIdea = require("../../models/contentIdeaModel");
const IntegrationSettings = require("../../models/integrationSettingsModel");
const instagramService = require("../../services/instagram/instagramService");
const tiktokService = require("../../services/tiktok/tiktokService");
const elevenlabsService = require("../../services/elevenlabs/elevenlabsService");
const { eventBus, EventTypes } = require("../../events/EventEmitter");

/**
 * Content Publishing Job with Retry Logic
 * Publishes approved content to TikTok and Instagram based on schedule
 */
class ContentPublishingJob {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
    this.publishingAttempts = new Map(); // Track publishing attempts
  }

  /**
   * Process and publish all scheduled content
   */
  async publishScheduledContent() {
    try {
      console.log("[Content Publishing] Starting job to publish scheduled content");

      const now = new Date();

      // Get all approved content scheduled for now or in the past
      const contentToPublish = await ContentIdea.find({
        status: "approved",
        "scheduledFor.scheduledDate": { $lte: now },
      });

      console.log(`[Content Publishing] Found ${contentToPublish.length} content items to publish`);

      for (const content of contentToPublish) {
        try {
          await this.publishContent(content);
        } catch (error) {
          console.error(
            `[Content Publishing] Error publishing content ${content._id}:`,
            error.message
          );
          // Schedule retry if max retries not exceeded
          await this.scheduleRetry(content._id);
        }
      }

      console.log("[Content Publishing] Job completed");
    } catch (error) {
      console.error("[Content Publishing] Job error:", error.message);
    }
  }

  /**
   * Schedule retry for failed publishing attempt
   */
  async scheduleRetry(contentIdeaId, attempt = 1) {
    const key = `${contentIdeaId}`;
    const currentAttempt = this.publishingAttempts.get(key) || 0;

    if (currentAttempt >= this.maxRetries) {
      console.error(
        `[Content Publishing] Max retries (${this.maxRetries}) exceeded for ${contentIdeaId}`
      );
      // Record final failure in database
      await ContentIdea.findByIdAndUpdate(contentIdeaId, {
        status: "publishing_failed",
      });
      return;
    }

    const nextAttempt = currentAttempt + 1;
    this.publishingAttempts.set(key, nextAttempt);

    // Calculate exponential backoff: 5s, 10s, 20s
    const delay = this.retryDelay * Math.pow(2, currentAttempt);

    console.log(
      `[Content Publishing] Scheduling retry ${nextAttempt}/${this.maxRetries} for ${contentIdeaId} in ${delay}ms`
    );

    setTimeout(async () => {
      try {
        const content = await ContentIdea.findById(contentIdeaId);
        if (content && content.status === "approved") {
          await this.publishContent(content);
          this.publishingAttempts.delete(key);
        }
      } catch (error) {
        console.error(`[Content Publishing] Retry failed for ${contentIdeaId}:`, error.message);
        // Schedule next retry
        await this.scheduleRetry(contentIdeaId, nextAttempt);
      }
    }, delay);
  }

  /**
   * Publish content to specified platforms with comprehensive error handling
   */
  async publishContent(contentIdea) {
    const { business, scheduledFor, variations } = contentIdea;

    if (!scheduledFor || !scheduledFor.platform) {
      throw new Error("Content not properly scheduled");
    }

    const platforms = Array.isArray(scheduledFor.platform)
      ? scheduledFor.platform
      : [scheduledFor.platform];

    const publishingResults = [];
    let hasSuccesses = false;
    let hasFailures = false;

    for (const platform of platforms) {
      let success = false;
      let result = null;
      let error = null;

      try {
        if (platform === "instagram") {
          result = await this.publishToInstagram(business, contentIdea);
          success = result && result.postId;
        } else if (platform === "tiktok") {
          result = await this.publishToTikTok(business, contentIdea);
          success = result && result.postId;
        } else {
          throw new Error(`Unsupported platform: ${platform}`);
        }

        if (!success) {
          throw new Error(`Publishing failed: no postId returned`);
        }

        hasSuccesses = true;

        // Record successful publishing history
        contentIdea.publishingHistory.push({
          platform,
          publishedAt: new Date(),
          postId: result.postId,
          postUrl: result.postUrl || `https://${platform}.com/p/${result.postId}`,
          status: "published",
          performance: {
            views: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            saves: 0,
          },
        });

        publishingResults.push({
          platform,
          success: true,
          postId: result.postId,
          postUrl: result.postUrl,
        });

        console.log(
          `[Content Publishing] Successfully published to ${platform}: ${contentIdea.title}`
        );
      } catch (err) {
        hasFailures = true;
        error = err.message;
        console.error(
          `[Content Publishing] Failed to publish to ${platform}:`,
          error
        );

        publishingResults.push({
          platform,
          success: false,
          error,
        });

        // Record failed attempt
        contentIdea.publishingHistory.push({
          platform,
          status: "failed",
          failureReason: error,
          attemptedAt: new Date(),
        });
      }
    }

    // Update content idea status based on results
    if (hasSuccesses && !hasFailures) {
      contentIdea.status = "published";
    } else if (hasSuccesses && hasFailures) {
      contentIdea.status = "partially_published";
    } else {
      contentIdea.status = "publishing_failed";
    }

    await contentIdea.save();

    // Emit appropriate event based on results
    if (hasSuccesses) {
      eventBus.emitBusinessEvent(
        EventTypes.CONTENT_PUBLISHED,
        business,
        {
          ideaId: contentIdea._id,
          platforms: publishingResults
            .filter((r) => r.success)
            .map((r) => r.platform),
          results: publishingResults,
        },
        { source: "content_publishing_job" }
      );
    }

    if (hasFailures) {
      eventBus.emitBusinessEvent(
        EventTypes.CONTENT_PUBLISHING_FAILED,
        business,
        {
          ideaId: contentIdea._id,
          platforms: publishingResults
            .filter((r) => !r.success)
            .map((r) => r.platform),
          failures: publishingResults.filter((r) => !r.success),
        },
        { source: "content_publishing_job" }
      );
    }

    return publishingResults;
  }

  /**
   * Publish to Instagram with validation and error handling
   */
  async publishToInstagram(businessId, contentIdea) {
    const { suggestedContent, variations } = contentIdea;

    // Validate required fields
    if (!variations?.instagram?.caption && !suggestedContent?.body) {
      throw new Error("Instagram: Missing caption content");
    }

    // Prepare content data
    const contentData = {
      caption: variations.instagram?.caption || suggestedContent.body,
      mediaType: suggestedContent.mediaType || "image",
    };

    // Add hashtags to caption
    if (variations.instagram?.hashtags?.length > 0) {
      contentData.caption += `\n\n${variations.instagram.hashtags.join(" ")}`;
    }

    // Add media URL if available
    if (suggestedContent?.mediaUrl) {
      contentData.imageUrl = suggestedContent.mediaUrl;
    }

    try {
      console.log(`[Content Publishing] Publishing to Instagram: ${contentIdea.title}`);

      // Call Instagram service to publish
      const result = await instagramService.publishContent(businessId, contentData);

      // Validate result
      if (!result || !result.postId) {
        throw new Error("Instagram service returned invalid response");
      }

      return {
        postId: result.postId,
        postUrl: result.postUrl || `https://instagram.com/p/${result.postId}`,
      };
    } catch (error) {
      console.error("Error publishing to Instagram:", error.message);
      throw new Error(`Instagram publishing failed: ${error.message}`);
    }
  }

  /**
   * Publish to TikTok with 11Labs audio generation and proper error handling
   */
  async publishToTikTok(businessId, contentIdea) {
    const { suggestedContent, variations } = contentIdea;
    const platformId = "platform";

    // Validate required fields
    if (!variations?.tiktok?.script && !suggestedContent?.body) {
      throw new Error("TikTok: Missing video script");
    }

    // Get platform integration settings
    const settings = await IntegrationSettings.findOne({ business: platformId });

    if (!settings?.tiktok?.enabled) {
      throw new Error("TikTok integration not configured");
    }

    // Get the video script
    const videoScript = variations.tiktok?.script || suggestedContent.body;

    // Generate audio using 11Labs if enabled
    let audioMetadata = null;

    if (settings.elevenLabs?.enabled) {
      try {
        const audioData = await elevenlabsService.generateAudio(platformId, videoScript);
        audioMetadata = {
          duration: audioData.duration,
          voice: settings.elevenLabs.voiceId || "default",
        };
        console.log(
          `[Content Publishing] Generated 11Labs audio for TikTok video, duration: ${audioData.duration}s`
        );
      } catch (audioError) {
        console.warn(
          `[Content Publishing] Failed to generate 11Labs audio, continuing without audio: ${audioError.message}`
        );
        // Don't throw - continue without audio
      }
    }

    // Prepare TikTok content
    const videoData = {
      title: contentIdea.title,
      script: videoScript,
      description: suggestedContent.body || "",
      hashtags: (variations.tiktok?.hashtags || []).join(" "),
      duration: variations.tiktok?.duration || 15,
      audioMetadata,
      mediaUrl: suggestedContent.mediaUrl || null,
    };

    try {
      console.log(
        `[Content Publishing] Publishing to TikTok: ${contentIdea.title}`
      );

      // Call TikTok service to publish
      const result = await tiktokService.publishContent(platformId, videoData);

      // Validate result
      if (!result || !result.postId) {
        throw new Error("TikTok service returned invalid response");
      }

      return {
        postId: result.postId,
        postUrl: result.postUrl || `https://tiktok.com/@platform/video/${result.postId}`,
        audioGenerated: !!audioMetadata,
      };
    } catch (error) {
      console.error("Error publishing to TikTok:", error.message);
      throw new Error(`TikTok publishing failed: ${error.message}`);
    }
  }

  /**
   * Track post performance
   */
  async trackPostPerformance(businessId, contentIdeaId, platform, postId) {
    try {
      const content = await ContentIdea.findOne({
        _id: contentIdeaId,
        business: businessId,
      });

      if (!content) {
        return;
      }

      let performance = null;

      if (platform === "instagram") {
        performance = await instagramService.getPostInsights(businessId, postId);
      } else if (platform === "tiktok") {
        // Implement TikTok analytics fetching
        // performance = await tiktokService.getVideoAnalytics(businessId, postId);
      }

      if (performance) {
        // Update publishing history with performance data
        const historyEntry = content.publishingHistory.find(
          (h) => h.platform === platform && h.postId === postId
        );

        if (historyEntry) {
          historyEntry.performance = {
            views: performance.views || 0,
            likes: performance.likes || 0,
            comments: performance.comments || 0,
            shares: performance.shares || 0,
            saves: performance.saves || 0,
          };

          await content.save();
        }
      }

      console.log(`[Content Publishing] Tracked performance for ${platform} post ${postId}`);
    } catch (error) {
      console.error("Error tracking post performance:", error.message);
    }
  }

  /**
   * Schedule content for publishing
   */
  async scheduleContent(businessId, contentIdeaId, platforms, scheduledDate) {
    try {
      const content = await ContentIdea.findOneAndUpdate(
        { _id: contentIdeaId, business: businessId },
        {
          status: "approved",
          "scheduledFor.platform": platforms,
          "scheduledFor.scheduledDate": scheduledDate,
        },
        { new: true }
      );

      if (!content) {
        throw new Error("Content idea not found");
      }

      console.log(
        `[Content Publishing] Scheduled content ${contentIdeaId} for ${platforms.join(", ")} on ${scheduledDate}`
      );

      return content;
    } catch (error) {
      console.error("Error scheduling content:", error.message);
      throw error;
    }
  }

  /**
   * Reschedule published content
   */
  async rescheduleContent(businessId, contentIdeaId, newScheduledDate) {
    try {
      const content = await ContentIdea.findOne({
        _id: contentIdeaId,
        business: businessId,
      });

      if (!content) {
        throw new Error("Content idea not found");
      }

      // If already published, create a new entry in publishing history
      if (content.status === "published") {
        content.publishingHistory.push({
          platform: content.scheduledFor.platform,
          scheduledFor: newScheduledDate,
          performance: {
            views: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            saves: 0,
          },
        });
      } else {
        // Otherwise, update the scheduled date
        content.scheduledFor.scheduledDate = newScheduledDate;
      }

      await content.save();

      console.log(`[Content Publishing] Rescheduled content ${contentIdeaId} to ${newScheduledDate}`);

      return content;
    } catch (error) {
      console.error("Error rescheduling content:", error.message);
      throw error;
    }
  }
}

module.exports = new ContentPublishingJob();
