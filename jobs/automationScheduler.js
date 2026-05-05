const cron = require("node-cron");
const tiktokAutomationJob = require("./automations/tiktokAutomationJob");
const instagramAutomationJob = require("./automations/instagramAutomationJob");
const registrationFollowupJob = require("./automations/registrationFollowupJob");
const contentPublishingJob = require("./automations/contentPublishingJob");

/**
 * Automation Scheduler
 * Manages all scheduled automation tasks using node-cron
 */
class AutomationScheduler {
  constructor() {
    this.jobs = {};
    this.isRunning = false;
  }

  /**
   * Initialize all scheduled jobs with dynamic frequencies
   */
  async initializeJobs() {
    try {
      console.log("[Scheduler] Initializing automation jobs...");
      const IntegrationSettings = require("../models/integrationSettingsModel");
      const platformId = process.env.SUPERADMIN_BUSINESS_ID;

      const settings = await IntegrationSettings.findOne({ business: platformId });

      // TikTok automation - runs as SellSquare's own marketing account
      const tiktokSchedule = settings?.tiktok?.automationSettings?.jobSchedule || "0 */6 * * *";
      this.scheduleJob("tiktok_automation", tiktokSchedule, async () => {
        console.log("[Scheduler] Running TikTok platform automation job");
        try {
          await tiktokAutomationJob.processPlatformTikTokAutomation();
        } catch (error) {
          console.error("[Scheduler] TikTok automation error:", error.message);
        }
      });

      // Instagram automation - runs as SellSquare's own marketing account
      const instagramSchedule = settings?.instagram?.automationSettings?.jobSchedule || "0 3 * * *";
      this.scheduleJob("instagram_automation", instagramSchedule, async () => {
        console.log("[Scheduler] Running Instagram platform automation job");
        try {
          await instagramAutomationJob.processPlatformInstagramAutomation();
        } catch (error) {
          console.error("[Scheduler] Instagram automation error:", error.message);
        }
      });

      // Registration follow-up
      const followupSchedule = settings?.whatsapp?.automationSettings?.jobSchedule || "*/30 * * * *";
      this.scheduleJob("registration_followup", followupSchedule, async () => {
        console.log("[Scheduler] Running registration follow-up job");
        try {
          await registrationFollowupJob.processAllFollowups();
        } catch (error) {
          console.error("[Scheduler] Registration follow-up error:", error.message);
        }
      });

      // Content publishing
      const publishingSchedule = settings?.contentPublishingSchedule || "0 */4 * * *";
      this.scheduleJob("content_publishing", publishingSchedule, async () => {
        console.log("[Scheduler] Running content publishing job");
        try {
          await contentPublishingJob.publishScheduledContent();
        } catch (error) {
          console.error("[Scheduler] Content publishing error:", error.message);
        }
      });

      // Campaign metrics sync - daily at 2 AM
      this.scheduleJob("campaign_metrics_sync", "0 2 * * *", async () => {
        console.log("[Scheduler] Running campaign metrics sync");
        try {
          await this.syncAllCampaignMetrics();
        } catch (error) {
          console.error("[Scheduler] Campaign metrics sync error:", error.message);
        }
      });

      // Engagement rate cleanup - daily at 3 AM
      this.scheduleJob("engagement_cleanup", "0 3 * * *", async () => {
        console.log("[Scheduler] Running engagement cleanup job");
        try {
          await this.cleanupOldEngagements();
        } catch (error) {
          console.error("[Scheduler] Engagement cleanup error:", error.message);
        }
      });

      // Campaign auto-activation - every hour
      this.scheduleJob("campaign_activation", "0 * * * *", async () => {
        console.log("[Scheduler] Running campaign auto-activation");
        try {
          await this.activateScheduledCampaigns();
        } catch (error) {
          console.error("[Scheduler] Campaign activation error:", error.message);
        }
      });

      // Health check - every 5 minutes
      this.scheduleJob("health_check", "*/5 * * * *", async () => {
        console.log("[Scheduler] Health check - all jobs running");
      });

      this.isRunning = true;
      console.log("[Scheduler] All automation jobs initialized successfully");
    } catch (error) {
      console.error("[Scheduler] Failed to initialize jobs:", error.message);
      // Don't throw, allow server to start even if scheduler fails
    }
  }

  /**
   * Reschedule a specific job dynamically
   */
  rescheduleJob(name, newCronExpression) {
    const jobData = this.jobs[name];
    if (!jobData) {
      console.error(`[Scheduler] Cannot reschedule unknown job: ${name}`);
      return false;
    }

    if (!cron.validate(newCronExpression)) {
      console.error(`[Scheduler] Invalid cron expression for ${name}: ${newCronExpression}`);
      return false;
    }

    console.log(`[Scheduler] Rescheduling job ${name} to ${newCronExpression}`);

    // Stop current job
    jobData.job.stop();

    // Re-schedule with same callback
    const callback = jobData.callback;
    this.scheduleJob(name, newCronExpression, callback);

    return true;
  }

  /**
   * Run a specific job manually and track its status
   */
  async runJob(name) {
    const jobConfig = this.jobs[name];
    if (!jobConfig) {
      console.error(`[Scheduler] Cannot run unknown job: ${name}`);
      return;
    }

    console.log(`[Scheduler] Manually triggering job: ${name}`);
    jobConfig.status = "running";

    try {
      // The callback is provided in scheduleJob
      await jobConfig.callback();
      jobConfig.status = "completed";
      jobConfig.lastRun = new Date();
      jobConfig.lastError = null;
    } catch (error) {
      console.error(`[Scheduler] Manual job execution error (${name}):`, error.message);
      jobConfig.status = "error";
      jobConfig.lastError = error.message;
    }
  }

  /**
   * Schedule a cron job
   */
  scheduleJob(name, cronExpression, callback) {
    try {
      const wrappedCallback = async () => {
        const jobData = this.jobs[name];
        if (jobData) jobData.status = "running";

        try {
          await callback();
          if (jobData) {
            jobData.status = "completed";
            jobData.lastRun = new Date();
          }
        } catch (error) {
          console.error(`[Scheduler] Job execution error (${name}):`, error.message);
          if (jobData) {
            jobData.status = "error";
            jobData.lastError = error.message;
          }
        }
      };

      const job = cron.schedule(cronExpression, wrappedCallback, {
        scheduled: true,
        timezone: process.env.TIMEZONE || "UTC",
      });

      this.jobs[name] = {
        job,
        callback, // Keep original callback for manual runs
        schedule: cronExpression,
        lastRun: null,
        nextRun: this.calculateNextRun(cronExpression),
        status: "pending",
        lastError: null
      };

      console.log(`[Scheduler] Scheduled job: ${name} (${cronExpression})`);
    } catch (error) {
      console.error(`[Scheduler] Failed to schedule job ${name}:`, error.message);
      throw error;
    }
  }

  /**
   * Calculate next run time for a cron expression
   */
  calculateNextRun(cronExpression) {
    // Simple implementation - use cron-parser for more accuracy
    const now = new Date();
    // This is simplified; use proper cron-parser library for production
    return new Date(now.getTime() + 5 * 60 * 1000); // Placeholder
  }

  /**
   * Stop all scheduled jobs
   */
  stopAllJobs() {
    try {
      Object.values(this.jobs).forEach((jobData) => {
        jobData.job.stop();
      });
      this.isRunning = false;
      console.log("[Scheduler] All jobs stopped");
    } catch (error) {
      console.error("[Scheduler] Error stopping jobs:", error.message);
    }
  }

  /**
   * Get job status
   */
  getJobStatus(jobName) {
    return this.jobs[jobName] || null;
  }

  /**
   * Get all job statuses
   */
  getAllJobStatuses() {
    const statuses = {};
    Object.entries(this.jobs).forEach(([name, jobData]) => {
      statuses[name] = {
        schedule: jobData.schedule,
        lastRun: jobData.lastRun,
        nextRun: jobData.nextRun,
        status: jobData.status,
        lastError: jobData.lastError,
        running: this.isRunning,
      };
    });
    return statuses;
  }

  /**
   * Sync all campaign metrics
   */
  async syncAllCampaignMetrics() {
    const FollowupCampaign = require("../models/followupCampaignModel");
    const campaignService = require("../services/campaigns/campaignService");

    try {
      const campaigns = await FollowupCampaign.find({ status: "active" });

      for (const campaign of campaigns) {
        try {
          await campaignService.syncCampaignMetrics(campaign.business, campaign._id);
        } catch (error) {
          console.error(
            `Failed to sync metrics for campaign ${campaign._id}:`,
            error.message
          );
        }
      }

      console.log(`[Scheduler] Synced metrics for ${campaigns.length} campaigns`);
    } catch (error) {
      console.error("[Scheduler] Error syncing campaign metrics:", error.message);
    }
  }

  /**
   * Cleanup old engagement records
   */
  async cleanupOldEngagements() {
    const SocialMediaEngagement = require("../models/socialMediaEngagementModel");

    try {
      // Delete engagement records older than 90 days
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      const result = await SocialMediaEngagement.deleteMany({
        createdAt: { $lt: ninetyDaysAgo },
        status: "archived",
      });

      console.log(
        `[Scheduler] Deleted ${result.deletedCount} old engagement records`
      );
    } catch (error) {
      console.error("[Scheduler] Error cleaning up engagements:", error.message);
    }
  }

  /**
   * Activate scheduled campaigns
   */
  async activateScheduledCampaigns() {
    const FollowupCampaign = require("../models/followupCampaignModel");
    const campaignService = require("../services/campaigns/campaignService");

    try {
      const now = new Date();

      // Find campaigns scheduled to start now
      const campaigns = await FollowupCampaign.find({
        status: "draft",
        startDate: { $lte: now },
      });

      for (const campaign of campaigns) {
        try {
          await campaignService.activateCampaign(campaign.business, campaign._id);
        } catch (error) {
          console.error(
            `Failed to activate campaign ${campaign._id}:`,
            error.message
          );
        }
      }

      if (campaigns.length > 0) {
        console.log(`[Scheduler] Activated ${campaigns.length} scheduled campaigns`);
      }
    } catch (error) {
      console.error("[Scheduler] Error activating campaigns:", error.message);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      jobCount: Object.keys(this.jobs).length,
      jobs: this.getAllJobStatuses(),
    };
  }
}

// Export singleton instance
let scheduler;

try {
  scheduler = new AutomationScheduler();
} catch (error) {
  console.error("[AutomationScheduler] Failed to initialize scheduler:", error.message);
  // Ensure we export an object with the required methods to prevent "getStatus is not a function" errors
  scheduler = {
    getStatus: () => ({
      isRunning: false,
      jobCount: 0,
      jobs: {},
      error: "Scheduler initialization failed"
    }),
    initializeJobs: () => {
      console.error("[AutomationScheduler] Cannot initialize - scheduler not properly loaded");
    },
    stopAllJobs: () => {
      console.error("[AutomationScheduler] Cannot stop - scheduler not properly loaded");
    }
  };
}

module.exports = scheduler;
