const IntegrationSettings = require("../../models/integrationSettingsModel");
const SocialMediaEngagement = require("../../models/socialMediaEngagementModel");
const instagramService = require("../../services/instagram/instagramService");
const insightService = require("../../services/insights/insightService");
const contentIdeaService = require("../../services/contentIdea/contentIdeaService");
const aiCommentService = require("../../services/comments/aiCommentService");
const { eventBus, EventTypes } = require("../../events/EventEmitter");

/**
 * Instagram Automation Job
 * Runs periodically to:
 * 1. Fetch recent Instagram posts by business owners
 * 2. Engage with relevant posts (likes and comments)
 * 3. Generate insights from engagement
 * 4. Generate content ideas based on insights
 */
class InstagramAutomationJob {
  /**
   * Process platform-level Instagram automation
   * Super admin account for marketing the SellSquare platform
   */
  async processPlatformInstagramAutomation() {
    try {
      const settings = await IntegrationSettings.findOne({
        business: process.env.SUPERADMIN_BUSINESS_ID,
        "instagram.enabled": true,
        "instagram.status": "connected",
        "instagram.automationSettings.monitoringEnabled": true,
      }).select("+instagram.accessToken +instagram.automationSettings");

      if (!settings?.instagram.enabled) {
        console.log("[Instagram Platform Automation] Instagram not configured for platform");
        return;
      }

      console.log("[Instagram Platform Automation] Starting job for platform marketing account");

      const automationSettings = settings.instagram.automationSettings;

      // Step 1: Fetch recent posts about business/e-commerce/marketing trends
      console.log("[Instagram Platform Automation] Fetching relevant posts");
      const posts = await instagramService.fetchRecentPosts(process.env.SUPERADMIN_BUSINESS_ID, {
        limit: 25,
        keywords: automationSettings.engagementKeywords || [
          "business",
          "ecommerce",
          "smallbusiness",
          "entrepreneur",
          "marketing",
        ],
      });

      if (posts.length === 0) {
        console.log("[Instagram Platform Automation] No relevant posts found");
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

      // Get platform business insights
      try {
        const insights = await instagramService.getBusinessInsights(process.env.SUPERADMIN_BUSINESS_ID);
        console.log("[Instagram Platform Automation] Business insights:", insights);
      } catch (error) {
        console.error("[Instagram Platform Automation] Failed to get business insights:", error.message);
      }

      // Update last synced time
      await IntegrationSettings.updateOne(
        { business: process.env.SUPERADMIN_BUSINESS_ID },
        {
          "instagram.lastSyncedAt": new Date(),
          "instagram.status": "connected",
        }
      );

      console.log("[Instagram Platform Automation] Job completed successfully");
    } catch (error) {
      console.error("[Instagram Platform Automation] Job error:", error.message);
      await IntegrationSettings.updateOne(
        { business: process.env.SUPERADMIN_BUSINESS_ID },
        {
          "instagram.status": "error",
          "instagram.syncError": error.message,
        }
      );
    }
  }

  /**
   * Process all businesses with Instagram automation enabled
   */
  async processAllBusinesses() {
    try {
      const settings = await IntegrationSettings.find({
        "instagram.enabled": true,
        "instagram.status": "connected",
        "instagram.automationSettings.monitoringEnabled": true,
      });

      console.log(`[Instagram Automation] Starting job for ${settings.length} businesses`);

      for (const setting of settings) {
        try {
          await this.processBusinessInstagramAutomation(setting.business);
        } catch (error) {
          console.error(`[Instagram Automation] Error processing business ${setting.business}:`, error.message);

          // Update status to error
          await IntegrationSettings.updateOne(
            { business: setting.business },
            {
              "instagram.status": "error",
              "instagram.syncError": error.message,
            }
          );
        }
      }

      console.log("[Instagram Automation] Job completed");
    } catch (error) {
      console.error("[Instagram Automation] Job error:", error.message);
    }
  }

  /**
   * Process Instagram automation for a single business
   */
  async processBusinessInstagramAutomation(businessId) {
    const settings = await IntegrationSettings.findOne({ business: businessId }).select(
      "+instagram.accessToken +instagram.automationSettings"
    );

    if (!settings?.instagram.enabled) {
      return;
    }

    const automationSettings = settings.instagram.automationSettings;

    // Step 1: Fetch recent posts
    console.log(`[Instagram Automation] Fetching posts for business ${businessId}`);
    const posts = await instagramService.fetchRecentPosts(businessId, {
      limit: 25,
      keywords: automationSettings.engagementKeywords || [],
    });

    if (posts.length === 0) {
      console.log(`[Instagram Automation] No recent posts found for business ${businessId}`);
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

    // Get and log business insights
    try {
      const insights = await instagramService.getBusinessInsights(businessId);
      console.log(`[Instagram Automation] Business insights:`, insights);
    } catch (error) {
      console.error(`[Instagram Automation] Failed to get business insights:`, error.message);
    }

    // Update last synced time
    await IntegrationSettings.updateOne(
      { business: businessId },
      {
        "instagram.lastSyncedAt": new Date(),
        "instagram.status": "connected",
      }
    );

    console.log(`[Instagram Automation] Completed processing for business ${businessId}`);
  }

  /**
   * Engage with Instagram posts
   */
  async engageWithPosts(businessId, posts, automationSettings) {
    const maxEngagementsPerSession = 8;
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
          await instagramService.likePost(businessId, post.postId);
          engagementActions.push({
            type: "like",
            status: "success",
            actionedAt: new Date(),
          });
          console.log(`[Instagram Automation] Liked post ${post.postId}`);
        } catch (error) {
          console.error(`[Instagram Automation] Failed to like post ${post.postId}:`, error.message);
          engagementActions.push({
            type: "like",
            status: "failed",
            error: error.message,
            actionedAt: new Date(),
          });
        }

        // Comment on the post
        if (automationSettings.engagementKeywords?.length > 0) {
          try {
            const relevantComment = await this.generateRelevantComment(post);
            if (relevantComment) {
              await instagramService.commentOnPost(businessId, post.postId, relevantComment);
              engagementActions.push({
                type: "comment",
                comment: relevantComment,
                status: "success",
                actionedAt: new Date(),
              });
              console.log(`[Instagram Automation] Commented on post ${post.postId}`);
            }
          } catch (error) {
            console.error(`[Instagram Automation] Failed to comment on post ${post.postId}:`, error.message);
          }
        }

        // Record engagement
        const engagement = await SocialMediaEngagement.create({
          business: businessId,
          platform: "instagram",
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
          platform: "instagram",
          platformLevel: businessId === process.env.SUPERADMIN_BUSINESS_ID,
        });
      } catch (error) {
        console.error(`[Instagram Automation] Error engaging with post ${post.postId}:`, error.message);
      }

      // Rate limiting - wait between engagements
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log(`[Instagram Automation] Completed engagements: ${engagementCount}/${maxEngagementsPerSession}`);
  }

  /**
   * Generate relevant comment based on post content using AI
   */
  async generateRelevantComment(post) {
    try {
      return await aiCommentService.generateRelevantComment(post, "instagram");
    } catch (error) {
      console.error("[Instagram Automation] Error generating AI comment:", error.message);
      // Fallback to basic comment if AI fails
      return aiCommentService.generateFallbackComment(post, "instagram");
    }
  }

  /**
   * Process a post for insights generation
   */
  async processPostForInsights(businessId, post) {
    try {
      // Generate insights using AI
      const insights = await insightService.analyzePost(post, businessId);

      // Get post-specific insights
      const postInsights = await instagramService.getPostInsights(businessId, post.postId);

      // Combine insights
      const combinedInsights = {
        ...insights,
        platformMetrics: postInsights,
      };

      // Update or create engagement record
      let engagement = await SocialMediaEngagement.findOne({
        business: businessId,
        "originalPost.postId": post.postId,
      });

      if (!engagement) {
        engagement = await SocialMediaEngagement.create({
          business: businessId,
          platform: "instagram",
          originalPost: post,
          insights: combinedInsights,
          status: "insights_generated",
          processedAt: new Date(),
          processedBy: "automation",
          platformLevel: businessId === process.env.SUPERADMIN_BUSINESS_ID,
        });
      } else {
        engagement.insights = combinedInsights;
        engagement.status = "insights_generated";
        await engagement.save();
      }

      // Generate content idea if insights quality is high
      if (combinedInsights.relevanceScore >= 60 && combinedInsights.engagementLevel !== "low") {
        await contentIdeaService.generateIdea(businessId, engagement._id, post, businessId === process.env.SUPERADMIN_BUSINESS_ID);

        engagement.status = "content_idea_created";
        await engagement.save();

        eventBus.emit(EventTypes.CONTENT_IDEA_GENERATED, {
          business: businessId,
          engagementId: engagement._id,
          platform: "instagram",
          platformLevel: businessId === process.env.SUPERADMIN_BUSINESS_ID,
        });
      }

      console.log(`[Instagram Automation] Generated insights for post ${post.postId}`);
    } catch (error) {
      console.error(`[Instagram Automation] Error processing insights for post ${post.postId}:`, error.message);
    }
  }
}

module.exports = new InstagramAutomationJob();
