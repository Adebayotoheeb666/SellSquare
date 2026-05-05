const axios = require("axios");

class InsightService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || process.env.CLAUDE_API_KEY;
  }

  /**
   * Analyze a social media post and generate insights
   */
  async analyzePost(post, businessId) {
    const postContent = `
      Title/Caption: ${post.content || ""}
      Likes: ${post.likes}
      Comments: ${post.comments}
      Shares: ${post.shares}
      Views: ${post.views}
      Posted by: ${post.authorHandle}
    `;

    try {
      // Call OpenAI or Claude to analyze the post
      const analysis = await this.callAIModel(postContent, businessId);

      return {
        keyThemes: analysis.keyThemes || [],
        sentiment: analysis.sentiment || "neutral",
        audienceInterest: analysis.audienceInterest || [],
        engagementLevel: this.calculateEngagementLevel(post),
        relevanceScore: analysis.relevanceScore || 50,
        summary: analysis.summary || `Post by ${post.authorHandle} with ${post.likes} likes and ${post.comments} comments`,
      };
    } catch (error) {
      console.error("Error analyzing post:", error.message);

      // Fallback to basic analysis
      return {
        keyThemes: ["user_generated_content"],
        sentiment: "neutral",
        audienceInterest: [],
        engagementLevel: this.calculateEngagementLevel(post),
        relevanceScore: 40,
        summary: `Post by ${post.authorHandle}`,
      };
    }
  }

  /**
   * Calculate engagement level based on metrics
   */
  calculateEngagementLevel(post) {
    const engagementRate = (post.likes + post.comments + post.shares) / (post.views || 1);

    if (engagementRate > 0.1) return "high";
    if (engagementRate > 0.05) return "medium";
    return "low";
  }

  /**
   * Call OpenAI or Claude API for analysis
   */
  async callAIModel(postContent, businessId) {
    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4-turbo",
          messages: [
            {
              role: "system",
              content:
                "You are an expert social media analyst. Analyze the provided post and extract key themes, sentiment, and audience interests in JSON format.",
            },
            {
              role: "user",
              content: `Analyze this social media post and return JSON with: keyThemes (array of strings), sentiment (positive/neutral/negative), audienceInterest (array of interests), relevanceScore (0-100), summary (brief description). Post: ${postContent}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
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

      return this.parseAnalysisText(content);
    } catch (error) {
      console.error("AI Model API error:", error.message);
      throw error;
    }
  }

  /**
   * Parse analysis response from AI
   */
  parseAnalysisText(text) {
    // Fallback parsing if JSON extraction fails
    return {
      keyThemes: ["trending", "engagement"],
      sentiment: text.includes("positive") ? "positive" : "neutral",
      audienceInterest: ["content_marketing", "social_media"],
      relevanceScore: 60,
      summary: text.substring(0, 200),
    };
  }

  /**
   * Generate trending insights across multiple posts
   */
  async generateTrendingInsights(posts) {
    const insights = [];

    for (const post of posts) {
      const analysis = await this.analyzePost(post);
      insights.push({
        postId: post.postId,
        themes: analysis.keyThemes,
        sentiment: analysis.sentiment,
        score: analysis.relevanceScore,
      });
    }

    // Find trending themes
    const themeFrequency = {};
    insights.forEach((insight) => {
      insight.themes.forEach((theme) => {
        themeFrequency[theme] = (themeFrequency[theme] || 0) + 1;
      });
    });

    const trendingThemes = Object.entries(themeFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([theme]) => theme);

    return {
      totalPostsAnalyzed: posts.length,
      trendingThemes,
      averageSentiment: this.calculateAverageSentiment(insights),
      topPerformingTopics: trendingThemes,
      recommendations: this.generateRecommendations(trendingThemes),
    };
  }

  /**
   * Calculate average sentiment
   */
  calculateAverageSentiment(insights) {
    const sentimentValues = {
      positive: 1,
      neutral: 0.5,
      negative: 0,
    };

    const total = insights.reduce((sum, insight) => sum + (sentimentValues[insight.sentiment] || 0.5), 0);
    const average = total / insights.length;

    if (average > 0.7) return "positive";
    if (average > 0.3) return "neutral";
    return "negative";
  }

  /**
   * Generate recommendations based on trending themes
   */
  generateRecommendations(trendingThemes) {
    const recommendations = [];

    if (trendingThemes.includes("trending")) {
      recommendations.push("Consider creating content around current trends for better engagement");
    }

    if (trendingThemes.includes("engagement")) {
      recommendations.push("Focus on interactive content to boost audience engagement");
    }

    if (trendingThemes.includes("user_generated_content")) {
      recommendations.push("Encourage user-generated content for authentic audience connection");
    }

    if (recommendations.length === 0) {
      recommendations.push("Monitor performance metrics closely and adapt content strategy based on analytics");
    }

    return recommendations;
  }
}

module.exports = new InsightService();
