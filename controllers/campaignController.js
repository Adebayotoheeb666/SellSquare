const asyncHandler = require("express-async-handler");
const Campaign = require("../models/campaignModel");
const CampaignExecution = require("../models/campaignExecutionModel");
const Template = require("../models/templateModel");
const {
  executeScheduledCampaign,
  executeCampaignForRecipient,
} = require("../utils/campaignExecutionEngine");

/**
 * GET /api/campaigns - Get all campaigns for business
 */
exports.getCampaigns = asyncHandler(async (req, res) => {
  const { status, type } = req.query;

  const filter = { business: req.business._id };

  if (status) filter.status = status;
  if (type) filter.type = type;

  const campaigns = await Campaign.find(filter)
    .populate("channels.templateId", "name type")
    .select("-__v")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: campaigns.length,
    data: campaigns,
  });
});

/**
 * GET /api/campaigns/:id - Get specific campaign
 */
exports.getCampaignById = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({
    _id: req.params.id,
    business: req.business._id,
  }).populate("channels.templateId");

  if (!campaign) {
    return res.status(404).json({
      success: false,
      message: "Campaign not found",
    });
  }

  res.status(200).json({
    success: true,
    data: campaign,
  });
});

/**
 * POST /api/campaigns - Create new campaign
 */
exports.createCampaign = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    type,
    channels,
    triggerConfig,
    targetAudience,
    variableMapping,
    executionLimit,
  } = req.body;

  // Validate required fields
  if (!name || !type || !channels || channels.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Name, type, and at least one channel are required",
    });
  }

  // Validate templates exist
  for (const channel of channels) {
    const template = await Template.findOne({
      _id: channel.templateId,
      business: req.business._id,
    });

    if (!template) {
      return res.status(400).json({
        success: false,
        message: `Template ${channel.templateId} not found`,
      });
    }

    // Validate channel type matches template type
    if (template.type !== channel.type) {
      return res.status(400).json({
        success: false,
        message: `Template type must match channel type`,
      });
    }
  }

  const campaign = await Campaign.create({
    business: req.business._id,
    name,
    description: description || "",
    type,
    channels,
    triggerConfig: triggerConfig || {},
    targetAudience: targetAudience || { type: "all_customers" },
    variableMapping: variableMapping || {},
    executionLimit: executionLimit || { type: "unlimited" },
    status: "draft",
    createdBy: req.user?._id,
  });

  await campaign.save();

  const populated = await Campaign.findById(campaign._id).populate(
    "channels.templateId"
  );

  res.status(201).json({
    success: true,
    message: "Campaign created successfully",
    data: populated,
  });
});

/**
 * PUT /api/campaigns/:id - Update campaign
 */
exports.updateCampaign = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({
    _id: req.params.id,
    business: req.business._id,
  });

  if (!campaign) {
    return res.status(404).json({
      success: false,
      message: "Campaign not found",
    });
  }

  // Prevent updating active campaigns
  if (campaign.status === "active") {
    return res.status(400).json({
      success: false,
      message: "Cannot update active campaigns. Pause or cancel first.",
    });
  }

  const {
    name,
    description,
    channels,
    triggerConfig,
    targetAudience,
    variableMapping,
    executionLimit,
  } = req.body;

  // Update fields
  if (name) campaign.name = name;
  if (description !== undefined) campaign.description = description;
  if (channels) {
    // Validate new templates
    for (const channel of channels) {
      const template = await Template.findOne({
        _id: channel.templateId,
        business: req.business._id,
      });

      if (!template) {
        return res.status(400).json({
          success: false,
          message: `Template ${channel.templateId} not found`,
        });
      }
    }
    campaign.channels = channels;
  }
  if (triggerConfig) campaign.triggerConfig = triggerConfig;
  if (targetAudience) campaign.targetAudience = targetAudience;
  if (variableMapping) campaign.variableMapping = variableMapping;
  if (executionLimit) campaign.executionLimit = executionLimit;

  campaign.updatedBy = req.user?._id;
  await campaign.save();

  const populated = await Campaign.findById(campaign._id).populate(
    "channels.templateId"
  );

  res.status(200).json({
    success: true,
    message: "Campaign updated successfully",
    data: populated,
  });
});

/**
 * PATCH /api/campaigns/:id/status - Update campaign status
 */
exports.updateCampaignStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!["draft", "active", "paused", "completed"].includes(status)) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid status. Must be draft, active, paused, or completed",
    });
  }

  const campaign = await Campaign.findOneAndUpdate(
    { _id: req.params.id, business: req.business._id },
    { status, updatedBy: req.user?._id },
    { new: true }
  ).populate("channels.templateId");

  if (!campaign) {
    return res.status(404).json({
      success: false,
      message: "Campaign not found",
    });
  }

  res.status(200).json({
    success: true,
    message: `Campaign status updated to ${status}`,
    data: campaign,
  });
});

/**
 * DELETE /api/campaigns/:id - Delete campaign
 */
exports.deleteCampaign = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOneAndDelete({
    _id: req.params.id,
    business: req.business._id,
  });

  if (!campaign) {
    return res.status(404).json({
      success: false,
      message: "Campaign not found",
    });
  }

  res.status(200).json({
    success: true,
    message: "Campaign deleted successfully",
  });
});

/**
 * POST /api/campaigns/:id/execute - Manually execute campaign
 */
exports.executeCampaign = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({
    _id: req.params.id,
    business: req.business._id,
  }).populate("channels.templateId");

  if (!campaign) {
    return res.status(404).json({
      success: false,
      message: "Campaign not found",
    });
  }

  if (campaign.type !== "manual") {
    return res.status(400).json({
      success: false,
      message: "Only manual campaigns can be executed directly",
    });
  }

  try {
    const result = await executeScheduledCampaign(campaign._id, req.business._id);

    res.status(200).json({
      success: true,
      message: "Campaign execution started",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/campaigns/:id/send-to-recipient - Send campaign to specific recipient
 */
exports.sendCampaignToRecipient = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({
    _id: req.params.id,
    business: req.business._id,
  }).populate("channels.templateId");

  if (!campaign) {
    return res.status(404).json({
      success: false,
      message: "Campaign not found",
    });
  }

  const { recipient, variables } = req.body;

  if (!recipient || !recipient.email) {
    return res.status(400).json({
      success: false,
      message: "Recipient email is required",
    });
  }

  try {
    const execution = await executeCampaignForRecipient(
      campaign,
      recipient,
      req.business._id,
      variables || campaign.variableMapping
    );

    res.status(200).json({
      success: true,
      message: "Campaign sent to recipient",
      data: execution,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/campaigns/:id/executions - Get campaign execution history
 */
exports.getCampaignExecutions = asyncHandler(async (req, res) => {
  const { status, limit = 50, skip = 0 } = req.query;

  const filter = {
    campaign: req.params.id,
    business: req.business._id,
  };

  if (status) filter["channels.status"] = status;

  const executions = await CampaignExecution.find(filter)
    .select("-__v")
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip));

  const total = await CampaignExecution.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: executions.length,
    total,
    skip: parseInt(skip),
    limit: parseInt(limit),
    data: executions,
  });
});

/**
 * GET /api/campaigns/:id/stats - Get campaign statistics
 */
exports.getCampaignStats = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({
    _id: req.params.id,
    business: req.business._id,
  });

  if (!campaign) {
    return res.status(404).json({
      success: false,
      message: "Campaign not found",
    });
  }

  const executions = await CampaignExecution.find({
    campaign: campaign._id,
  });

  const stats = {
    totalSent: executions.length,
    totalFailed: executions.filter((e) =>
      e.channels.some((ch) => ch.status === "failed")
    ).length,
    totalDelivered: executions.filter((e) =>
      e.channels.every((ch) => ch.status === "delivered" || ch.status === "sent")
    ).length,
    totalOpened: executions.filter((e) => e.engagement.opened).length,
    totalClicked: executions.filter((e) => e.engagement.clicked).length,
    openRate:
      executions.length > 0
        ? ((executions.filter((e) => e.engagement.opened).length /
            executions.length) *
            100).toFixed(2)
        : 0,
    clickRate:
      executions.length > 0
        ? ((executions.filter((e) => e.engagement.clicked).length /
            executions.length) *
            100).toFixed(2)
        : 0,
  };

  res.status(200).json({
    success: true,
    data: stats,
  });
});
