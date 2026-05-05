/**
 * Campaign Template Engine
 * Handles variable interpolation, template rendering, and message generation
 */

const Template = require("../models/templateModel");

/**
 * Extract variables from template string
 * Supports: {{variableName}}, ${variableName}
 */
function extractVariables(templateStr) {
  const regex = /\{\{(\w+)\}\}|\$\{(\w+)\}/g;
  const variables = new Set();
  let match;

  while ((match = regex.exec(templateStr)) !== null) {
    const varName = match[1] || match[2];
    variables.add(varName);
  }

  return Array.from(variables);
}

/**
 * Interpolate variables in template
 * Supports nested object access: {{user.firstName}}, {{order.items.0.name}}
 */
function interpolateTemplate(template, data) {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}|\$\{(\w+(?:\.\w+)*)\}/g, (match, path1, path2) => {
    const path = path1 || path2;
    const value = getNestedValue(data, path);
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Get value from nested object using dot notation
 */
function getNestedValue(obj, path) {
  return path.split(".").reduce((current, key) => {
    if (current && typeof current === "object") {
      return current[key];
    }
    return undefined;
  }, obj);
}

/**
 * Render template with variables
 */
async function renderTemplate(templateId, variables = {}, businessId) {
  try {
    const template = await Template.findById(templateId);

    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    if (template.business.toString() !== businessId.toString()) {
      throw new Error("Unauthorized access to template");
    }

    const renderedBody = interpolateTemplate(template.body, variables);
    const renderedSubject = template.subject
      ? interpolateTemplate(template.subject, variables)
      : "";

    return {
      subject: renderedSubject,
      body: renderedBody,
      type: template.type,
      variables: template.variables,
    };
  } catch (error) {
    throw new Error(`Template rendering failed: ${error.message}`);
  }
}

/**
 * Validate that all required variables are provided
 */
function validateVariables(requiredVariables, providedVariables) {
  const missing = requiredVariables.filter(
    (v) => !providedVariables.hasOwnProperty(v)
  );

  if (missing.length > 0) {
    return {
      valid: false,
      missingVariables: missing,
    };
  }

  return {
    valid: true,
  };
}

/**
 * Generate preview HTML for email template
 */
function generateEmailPreview(subject, body, variables = {}) {
  const renderedBody = interpolateTemplate(body, variables);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .preview-container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .preview-header { background-color: #f5f5f5; padding: 20px; margin-bottom: 20px; border-radius: 4px; }
          .preview-subject { font-size: 20px; font-weight: bold; color: #000; }
          .preview-body { background-color: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="preview-container">
          <div class="preview-header">
            <div class="preview-subject">${escapeHtml(subject)}</div>
          </div>
          <div class="preview-body">
            ${renderedBody.replace(/\n/g, "<br>")}
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

module.exports = {
  extractVariables,
  interpolateTemplate,
  getNestedValue,
  renderTemplate,
  validateVariables,
  generateEmailPreview,
  escapeHtml,
};
