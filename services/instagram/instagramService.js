const axios = require("axios");
const IntegrationSettings = require("../../models/integrationSettingsModel");

class InstagramService {
  constructor() {
    this.baseUrl = "https://graph.instagram.com";
    this.graphApiVersion = "v18.0";
  }

  /**
   * Get Instagram API client with credentials
   */
  async getInstagramClient(businessId) {
    const settings = await IntegrationSettings.findOne({ business: businessId }).select(
      "+instagram.accessToken +instagram.igUserId +instagram.enabled"
    );

    // Provide fallback parameters for SUPERADMIN platform testing.
    let accessToken = settings?.instagram?.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN;
    let igUserId = settings?.instagram?.igUserId || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    let fallbackBusinessAccountId = settings?.instagram?.businessAccountId || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

    // Check if it's the superadmin business checking by comparing against the .env business ID or settings.
    const isPlatformLevel = businessId === process.env.SUPERADMIN_BUSINESS_ID;

    if (!isPlatformLevel) {
      if (!settings || !settings.instagram.enabled) {
        throw new Error("Instagram integration not configured for this business");
      }
      if (!settings.instagram.accessToken) {
        throw new Error("Instagram access token not found");
      }
    } else {
      if (!accessToken || accessToken.includes("your_")) {
        throw new Error("Instagram access token not found or invalid in .env for platform.");
      }
    }

    return {
      accessToken: accessToken,
      igUserId: igUserId,
      businessAccountId: fallbackBusinessAccountId,
    };
  }

  /**
   * Fetch recent Instagram posts by business owners
   */
  async fetchRecentPosts(businessId, options = {}) {
    const { limit = 30, keywords = [] } = options;

    const client = await this.getInstagramClient(businessId);

    try {
      const endpoint = `${this.baseUrl}/${this.graphApiVersion}/${client.igUserId}/media`;

      const response = await axios.get(endpoint, {
        params: {
          fields: "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count",
          limit,
          access_token: client.accessToken,
        },
      });

      if (!response.data.data) {
        return [];
      }

      let posts = response.data.data;

      // Filter by keywords if provided
      if (keywords.length > 0) {
        posts = posts.filter((post) => {
          const content = (post.caption || "").toLowerCase();
          return keywords.some((keyword) => content.includes(keyword.toLowerCase()));
        });
      }

      // Fetch detailed metrics for each post
      const postsWithMetrics = await Promise.all(
        posts.map((post) => this.enrichPostMetrics(post, client.accessToken))
      );

      return postsWithMetrics;
    } catch (error) {
      if (error.response?.status === 401) {
        // Token may have expired
        throw new Error("Instagram access token invalid or expired");
      }
      console.error("Failed to fetch Instagram posts:", error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Enrich post with detailed metrics
   */
  async enrichPostMetrics(post, accessToken) {
    try {
      const endpoint = `${this.baseUrl}/${this.graphApiVersion}/${post.id}`;

      const response = await axios.get(endpoint, {
        params: {
          fields: "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count,ig_id",
          access_token: accessToken,
        },
      });

      return {
        postId: post.id,
        authorId: post.ig_id,
        authorHandle: "", // Would need user info to get this
        postUrl: post.permalink,
        content: post.caption || "",
        mediaUrls: [post.media_url].filter(Boolean),
        likes: post.like_count || 0,
        comments: post.comments_count || 0,
        shares: 0, // Instagram doesn't expose shares via API
        views: 0, // Would need to get from insights
        postedAt: new Date(post.timestamp),
        mediaType: post.media_type,
      };
    } catch (error) {
      console.error("Error enriching post metrics:", error.message);
      return {
        postId: post.id,
        authorId: "",
        authorHandle: "",
        postUrl: post.permalink,
        content: post.caption || "",
        mediaUrls: [post.media_url].filter(Boolean),
        likes: post.like_count || 0,
        comments: post.comments_count || 0,
        shares: 0,
        views: 0,
        postedAt: new Date(post.timestamp),
      };
    }
  }

  /**
   * Like an Instagram post
   */
  async likePost(businessId, postId) {
    const client = await this.getInstagramClient(businessId);

    try {
      const endpoint = `${this.baseUrl}/${this.graphApiVersion}/${postId}/likes`;

      const response = await axios.post(
        endpoint,
        {},
        {
          params: {
            access_token: client.accessToken,
          },
        }
      );

      return {
        success: response.data.success || true,
        message: "Post liked successfully",
      };
    } catch (error) {
      console.error("Failed to like Instagram post:", error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Comment on an Instagram post
   */
  async commentOnPost(businessId, postId, commentText) {
    const client = await this.getInstagramClient(businessId);

    try {
      const endpoint = `${this.baseUrl}/${this.graphApiVersion}/${postId}/comments`;

      const response = await axios.post(
        endpoint,
        {
          text: commentText,
        },
        {
          params: {
            access_token: client.accessToken,
          },
        }
      );

      return {
        success: response.data.id ? true : false,
        commentId: response.data.id,
        message: "Comment posted successfully",
      };
    } catch (error) {
      console.error("Failed to comment on Instagram post:", error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get post insights (requires Instagram Business Account)
   */
  async getPostInsights(businessId, postId) {
    const client = await this.getInstagramClient(businessId);

    try {
      const endpoint = `${this.baseUrl}/${this.graphApiVersion}/${postId}/insights`;

      const response = await axios.get(endpoint, {
        params: {
          metric: "engagement,impressions,reach,saved",
          access_token: client.accessToken,
        },
      });

      const insights = {};
      if (response.data.data) {
        response.data.data.forEach((metric) => {
          insights[metric.name] = metric.values[0]?.value || 0;
        });
      }

      return insights;
    } catch (error) {
      console.error("Failed to get Instagram post insights:", error.response?.data || error.message);
      return {};
    }
  }

  /**
   * Get business account insights
   */
  async getBusinessInsights(businessId) {
    const client = await this.getInstagramClient(businessId);

    try {
      const endpoint = `${this.baseUrl}/${this.graphApiVersion}/${client.igUserId}/insights`;

      const response = await axios.get(endpoint, {
        params: {
          metric: "impressions,reach,profile_views,follower_count,website_clicks",
          period: "month",
          access_token: client.accessToken,
        },
      });

      const insights = {};
      if (response.data.data) {
        response.data.data.forEach((metric) => {
          insights[metric.name] = metric.values[0]?.value || 0;
        });
      }

      return insights;
    } catch (error) {
      console.error("Failed to get Instagram business insights:", error.response?.data || error.message);
      return {};
    }
  }

  /**
   * Create/Publish content to Instagram
   */
  async publishContent(businessId, contentData) {
    const client = await this.getInstagramClient(businessId);

    try {
      const endpoint = `${this.baseUrl}/${this.graphApiVersion}/${client.igUserId}/media`;

      const payload = {
        image_url: contentData.imageUrl,
        caption: contentData.caption,
        access_token: client.accessToken,
      };

      // Handle different media types
      if (contentData.mediaType === "video") {
        payload.video_url = contentData.videoUrl;
        payload.thumb_offset = contentData.thumbOffset || 0;
      } else if (contentData.mediaType === "carousel") {
        payload.media_type = "CAROUSEL";
        payload.children = contentData.children;
      }

      const createResponse = await axios.post(endpoint, payload);

      if (!createResponse.data.id) {
        throw new Error("Failed to create media container");
      }

      // Publish the container
      const publishEndpoint = `${this.baseUrl}/${this.graphApiVersion}/${client.igUserId}/media_publish`;

      const publishResponse = await axios.post(publishEndpoint, {
        creation_id: createResponse.data.id,
        access_token: client.accessToken,
      });

      return {
        success: true,
        postId: publishResponse.data.id,
        message: "Content published successfully",
      };
    } catch (error) {
      console.error("Failed to publish Instagram content:", error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Test connection
   */
  async testConnection(businessId) {
    try {
      const client = await this.getInstagramClient(businessId);

      const endpoint = `${this.baseUrl}/${this.graphApiVersion}/${client.igUserId}`;

      const response = await axios.get(endpoint, {
        params: {
          fields: "id,username,name,biography,website,followers_count,follows_count,media_count",
          access_token: client.accessToken,
        },
      });

      return {
        connected: true,
        accountInfo: {
          id: response.data.id,
          username: response.data.username,
          name: response.data.name,
          followers: response.data.followers_count,
        },
      };
    } catch (error) {
      console.error("Test Connection Error Data:", error.response?.data);
      return {
        connected: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }
}

module.exports = new InstagramService();
