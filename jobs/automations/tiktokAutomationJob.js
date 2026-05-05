const mongoose = require("mongoose");
const IntegrationSettings = require("../../models/integrationSettingsModel");
const SocialMediaEngagement = require("../../models/socialMediaEngagementModel");
const tiktokService = require("../../services/tiktok/tiktokService");
const insightService = require("../../services/insights/insightService");
const contentIdeaService = require("../../services/contentIdea/contentIdeaService");
const aiCommentService = require("../../services/comments/aiCommentService");
const { eventBus, EventTypes } = require("../../events/EventEmitter");

/**
 * TikTok Automation Job
 * Runs periodically to:
 * 1. Fetch recent TikTok posts by business owners
 * 2. Engage with relevant posts (likes and comments)
 * 3. Generate insights from engagement
 * 4. Generate content ideas based on insights
 */
class TikTokAutomationJob {
  /**
   * Process platform-level TikTok automation
   * Super admin account for marketing the SellSquare platform
   */
  async processPlatformTikTokAutomation() {
    try {
      const settings = await IntegrationSettings.findOne({
        business: process.env.SUPERADMIN_BUSINESS_ID,
        "tiktok.enabled": true,
        "tiktok.status": "connected",
        "tiktok.automationSettings.monitoringEnabled": true,
      }).select("+tiktok.accessToken +tiktok.apiSecret +tiktok.automationSettings");

      if (!settings?.tiktok.enabled) {
        console.log("[TikTok Platform Automation] TikTok not configured for platform");
        return;
      }

      console.log("[TikTok Platform Automation] Starting job for platform marketing account");

      const automationSettings = settings.tiktok.automationSettings;

      // Step 1: Fetch recent posts about business/e-commerce/marketing trends
      console.log("[TikTok Platform Automation] Fetching relevant posts");
      const posts = await tiktokService.fetchRecentPosts(process.env.SUPERADMIN_BUSINESS_ID, {
        limit: 30,
        keywords: automationSettings.engagementKeywords || [
          "business",
          "ecommerce",
          "smallbusiness",
          "entrepreneur",
          "marketing",
        ],
      });

      if (posts.length === 0) {
        console.log("[TikTok Platform Automation] No relevant posts found");
        return;
      }

      // Step 2: Engage with posts
      if (automationSettings.engagementEnabled) {
        await this.engageWithPosts(process.env.SUPERADMIN_BUSINESS_ID, posts, automationSettings);
      }

      // Step 3: Process posts for insights
      for (const post of posts) {
        await this.processPostForInsights(process.env.SUPERADMIN_BUSINESS_ID, post);
      }

      // Update last synced time
      await IntegrationSettings.updateOne(
        { business: process.env.SUPERADMIN_BUSINESS_ID },
        {
          "tiktok.lastSyncedAt": new Date(),
          "tiktok.status": "connected",
        }
      );

      console.log("[TikTok Platform Automation] Job completed successfully");
    } catch (error) {
      console.error("[TikTok Platform Automation] Job error:", error.message);
      await IntegrationSettings.updateOne(
        { business: process.env.SUPERADMIN_BUSINESS_ID },
        {
          "tiktok.status": "error",
          "tiktok.syncError": error.message,
        }
      );
    }
  }

  /**
   * Process all businesses with TikTok automation enabled
   */
  async processAllBusinesses() {
    try {
      const settings = await IntegrationSettings.find({
        "tiktok.enabled": true,
        "tiktok.status": "connected",
        "tiktok.automationSettings.monitoringEnabled": true,
      });

      console.log(`[TikTok Automation] Starting job for ${settings.length} businesses`);

      for (const setting of settings) {
        try {
          await this.processBusinessTikTokAutomation(setting.business);
        } catch (error) {
          console.error(`[TikTok Automation] Error processing business ${setting.business}:`, error.message);

          // Update status to error
          await IntegrationSettings.updateOne(
            { business: setting.business },
            {
              "tiktok.status": "error",
              "tiktok.syncError": error.message,
            }
          );
        }
      }

      console.log("[TikTok Automation] Job completed");
    } catch (error) {
      console.error("[TikTok Automation] Job error:", error.message);
    }
  }

  /**
   * Process TikTok automation for a single business
   */
  async processBusinessTikTokAutomation(businessId) {
    const settings = await IntegrationSettings.findOne({ business: businessId }).select(
      "+tiktok.accessToken +tiktok.apiSecret +tiktok.automationSettings"
    );

    if (!settings?.tiktok.enabled) {
      return;
    }

    const automationSettings = settings.tiktok.automationSettings;

    // Step 1: Fetch recent posts
    console.log(`[TikTok Automation] Fetching posts for business ${businessId}`);
    const posts = await tiktokService.fetchRecentPosts(businessId, {
      limit: 30,
      keywords: automationSettings.engagementKeywords || [],
    });

    if (posts.length === 0) {
      console.log(`[TikTok Automation] No recent posts found for business ${businessId}`);
      return;
    }

    // Step 2: Engage with posts (if enabled)
    if (automationSettings.engagementEnabled) {
      await this.engageWithPosts(businessId, posts, automationSettings);
    }

    // Step 3: Generate insights and content ideas
    for (const post of posts) {
      await this.processPostForInsights(businessId, post);
    }

    // Update last synced time
    await IntegrationSettings.updateOne(
      { business: businessId },
      {
        "tiktok.lastSyncedAt": new Date(),
        "tiktok.status": "connected",
      }
    );

    console.log(`[TikTok Automation] Completed processing for business ${businessId}`);
  }

  /**
   * Engage with TikTok posts
   */
  async engageWithPosts(businessId, posts, automationSettings) {
    const maxEngagementsPerSession = 10;
    let engagementCount = 0;

    for (const post of posts) {
      if (engagementCount >= maxEngagementsPerSession) {
        break;
      }

      try {
        // Check if we've already engaged with this post recently
        const existingEngagement = await SocialMediaEngagement.findOne({
          business: businessId,
          "originalPost.postId": post.postId,
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
        });

        if (existingEngagement) {
          continue;
        }

        const engagementActions = [];

        // Like the post
        try {
          await tiktokService.likeVideo(businessId, post.postId);
          engagementActions.push({
            type: "like",
            status: "success",
            actionedAt: new Date(),
          });
          console.log(`[TikTok Automation] Liked post ${post.postId}`);
        } catch (error) {
          console.error(`[TikTok Automation] Failed to like post ${post.postId}:`, error.message);
          engagementActions.push({
            type: "like",
            status: "failed",
            error: error.message,
            actionedAt: new Date(),
          });
        }

        // Comment on the post (if content is relevant)
        if (automationSettings.engagementKeywords?.length > 0) {
          try {
            const relevantComment = await this.generateRelevantComment(post);
            if (relevantComment) {
              await tiktokService.commentOnVideo(businessId, post.postId, relevantComment);
              engagementActions.push({
                type: "comment",
                comment: relevantComment,
                status: "success",
                actionedAt: new Date(),
              });
              console.log(`[TikTok Automation] Commented on post ${post.postId}`);
            }
          } catch (error) {
            console.error(`[TikTok Automation] Failed to comment on post ${post.postId}:`, error.message);
          }
        }

        // Record engagement
        const engagement = await SocialMediaEngagement.create({
          business: businessId,
          platform: "tiktok",
          originalPost: post,
          engagementActions,
          status: "insights_generated",
          processedAt: new Date(),
          processedBy: "automation",
          platformLevel: businessId === process.env.SUPERADMIN_BUSINESS_ID,
        });

        engagementCount++;

        // Emit event
        eventBus.emit(EventTypes.SOCIAL_ENGAGEMENT_CREATED, {
          business: businessId,
          engagementId: engagement._id,
          platform: "tiktok",
          platformLevel: businessId === process.env.SUPERADMIN_BUSINESS_ID,
        });
      } catch (error) {
        console.error(`[TikTok Automation] Error engaging with post ${post.postId}:`, error.message);
      }

      // Rate limiting - wait between engagements
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    console.log(`[TikTok Automation] Completed engagements: ${engagementCount}/${maxEngagementsPerSession}`);
  }

  /**
   * Generate relevant comment based on post content using AI
   */
  async generateRelevantComment(post) {
    try {
      return await aiCommentService.generateRelevantComment(post, "tiktok");
    } catch (error) {
      console.error("[TikTok Automation] Error generating AI comment:", error.message);
      // Fallback to basic comment if AI fails
      return aiCommentService.generateFallbackComment(post, "tiktok");
    }
  }

  /**
   * Process a post for insights generation
   */
  async processPostForInsights(businessId, post) {
    try {
      // Generate insights using AI
      const insights = await insightService.analyzePost(post, businessId);

      // Update or create engagement record
      let engagement = await SocialMediaEngagement.findOne({
        business: businessId,
        "originalPost.postId": post.postId,
      });

      if (!engagement) {
        engagement = await SocialMediaEngagement.create({
          business: businessId,
          platform: "tiktok",
          originalPost: post,
          insights,
          status: "insights_generated",
          processedAt: new Date(),
          processedBy: "automation",
          platformLevel: businessId === process.env.SUPERADMIN_BUSINESS_ID,
        });
      } else {
        engagement.insights = insights;
        engagement.status = "insights_generated";
        await engagement.save();
      }

      // Generate content idea if insights quality is high
      if (insights.relevanceScore >= 60 && insights.engagementLevel !== "low") {
        await contentIdeaService.generateIdea(businessId, engagement._id, post, businessId === process.env.SUPERADMIN_BUSINESS_ID);

        engagement.status = "content_idea_created";
        await engagement.save();

        eventBus.emit(EventTypes.CONTENT_IDEA_GENERATED, {
          business: businessId,
          engagementId: engagement._id,
          platform: "tiktok",
          platformLevel: businessId === process.env.SUPERADMIN_BUSINESS_ID,
        });
      }

      console.log(`[TikTok Automation] Generated insights for post ${post.postId}`);
    } catch (error) {
      console.error(`[TikTok Automation] Error processing insights for post ${post.postId}:`, error.message);
    }
  }
}

module.exports = new TikTokAutomationJob();
