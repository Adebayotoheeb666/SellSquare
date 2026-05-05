/**
 * Campaign Events System
 * Integrates with the central event bus to emit campaign execution events
 * and broadcast them via WebSocket/SSE to connected clients
 */

const { eventBus } = require("./EventEmitter");
const { wsManager, sseManager } = require("./index");

// Campaign event types
const CampaignEventTypes = {
  CAMPAIGN_CREATED: "campaign.created",
  CAMPAIGN_UPDATED: "campaign.updated",
  CAMPAIGN_DELETED: "campaign.deleted",
  CAMPAIGN_ACTIVATED: "campaign.activated",
  CAMPAIGN_PAUSED: "campaign.paused",
  CAMPAIGN_COMPLETED: "campaign.completed",
  CAMPAIGN_EXECUTION_STARTED: "campaign.execution_started",
  CAMPAIGN_EXECUTION_COMPLETED: "campaign.execution_completed",
  CAMPAIGN_MESSAGE_SENT: "campaign.message_sent",
  CAMPAIGN_MESSAGE_FAILED: "campaign.message_failed",
  CAMPAIGN_MESSAGE_DELIVERED: "campaign.message_delivered",
  CAMPAIGN_MESSAGE_OPENED: "campaign.message_opened",
  CAMPAIGN_MESSAGE_CLICKED: "campaign.message_clicked",
};

/**
 * Emit campaign event
 */
function emitCampaignEvent(eventType, payload, businessId) {
  try {
    const eventData = {
      type: eventType,
      timestamp: new Date().toISOString(),
      businessId: businessId.toString?.() || String(businessId),
      data: payload,
    };

    // Emit to event bus
    eventBus.emit(eventType, eventData);

    // Broadcast via WebSocket
    broadcastCampaignEventViaWebSocket(eventData, businessId);

    // Broadcast via SSE
    broadcastCampaignEventViaSSE(eventData, businessId);

    return eventData;
  } catch (error) {
    console.error("[CampaignEvents] Error emitting campaign event:", error);
    throw error;
  }
}

/**
 * Broadcast campaign event via WebSocket
 */
function broadcastCampaignEventViaWebSocket(eventData, businessId) {
  try {
    const businessIdStr = businessId.toString?.() || String(businessId);
    const channel = `business:${businessIdStr}`;

    if (wsManager) {
      wsManager.broadcast(channel, {
        type: "campaign_event",
        eventType: eventData.type,
        data: eventData.data,
        timestamp: eventData.timestamp,
      });
    }
  } catch (error) {
    console.error("[CampaignEvents] Error broadcasting via WebSocket:", error);
  }
}

/**
 * Broadcast campaign event via SSE
 */
function broadcastCampaignEventViaSSE(eventData, businessId) {
  try {
    const businessIdStr = businessId.toString?.() || String(businessId);
    const channel = `business:${businessIdStr}`;

    if (sseManager) {
      sseManager.broadcast(channel, {
        type: "campaign_event",
        eventType: eventData.type,
        data: eventData.data,
        timestamp: eventData.timestamp,
      });
    }
  } catch (error) {
    console.error("[CampaignEvents] Error broadcasting via SSE:", error);
  }
}

/**
 * Emit event when campaign is created
 */
function emitCampaignCreated(campaign, businessId) {
  return emitCampaignEvent(CampaignEventTypes.CAMPAIGN_CREATED, {
    campaignId: campaign._id,
    name: campaign.name,
    type: campaign.type,
    status: campaign.status,
  }, businessId);
}

/**
 * Emit event when campaign is updated
 */
function emitCampaignUpdated(campaign, businessId) {
  return emitCampaignEvent(CampaignEventTypes.CAMPAIGN_UPDATED, {
    campaignId: campaign._id,
    name: campaign.name,
    status: campaign.status,
  }, businessId);
}

/**
 * Emit event when campaign execution starts
 */
function emitCampaignExecutionStarted(campaignId, businessId, recipientCount) {
  return emitCampaignEvent(CampaignEventTypes.CAMPAIGN_EXECUTION_STARTED, {
    campaignId,
    recipientCount,
    startedAt: new Date(),
  }, businessId);
}

/**
 * Emit event when campaign execution completes
 */
function emitCampaignExecutionCompleted(campaignId, businessId, stats) {
  return emitCampaignEvent(CampaignEventTypes.CAMPAIGN_EXECUTION_COMPLETED, {
    campaignId,
    stats,
    completedAt: new Date(),
  }, businessId);
}

/**
 * Emit event when a message is sent
 */
function emitCampaignMessageSent(executionId, campaignId, businessId, channel, recipient) {
  return emitCampaignEvent(CampaignEventTypes.CAMPAIGN_MESSAGE_SENT, {
    executionId,
    campaignId,
    channel,
    recipient,
    sentAt: new Date(),
  }, businessId);
}

/**
 * Emit event when a message delivery fails
 */
function emitCampaignMessageFailed(executionId, campaignId, businessId, channel, recipient, reason) {
  return emitCampaignEvent(CampaignEventTypes.CAMPAIGN_MESSAGE_FAILED, {
    executionId,
    campaignId,
    channel,
    recipient,
    reason,
    failedAt: new Date(),
  }, businessId);
}

/**
 * Emit event when a message is delivered
 */
function emitCampaignMessageDelivered(executionId, campaignId, businessId, channel, recipient) {
  return emitCampaignEvent(CampaignEventTypes.CAMPAIGN_MESSAGE_DELIVERED, {
    executionId,
    campaignId,
    channel,
    recipient,
    deliveredAt: new Date(),
  }, businessId);
}

/**
 * Emit event when a message is opened (email)
 */
function emitCampaignMessageOpened(executionId, campaignId, businessId, recipient) {
  return emitCampaignEvent(CampaignEventTypes.CAMPAIGN_MESSAGE_OPENED, {
    executionId,
    campaignId,
    recipient,
    openedAt: new Date(),
  }, businessId);
}

/**
 * Emit event when a message link is clicked
 */
function emitCampaignMessageClicked(executionId, campaignId, businessId, recipient, url) {
  return emitCampaignEvent(CampaignEventTypes.CAMPAIGN_MESSAGE_CLICKED, {
    executionId,
    campaignId,
    recipient,
    url,
    clickedAt: new Date(),
  }, businessId);
}

module.exports = {
  CampaignEventTypes,
  emitCampaignEvent,
  emitCampaignCreated,
  emitCampaignUpdated,
  emitCampaignExecutionStarted,
  emitCampaignExecutionCompleted,
  emitCampaignMessageSent,
  emitCampaignMessageFailed,
  emitCampaignMessageDelivered,
  emitCampaignMessageOpened,
  emitCampaignMessageClicked,
};
