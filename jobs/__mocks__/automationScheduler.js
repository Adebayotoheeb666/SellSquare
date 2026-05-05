module.exports = {
  initializeJobs: jest.fn(),
  scheduleJob: jest.fn(),
  stopAllJobs: jest.fn(),
  getJobStatus: jest.fn(),
  getAllJobStatuses: jest.fn(),
  syncAllCampaignMetrics: jest.fn(),
  cleanupOldEngagements: jest.fn(),
  activateScheduledCampaigns: jest.fn(),
  getStatus: jest.fn(),
};
