const express = require("express");
const router = express.Router();
const protect = require("../middleWare/authMiddleware");
const {
  getCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  updateCampaignStatus,
  deleteCampaign,
  executeCampaign,
  sendCampaignToRecipient,
  getCampaignExecutions,
  getCampaignStats,
} = require("../controllers/campaignController");

// All routes require authentication
router.use(protect);

// Campaign CRUD
router.get("/", getCampaigns);
router.post("/", createCampaign);
router.get("/:id", getCampaignById);
router.put("/:id", updateCampaign);
router.patch("/:id/status", updateCampaignStatus);
router.delete("/:id", deleteCampaign);

// Campaign execution
router.post("/:id/execute", executeCampaign);
router.post("/:id/send-to-recipient", sendCampaignToRecipient);

// Campaign analytics
router.get("/:id/executions", getCampaignExecutions);
router.get("/:id/stats", getCampaignStats);

module.exports = router;
