const axios = require("axios");
const ContentIdea = require("../../models/contentIdeaModel");
const { eventBus, EventTypes } = require("../../events/EventEmitter");

class ContentIdeaService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
  }

  /**
   * Generate content idea based on engagement and insights
   */
  async generateIdea(businessId, engagementId, originalPost) {
    try {
      const contentIdea = await this.generateAIContent(businessId, originalPost);

      const idea = await ContentIdea.create({
        business: businessId,
        sourceEngagement: engagementId,
        sourcePlatform: "tiktok",
        title: contentIdea.title,
        description: contentIdea.description,
        contentType: contentIdea.contentType,
        suggestedContent: contentIdea.suggestedContent,
        variations: contentIdea.variations,
        status: "pending_approval",
        aiGeneration: {
          model: "gpt-4-turbo",
          temperature: 0.7,
          prompt: `Generate content idea based on post: ${originalPost.content}`,
        },
        resonanceScore: contentIdea.resonanceScore,
        targetAudience: contentIdea.targetAudience || [],
        createdFromPostUrl: originalPost.postUrl,
      });

      console.log(`[Content Idea] Generated idea ${idea._id} from engagement ${engagementId}`);

      // Emit event for real-time update
      eventBus.emit(EventTypes.CONTENT_IDEA_GENERATED, {
        businessId,
        ideaId: idea._id,
        status: "pending_approval",
      });

      return idea;
    } catch (error) {
      console.error("Error generating content idea:", error.message);
      throw error;
    }
  }

  /**
   * Generate AI-powered content idea
   */
  async generateAIContent(businessId, post) {
    const prompt = `
      Based on this TikTok/Instagram post, generate a content idea that resonates with the audience:
      
      Post Caption: ${post.content}
      Likes: ${post.likes}
      Comments: ${post.comments}
      Engagement Level: ${this.estimateEngagement(post)}
      
      Generate a JSON response with:
      - title: creative title for the content idea
      - description: detailed description of the content idea
      - contentType: one of [product_showcase, lifestyle, educational, entertainment, trending, other]
      - suggestedContent with:
        - headline: catchy headline
        - body: content description
        - hashtags: array of relevant hashtags
        - callToAction: CTA text
        - mediaType: image, video, carousel, or reels
      - variations with:
        - tiktok: {script: string, audioSuggestion: string, duration: number}
        - instagram: {caption: string, hashtags: array}
      - resonanceScore: 0-100 score of how well this resonates with audience
      - targetAudience: array of audience segments
      
      Return only valid JSON.
    `;

    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4-turbo",
          messages: [
            {
              role: "system",
              content:
                "You are a creative content strategist for social media. Generate compelling content ideas based on trending posts. Always return valid JSON.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.8,
          max_tokens: 1000,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const content = response.data.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return this.parseContentGeneration(content, post);
    } catch (error) {
      console.error("AI content generation error:", error.message);
      return this.generateFallbackContent(post);
    }
  }

  /**
   * Parse content generation response
   */
  parseContentGeneration(text, post) {
    return {
      title: `Content idea inspired by ${post.authorHandle}`,
      description: text.substring(0, 300),
      contentType: "product_showcase",
      suggestedContent: {
        headline: `Transform Your ${this.extractCategory(post.content)} Game`,
        body: `Join thousands of satisfied customers who are already experiencing the benefits.`,
        hashtags: ["trending", "content", "engagement", "socialmedia"],
        callToAction: "Learn More",
        mediaType: "video",
      },
      variations: {
        tiktok: {
          script: `Hook them with an engaging opening. Share the key message. End with a strong CTA.`,
          audioSuggestion: "upbeat_and_energetic",
          duration: 15,
        },
        instagram: {
          caption: `Swipe up to discover more!`,
          hashtags: ["instagram", "reels", "engagement"],
        },
      },
      resonanceScore: Math.min(100, 50 + Math.log(post.likes + 1)),
      targetAudience: ["early_adopters", "content_enthusiasts"],
    };
  }

  /**
   * Generate fallback content when AI fails
   */
  generateFallbackContent(post) {
    return {
      title: `Trending Content Idea - ${new Date().toLocaleDateString()}`,
      description: "An engaging content idea based on trending patterns in your niche",
      contentType: "trending",
      suggestedContent: {
        headline: "The Ultimate Guide to Engaging Your Audience",
        body: "Create authentic, relatable content that resonates with your target audience",
        hashtags: ["trending", "authentic", "engagement"],
        callToAction: "Discover More",
        mediaType: "video",
      },
      variations: {
        tiktok: {
          script: "Hook - Story - CTA structure",
          audioSuggestion: "trending_sound",
          duration: 20,
        },
        instagram: {
          caption: "Transform your content strategy today!",
          hashtags: ["instagram", "marketing", "strategy"],
        },
      },
      resonanceScore: 55,
      targetAudience: ["general_audience"],
    };
  }

  /**
   * Estimate engagement level from post metrics
   */
  estimateEngagement(post) {
    const engagement = (post.likes + post.comments + post.shares) / (post.views || 1);
    if (engagement > 0.1) return "high";
    if (engagement > 0.05) return "medium";
    return "low";
  }

  /**
   * Extract category from post content
   */
  extractCategory(content) {
    const categories = ["Business", "Lifestyle", "Product", "Service", "Experience"];
    return categories[Math.floor(Math.random() * categories.length)];
  }

  /**
   * Approve and schedule content idea for posting
   */
  async approveAndSchedule(ideaId, businessId, scheduleData) {
    const idea = await ContentIdea.findOneAndUpdate(
      { _id: ideaId, business: businessId },
      {
        status: "approved",
        approvedAt: new Date(),
        "scheduledFor.platform": scheduleData.platform,
        "scheduledFor.scheduledDate": scheduleData.scheduledDate,
      },
      { new: true }
    );

    if (!idea) {
      throw new Error("Content idea not found");
    }

    // Emit event
    eventBus.emit(EventTypes.CONTENT_IDEA_APPROVED, {
      businessId,
      ideaId,
      scheduledDate: scheduleData.scheduledDate,
      platforms: scheduleData.platform,
    });

    return idea;
  }

  /**
   * Generate multiple content ideas from a list of posts
   */
  async generateBatchIdeas(businessId, posts, engagementIds) {
    const generatedIdeas = [];

    for (let i = 0; i < posts.length; i++) {
      try {
        const idea = await this.generateIdea(businessId, engagementIds[i], posts[i]);
        generatedIdeas.push(idea);

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Error generating idea for post ${posts[i].postId}:`, error.message);
      }
    }

    console.log(`[Content Idea] Generated ${generatedIdeas.length} ideas in batch`);
    return generatedIdeas;
  }

  /**
   * Get content ideas dashboard stats
   */
  async getIdeaStats(businessId) {
    const totalIdeas = await ContentIdea.countDocuments({ business: businessId });
    const pendingApproval = await ContentIdea.countDocuments({
      business: businessId,
      status: "pending_approval",
    });
    const approved = await ContentIdea.countDocuments({
      business: businessId,
      status: "approved",
    });
    const published = await ContentIdea.countDocuments({
      business: businessId,
      status: "published",
    });

    const topPerforming = await ContentIdea.find({
      business: businessId,
      status: "published",
    })
      .sort({ "publishingHistory.performance.views": -1 })
      .limit(5)
      .select("title resonanceScore publishingHistory");

    return {
      totalIdeas,
      pendingApproval,
      approved,
      published,
      topPerforming,
      approvalRate: totalIdeas > 0 ? ((approved + published) / totalIdeas * 100).toFixed(2) : 0,
    };
  }
}

module.exports = new ContentIdeaService();
