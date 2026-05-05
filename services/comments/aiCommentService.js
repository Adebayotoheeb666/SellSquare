const axios = require("axios");

class AICommentService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
  }

  /**
   * Generate authentic, relevant comments for social media posts
   * @param {Object} post - The post to comment on
   * @param {String} platform - 'tiktok' or 'instagram'
   * @param {String} businessId - Business ID for context
   * @returns {Promise<String>} Generated comment text
   */
  async generateRelevantComment(post, platform = "tiktok", businessId = null) {
    try {
      const prompt = this.buildCommentPrompt(post, platform, businessId);

      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: this.getSystemPrompt(platform),
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 100,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const content = response.data.choices[0].message.content.trim();

      // Validate comment quality
      if (this.isValidComment(content, platform)) {
        console.log(`[AI Comments] Generated relevant comment for ${platform}`);
        return content;
      }

      // Fallback to generic if validation fails
      return this.generateFallbackComment(post, platform);
    } catch (error) {
      console.error("[AI Comments] Error generating AI comment:", error.message);
      return this.generateFallbackComment(post, platform);
    }
  }

  /**
   * Build prompt for comment generation
   */
  buildCommentPrompt(post, platform, businessId) {
    const postContext = `
      Platform: ${platform}
      Content/Caption: ${post.content || post.caption || ""}
      Likes: ${post.likes || 0}
      Comments: ${post.comments || 0}
      Author: ${post.authorHandle || post.author || "Unknown"}
      Content Type: ${this.detectContentType(post.content)}
    `;

    return `Generate ONE authentic, relevant comment for this ${platform} post. 
    The comment should be:
    - Genuine and non-promotional
    - Relevant to the post content
    - Conversational and natural
    - Appropriate for ${platform} (${this.getPlatformGuidelines(platform)})
    - Under 200 characters
    
    Post details:
    ${postContext}
    
    Return ONLY the comment text, no quotes or explanations.`;
  }

  /**
   * Get system prompt for different platforms
   */
  getSystemPrompt(platform) {
    const prompts = {
      tiktok:
        "You are a helpful, engaging TikTok user who leaves authentic comments on trending videos. Your comments are short, casual, and use relevant emojis. You engage with content genuinely without being promotional or spammy.",
      instagram:
        "You are an active Instagram user who leaves thoughtful, genuine comments on posts. Your style is conversational, sometimes includes emojis, and shows real interest in the content. You avoid hashtags in comments.",
    };

    return prompts[platform] || prompts.tiktok;
  }

  /**
   * Get platform-specific guidelines
   */
  getPlatformGuidelines(platform) {
    const guidelines = {
      tiktok: "Short, punchy, can include emojis, casual tone",
      instagram: "Conversational, thoughtful, genuine interest shown",
    };

    return guidelines[platform] || guidelines.tiktok;
  }

  /**
   * Detect content type from post content
   */
  detectContentType(content) {
    if (!content) return "general";

    const lowerContent = content.toLowerCase();

    if (
      lowerContent.includes("tutorial") ||
      lowerContent.includes("how to") ||
      lowerContent.includes("guide")
    ) {
      return "educational";
    }

    if (
      lowerContent.includes("funny") ||
      lowerContent.includes("laugh") ||
      lowerContent.includes("comedy")
    ) {
      return "entertainment";
    }

    if (
      lowerContent.includes("product") ||
      lowerContent.includes("shop") ||
      lowerContent.includes("buy")
    ) {
      return "product_showcase";
    }

    if (lowerContent.includes("motivation") || lowerContent.includes("inspire")) {
      return "motivational";
    }

    return "general";
  }

  /**
   * Validate comment quality
   */
  isValidComment(comment, platform) {
    // Check length
    if (comment.length < 5 || comment.length > 300) {
      return false;
    }

    // Check for spam keywords
    const spamKeywords = ["click here", "buy now", "limited offer", "discount code"];
    if (spamKeywords.some((keyword) => comment.toLowerCase().includes(keyword))) {
      return false;
    }

    // Check for minimum quality signals
    if (comment === comment.toUpperCase() && comment.length > 10) {
      return false; // Avoid all caps
    }

    return true;
  }

  /**
   * Generate fallback comment if AI fails
   */
  generateFallbackComment(post, platform) {
    const contentType = this.detectContentType(post.content);

    const commentTemplates = {
      educational: [
        "This is so helpful! Definitely applying this. 🙌",
        "Great explanation! Thanks for sharing this valuable info!",
        "This makes so much sense. Appreciate the breakdown!",
        "Wow, never thought about it this way. Love it! ✨",
      ],
      entertainment: [
        "This made my day! 😂",
        "Haha absolutely killed it! 💀",
        "This is pure gold! Keep it coming!",
        "Not me screaming at this! 💯",
      ],
      product_showcase: [
        "This looks amazing! 🔥",
        "Quality content! Really interested in this!",
        "Love how you showcase this! Great work!",
        "This is exactly what I've been looking for!",
      ],
      motivational: [
        "Needed this today! Thanks for the motivation! 💪",
        "This resonates so much! Absolutely true!",
        "Thank you for reminding us of this! 💯",
        "So true! Love the positivity here!",
      ],
      general: [
        "This is amazing! Love it! 🙌",
        "Great content! Thanks for sharing!",
        "This resonates with me! Well done!",
        "Absolutely brilliant! Keep these coming!",
      ],
    };

    const templates = commentTemplates[contentType] || commentTemplates.general;
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Generate batch comments for multiple posts
   */
  async generateBatchComments(posts, platform = "tiktok", businessId = null) {
    const comments = [];

    for (const post of posts) {
      try {
        const comment = await this.generateRelevantComment(post, platform, businessId);
        comments.push({
          postId: post.postId,
          comment,
          generatedAt: new Date(),
        });

        // Rate limiting to avoid API throttling
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(
          `[AI Comments] Error generating comment for post ${post.postId}:`,
          error.message
        );
        comments.push({
          postId: post.postId,
          comment: this.generateFallbackComment(post, platform),
          generatedAt: new Date(),
          isFallback: true,
        });
      }
    }

    console.log(
      `[AI Comments] Generated ${comments.length} comments (${comments.filter((c) => !c.isFallback).length} AI-powered, ${comments.filter((c) => c.isFallback).length} fallback)`
    );

    return comments;
  }

  /**
   * Test AI comment generation
   */
  async testCommentGeneration(samplePost) {
    try {
      const tiktokComment = await this.generateRelevantComment(samplePost, "tiktok");
      const instagramComment = await this.generateRelevantComment(samplePost, "instagram");

      return {
        success: true,
        samplePost,
        tiktokComment,
        instagramComment,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = new AICommentService();
