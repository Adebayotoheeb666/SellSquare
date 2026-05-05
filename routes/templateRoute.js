const express = require("express");
const router = express.Router();
const protect = require("../middleWare/authMiddleware");
const {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  previewTemplate,
  duplicateTemplate,
} = require("../controllers/templateController");

// All routes require authentication
router.use(protect);

// Template CRUD
router.get("/", getTemplates);
router.post("/", createTemplate);
router.get("/:id", getTemplateById);
router.put("/:id", updateTemplate);
router.delete("/:id", deleteTemplate);

// Template operations
router.post("/:id/preview", previewTemplate);
router.post("/:id/duplicate", duplicateTemplate);

module.exports = router;
