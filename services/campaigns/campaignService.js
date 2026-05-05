const FollowupCampaign = require("../../models/followupCampaignModel");
const RegistrationFollowup = require("../../models/registrationFollowupModel");
const FollowupTemplate = require("../../models/followupTemplateModel");
const { eventBus, EventTypes } = require("../../events/EventEmitter");

class CampaignService {
  /**
   * Create a new follow-up campaign
   */
  async createCampaign(businessId, campaignData, userId) {
    try {
      const campaign = await FollowupCampaign.create({
        business: businessId,
        name: campaignData.name,
        description: campaignData.description,
        type: campaignData.type || "custom",
        targetAudience: campaignData.targetAudience || "all_new_registrations",
        targetingCriteria: campaignData.targetingCriteria || {},
        channels: campaignData.channels || ["email"],
        messageSequence: campaignData.messageSequence || [],
        status: "draft",
        createdBy: userId,
        tags: campaignData.tags || [],
        autoAddNewRegistrations: campaignData.autoAddNewRegistrations !== false,
        retryFailedMessages: campaignData.retryFailedMessages !== false,
        respectUserPreferences: campaignData.respectUserPreferences !== false,
      });

      console.log(`[Campaign] Created campaign ${campaign._id}`);

      return campaign;
    } catch (error) {
      console.error("Error creating campaign:", error.message);
      throw error;
    }
  }

  /**
   * Activate campaign
   */
  async activateCampaign(businessId, campaignId) {
    try {
      const campaign = await FollowupCampaign.findOneAndUpdate(
        { _id: campaignId, business: businessId },
        {
          status: "active",
          activatedAt: new Date(),
          startDate: new Date(),
        },
        { new: true }
      );

      if (!campaign) {
        throw new Error("Campaign not found");
      }

      // If auto-add is enabled, add matching registrations
      if (campaign.autoAddNewRegistrations) {
        await this.addMatchingRegistrations(businessId, campaignId, campaign.targetingCriteria);
      }

      // Emit event
      eventBus.emit(EventTypes.CAMPAIGN_ACTIVATED, {
        businessId,
        campaignId,
        status: "active",
      });

      console.log(`[Campaign] Activated campaign ${campaignId}`);

      return campaign;
    } catch (error) {
      console.error("Error activating campaign:", error.message);
      throw error;
    }
  }

  /**
   * Pause campaign
   */
  async pauseCampaign(businessId, campaignId) {
    try {
      const campaign = await FollowupCampaign.findOneAndUpdate(
        { _id: campaignId, business: businessId },
        {
          status: "paused",
          pausedAt: new Date(),
        },
        { new: true }
      );

      if (!campaign) {
        throw new Error("Campaign not found");
      }

      eventBus.emit(EventTypes.CAMPAIGN_PAUSED, {
        businessId,
        campaignId,
      });

      return campaign;
    } catch (error) {
      console.error("Error pausing campaign:", error.message);
      throw error;
    }
  }

  /**
   * Archive campaign
   */
  async archiveCampaign(businessId, campaignId) {
    try {
      const campaign = await FollowupCampaign.findOneAndUpdate(
        { _id: campaignId, business: businessId },
        {
          status: "archived",
        },
        { new: true }
      );

      if (!campaign) {
        throw new Error("Campaign not found");
      }

      return campaign;
    } catch (error) {
      console.error("Error archiving campaign:", error.message);
      throw error;
    }
  }

  /**
   * Add recipients to campaign
   */
  async addRecipients(businessId, campaignId, followupIds) {
    try {
      const campaign = await FollowupCampaign.findOne({
        _id: campaignId,
        business: businessId,
      });

      if (!campaign) {
        throw new Error("Campaign not found");
      }

      // Add new recipients
      const newRecipients = followupIds.map((followupId) => ({
        followupId,
        status: "pending",
        addedAt: new Date(),
      }));

      campaign.recipients.push(...newRecipients);
      campaign.metrics.totalRecipientsAdded += followupIds.length;
      await campaign.save();

      // Link campaign to registration followups
      await RegistrationFollowup.updateMany(
        { _id: { $in: followupIds } },
        {
          $push: {
            assignedCampaigns: {
              campaignId,
              campaignName: campaign.name,
              addedAt: new Date(),
            },
          },
        }
      );

      console.log(
        `[Campaign] Added ${followupIds.length} recipients to campaign ${campaignId}`
      );

      return campaign;
    } catch (error) {
      console.error("Error adding recipients:", error.message);
      throw error;
    }
  }

  /**
   * Add matching registrations to campaign automatically
   */
  async addMatchingRegistrations(businessId, campaignId, criteria) {
    try {
      const query = { business: businessId };

      // Apply targeting criteria
      if (criteria.minDaysAfterRegistration) {
        const minDate = new Date(
          Date.now() - criteria.minDaysAfterRegistration * 24 * 60 * 60 * 1000
        );
        query.registeredAt = { $lte: minDate };
      }

      if (criteria.maxDaysAfterRegistration) {
        const maxDate = new Date(
          Date.now() - criteria.maxDaysAfterRegistration * 24 * 60 * 60 * 1000
        );
        query.registeredAt = { ...query.registeredAt, $gte: maxDate };
      }

      const followups = await RegistrationFollowup.find(query).select("_id");
      const followupIds = followups.map((f) => f._id);

      if (followupIds.length > 0) {
        await this.addRecipients(businessId, campaignId, followupIds);
      }

      return followupIds.length;
    } catch (error) {
      console.error("Error adding matching registrations:", error.message);
      throw error;
    }
  }

  /**
   * Get campaign performance stats
   */
  async getCampaignStats(businessId, campaignId) {
    try {
      const campaign = await FollowupCampaign.findOne({
        _id: campaignId,
        business: businessId,
      }).populate("recipients.followupId");

      if (!campaign) {
        throw new Error("Campaign not found");
      }

      const totalRecipients = campaign.recipients.length;
      const completedRecipients = campaign.recipients.filter(
        (r) => r.status === "completed"
      ).length;
      const failedRecipients = campaign.recipients.filter(
        (r) => r.status === "failed"
      ).length;

      return {
        campaignId,
        campaignName: campaign.name,
        status: campaign.status,
        metrics: campaign.metrics,
        performance: campaign.performance,
        recipientStats: {
          total: totalRecipients,
          completed: completedRecipients,
          failed: failedRecipients,
          pending: totalRecipients - completedRecipients - failedRecipients,
          completionRate:
            totalRecipients > 0
              ? ((completedRecipients / totalRecipients) * 100).toFixed(2)
              : 0,
        },
        activeSince: campaign.activatedAt,
        estimatedCompletion: campaign.endDate,
      };
    } catch (error) {
      console.error("Error getting campaign stats:", error.message);
      throw error;
    }
  }

  /**
   * Update campaign message sequence
   */
  async updateMessageSequence(businessId, campaignId, messageSequence) {
    try {
      const campaign = await FollowupCampaign.findOneAndUpdate(
        { _id: campaignId, business: businessId },
        {
          messageSequence,
        },
        { new: true }
      );

      if (!campaign) {
        throw new Error("Campaign not found");
      }

      return campaign;
    } catch (error) {
      console.error("Error updating message sequence:", error.message);
      throw error;
    }
  }

  /**
   * Get all campaigns for business
   */
  async getBusinessCampaigns(businessId, filters = {}) {
    try {
      const query = { business: businessId };

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.type) {
        query.type = filters.type;
      }

      const campaigns = await FollowupCampaign.find(query)
        .sort({ createdAt: -1 })
        .limit(filters.limit || 50)
        .skip(filters.skip || 0)
        .populate("messageSequence.templateId");

      const total = await FollowupCampaign.countDocuments(query);

      return {
        campaigns,
        pagination: {
          total,
          limit: filters.limit || 50,
          skip: filters.skip || 0,
        },
      };
    } catch (error) {
      console.error("Error getting business campaigns:", error.message);
      throw error;
    }
  }

  /**
   * Duplicate campaign
   */
  async duplicateCampaign(businessId, campaignId, userId) {
    try {
      const original = await FollowupCampaign.findOne({
        _id: campaignId,
        business: businessId,
      });

      if (!original) {
        throw new Error("Campaign not found");
      }

      // Create new campaign with copied data
      const campaignData = {
        name: `${original.name} (Copy)`,
        description: original.description,
        type: original.type,
        targetAudience: original.targetAudience,
        targetingCriteria: original.targetingCriteria,
        channels: original.channels,
        messageSequence: original.messageSequence,
        autoAddNewRegistrations: original.autoAddNewRegistrations,
        retryFailedMessages: original.retryFailedMessages,
        respectUserPreferences: original.respectUserPreferences,
        tags: original.tags,
      };

      const newCampaign = await this.createCampaign(
        businessId,
        campaignData,
        userId
      );

      console.log(`[Campaign] Duplicated campaign ${campaignId} to ${newCampaign._id}`);

      return newCampaign;
    } catch (error) {
      console.error("Error duplicating campaign:", error.message);
      throw error;
    }
  }

  /**
   * Sync campaign metrics from followups
   */
  async syncCampaignMetrics(businessId, campaignId) {
    try {
      const campaign = await FollowupCampaign.findOne({
        _id: campaignId,
        business: businessId,
      }).populate("recipients.followupId");

      if (!campaign) {
        throw new Error("Campaign not found");
      }

      // Calculate metrics from linked followups
      let emailsSent = 0;
      let emailsOpened = 0;
      let emailsClicked = 0;
      let whatsappMessagesSent = 0;
      let whatsappMessagesRead = 0;
      let conversions = 0;

      campaign.recipients.forEach((recipient) => {
        if (recipient.followupId) {
          const metrics = recipient.followupId.engagementMetrics;
          emailsSent += metrics.totalEmailsSent || 0;
          emailsOpened += metrics.emailsOpened || 0;
          emailsClicked += metrics.linksClicked || 0;
          whatsappMessagesSent += metrics.whatsappMessagesSent || 0;
          whatsappMessagesRead += metrics.whatsappMessagesRead || 0;
          if (metrics.converted) conversions += 1;
        }
      });

      campaign.metrics.emailsSent = emailsSent;
      campaign.metrics.emailsOpened = emailsOpened;
      campaign.metrics.emailsClicked = emailsClicked;
      campaign.metrics.whatsappMessagesSent = whatsappMessagesSent;
      campaign.metrics.whatsappMessagesRead = whatsappMessagesRead;
      campaign.metrics.conversions = conversions;
      campaign.metrics.totalMessagesSent =
        emailsSent + whatsappMessagesSent;

      await campaign.save();

      return campaign;
    } catch (error) {
      console.error("Error syncing metrics:", error.message);
      throw error;
    }
  }

  /**
   * Get platform-level campaigns
   */
  async getPlatformCampaigns(filters = {}) {
    try {
      return await this.getBusinessCampaigns("platform", filters);
    } catch (error) {
      console.error("Error getting platform campaigns:", error.message);
      throw error;
    }
  }

  /**
   * Create platform-level campaign
   */
  async createPlatformCampaign(campaignData, userId) {
    try {
      return await this.createCampaign("platform", campaignData, userId);
    } catch (error) {
      console.error("Error creating platform campaign:", error.message);
      throw error;
    }
  }

  /**
   * Activate platform-level campaign
   */
  async activatePlatformCampaign(campaignId) {
    try {
      return await this.activateCampaign("platform", campaignId);
    } catch (error) {
      console.error("Error activating platform campaign:", error.message);
      throw error;
    }
  }

  /**
   * Pause platform-level campaign
   */
  async pausePlatformCampaign(campaignId) {
    try {
      return await this.pauseCampaign("platform", campaignId);
    } catch (error) {
      console.error("Error pausing platform campaign:", error.message);
      throw error;
    }
  }

  /**
   * Archive platform-level campaign
   */
  async archivePlatformCampaign(campaignId) {
    try {
      return await this.archiveCampaign("platform", campaignId);
    } catch (error) {
      console.error("Error archiving platform campaign:", error.message);
      throw error;
    }
  }

  /**
   * Add recipients to platform campaign
   */
  async addRecipientsToplatformCampaign(campaignId, followupIds) {
    try {
      return await this.addRecipients("platform", campaignId, followupIds);
    } catch (error) {
      console.error("Error adding recipients to platform campaign:", error.message);
      throw error;
    }
  }

  /**
   * Get platform campaign stats
   */
  async getPlatformCampaignStats(campaignId) {
    try {
      return await this.getCampaignStats("platform", campaignId);
    } catch (error) {
      console.error("Error getting platform campaign stats:", error.message);
      throw error;
    }
  }

  /**
   * Duplicate platform campaign
   */
  async duplicatePlatformCampaign(campaignId, userId) {
    try {
      return await this.duplicateCampaign("platform", campaignId, userId);
    } catch (error) {
      console.error("Error duplicating platform campaign:", error.message);
      throw error;
    }
  }

  /**
   * Update platform campaign sequence
   */
  async updatePlatformCampaignSequence(campaignId, messageSequence) {
    try {
      return await this.updateMessageSequence("platform", campaignId, messageSequence);
    } catch (error) {
      console.error("Error updating platform campaign sequence:", error.message);
      throw error;
    }
  }
}

module.exports = new CampaignService();
