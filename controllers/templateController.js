const asyncHandler = require("express-async-handler");
const Template = require("../models/templateModel");
const {
  extractVariables,
  generateEmailPreview,
} = require("../utils/campaignTemplateEngine");

/**
 * GET /api/templates - Get all templates for business
 */
exports.getTemplates = asyncHandler(async (req, res) => {
  const { type, category, isActive } = req.query;

  const filter = { business: req.business._id };

  if (type) filter.type = type;
  if (category) filter.category = category;
  if (isActive !== undefined) filter.isActive = isActive === "true";

  const templates = await Template.find(filter)
    .select("-__v")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: templates.length,
    data: templates,
  });
});

/**
 * GET /api/templates/:id - Get specific template
 */
exports.getTemplateById = asyncHandler(async (req, res) => {
  const template = await Template.findOne({
    _id: req.params.id,
    business: req.business._id,
  });

  if (!template) {
    return res.status(404).json({
      success: false,
      message: "Template not found",
    });
  }

  res.status(200).json({
    success: true,
    data: template,
  });
});

/**
 * POST /api/templates - Create new template
 */
exports.createTemplate = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    type,
    category,
    subject,
    body,
    previewData,
  } = req.body;

  // Validate required fields
  if (!name || !type || !body) {
    return res.status(400).json({
      success: false,
      message: "Name, type, and body are required",
    });
  }

  // Email type requires subject
  if (type === "email" && !subject) {
    return res.status(400).json({
      success: false,
      message: "Email templates require a subject",
    });
  }

  // Extract variables from template
  const variables = [
    ...new Set([
      ...extractVariables(body),
      ...(subject ? extractVariables(subject) : []),
    ]),
  ];

  const template = await Template.create({
    business: req.business._id,
    name,
    description,
    type,
    category,
    subject: subject || "",
    body,
    variables,
    previewData: previewData || {},
    createdBy: req.user?._id,
  });

  await template.save();

  res.status(201).json({
    success: true,
    message: "Template created successfully",
    data: template,
  });
});

/**
 * PUT /api/templates/:id - Update template
 */
exports.updateTemplate = asyncHandler(async (req, res) => {
  const template = await Template.findOne({
    _id: req.params.id,
    business: req.business._id,
  });

  if (!template) {
    return res.status(404).json({
      success: false,
      message: "Template not found",
    });
  }

  const { name, description, type, category, subject, body, previewData } =
    req.body;

  // Update fields
  if (name) template.name = name;
  if (description !== undefined) template.description = description;
  if (type) template.type = type;
  if (category) template.category = category;
  if (subject !== undefined) template.subject = subject;
  if (body) template.body = body;
  if (previewData) template.previewData = previewData;

  // Re-extract variables
  if (body || subject) {
    template.variables = [
      ...new Set([
        ...extractVariables(body || template.body),
        ...extractVariables(subject || template.subject),
      ]),
    ];
  }

  template.updatedBy = req.user?._id;
  await template.save();

  res.status(200).json({
    success: true,
    message: "Template updated successfully",
    data: template,
  });
});

/**
 * DELETE /api/templates/:id - Delete template
 */
exports.deleteTemplate = asyncHandler(async (req, res) => {
  const template = await Template.findOneAndDelete({
    _id: req.params.id,
    business: req.business._id,
  });

  if (!template) {
    return res.status(404).json({
      success: false,
      message: "Template not found",
    });
  }

  res.status(200).json({
    success: true,
    message: "Template deleted successfully",
  });
});

/**
 * POST /api/templates/:id/preview - Generate template preview
 */
exports.previewTemplate = asyncHandler(async (req, res) => {
  const template = await Template.findOne({
    _id: req.params.id,
    business: req.business._id,
  });

  if (!template) {
    return res.status(404).json({
      success: false,
      message: "Template not found",
    });
  }

  const { variables = {} } = req.body;

  try {
    if (template.type === "email") {
      const preview = generateEmailPreview(
        template.subject,
        template.body,
        variables
      );

      res.status(200).json({
        success: true,
        preview,
      });
    } else {
      // For other types, just return interpolated body
      const { interpolateTemplate } = require("../utils/campaignTemplateEngine");
      const renderedBody = interpolateTemplate(template.body, variables);

      res.status(200).json({
        success: true,
        preview: renderedBody,
      });
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/templates/duplicate/:id - Duplicate template
 */
exports.duplicateTemplate = asyncHandler(async (req, res) => {
  const template = await Template.findOne({
    _id: req.params.id,
    business: req.business._id,
  });

  if (!template) {
    return res.status(404).json({
      success: false,
      message: "Template not found",
    });
  }

  const newTemplate = await Template.create({
    business: template.business,
    name: `${template.name} (Copy)`,
    description: template.description,
    type: template.type,
    category: template.category,
    subject: template.subject,
    body: template.body,
    variables: template.variables,
    previewData: template.previewData,
    createdBy: req.user?._id,
  });

  res.status(201).json({
    success: true,
    message: "Template duplicated successfully",
    data: newTemplate,
  });
});
