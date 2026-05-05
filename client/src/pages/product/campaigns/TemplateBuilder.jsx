import { useState, useEffect } from "react";
import { useAsyncToast } from "../../../customHook/useAsyncToast";
import "./campaigns.css";

const TEMPLATE_TYPES = {
  email: { label: "Email", icon: "📧" },
  whatsapp: { label: "WhatsApp", icon: "💬" },
  sms: { label: "SMS", icon: "📱" },
};

const TEMPLATE_CATEGORIES = [
  { value: "transactional", label: "Transactional" },
  { value: "marketing", label: "Marketing" },
  { value: "operational", label: "Operational" },
  { value: "abandoned-cart", label: "Abandoned Cart" },
  { value: "welcome", label: "Welcome" },
  { value: "confirmation", label: "Confirmation" },
  { value: "reminder", label: "Reminder" },
  { value: "custom", label: "Custom" },
];

const TemplateBuilder = ({ onSave, initialTemplate = null, isLoading = false }) => {
  const { showToast } = useAsyncToast();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "email",
    category: "custom",
    subject: "",
    body: "",
    previewData: {},
  });

  const [preview, setPreview] = useState("");
  const [variables, setVariables] = useState([]);

  useEffect(() => {
    if (initialTemplate) {
      setFormData(initialTemplate);
      extractVariables(initialTemplate.body, initialTemplate.subject);
    }
  }, [initialTemplate]);

  const extractVariables = (body, subject = "") => {
    const regex = /\{\{(\w+(?:\.\w+)*)\}\}|\$\{(\w+(?:\.\w+)*)\}/g;
    const vars = new Set();
    let match;

    const text = `${subject} ${body}`;
    while ((match = regex.exec(text)) !== null) {
      vars.add(match[1] || match[2]);
    }

    setVariables(Array.from(vars));
  };

  const handleBodyChange = (e) => {
    const body = e.target.value;
    setFormData({ ...formData, body });
    extractVariables(body, formData.subject);
  };

  const handleSubjectChange = (e) => {
    const subject = e.target.value;
    setFormData({ ...formData, subject });
    extractVariables(formData.body, subject);
  };

  const handleInsertVariable = (variable) => {
    const textarea = document.querySelector(".template-body-input");
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;

      const newText =
        text.substring(0, start) + `{{${variable}}}` + text.substring(end);
      setFormData({ ...formData, body: newText });
      extractVariables(newText, formData.subject);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variable.length + 4;
        textarea.focus();
      }, 0);
    }
  };

  const handleGeneratePreview = async () => {
    try {
      const templateId = initialTemplate?._id;
      if (!templateId) {
        showToast("Save template first to generate preview", "warning");
        return;
      }

      const response = await fetch(`/api/templates/${templateId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variables: variables.reduce(
            (acc, v) => ({
              ...acc,
              [v]: `[${v}]`,
            }),
            {}
          ),
        }),
      });

      if (!response.ok) throw new Error("Failed to generate preview");

      const data = await response.json();
      setPreview(data.preview || "");
      showToast("Preview generated", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      showToast("Template name is required", "warning");
      return;
    }

    if (!formData.body.trim()) {
      showToast("Template body is required", "warning");
      return;
    }

    if (formData.type === "email" && !formData.subject.trim()) {
      showToast("Subject is required for email templates", "warning");
      return;
    }

    onSave(formData);
  };

  return (
    <div className="template-builder-container">
      <form onSubmit={handleSubmit} className="template-form">
        <div className="form-section">
          <h3>Template Details</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Template Name *</label>
              <input
                type="text"
                className="form-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Welcome Email"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label>Template Type *</label>
              <select
                className="form-select"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                disabled={isLoading || !!initialTemplate}
              >
                {Object.entries(TEMPLATE_TYPES).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select
                className="form-select"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                disabled={isLoading}
              >
                {TEMPLATE_CATEGORIES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                className="form-input"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of this template"
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        {formData.type === "email" && (
          <div className="form-section">
            <h3>Email Subject</h3>
            <div className="form-group">
              <label>Subject Line *</label>
              <input
                type="text"
                className="form-input"
                value={formData.subject}
                onChange={handleSubjectChange}
                placeholder="e.g., Welcome to {{businessName}}"
                disabled={isLoading}
              />
              <small className="form-hint">
                Use {{variable}} syntax to insert dynamic content
              </small>
            </div>
          </div>
        )}

        <div className="form-section">
          <h3>Message Content</h3>

          <div className="template-editor">
            <div className="editor-main">
              <label>Message Body *</label>
              <textarea
                className="template-body-input form-input"
                value={formData.body}
                onChange={handleBodyChange}
                placeholder="Enter your message template. Use {{variableName}} for dynamic content."
                rows="12"
                disabled={isLoading}
              />
              <small className="form-hint">
                Use {{variable}} syntax to insert dynamic content from your data
              </small>
            </div>

            <div className="editor-sidebar">
              <div className="variables-panel">
                <h4>Variables Detected</h4>
                <div className="variable-list">
                  {variables.length > 0 ? (
                    variables.map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        className="variable-tag"
                        onClick={() => handleInsertVariable(variable)}
                        title="Click to insert"
                        disabled={isLoading}
                      >
                        {{variable}}
                      </button>
                    ))
                  ) : (
                    <p className="empty-state">No variables detected yet</p>
                  )}
                </div>
              </div>

              <div className="common-variables">
                <h4>Common Variables</h4>
                <div className="variable-list">
                  {["customerName", "businessName", "email", "phone", "orderTotal"].map(
                    (variable) => (
                      <button
                        key={variable}
                        type="button"
                        className="variable-tag common"
                        onClick={() => handleInsertVariable(variable)}
                        title="Click to insert"
                        disabled={isLoading}
                      >
                        {{variable}}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleGeneratePreview}
              disabled={isLoading || !formData.body}
            >
              Preview Template
            </button>
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Template"}
            </button>
          </div>
        </div>
      </form>

      {preview && (
        <div className="template-preview">
          <h3>Template Preview</h3>
          <div className="preview-content" dangerouslySetInnerHTML={{ __html: preview }} />
        </div>
      )}
    </div>
  );
};

export default TemplateBuilder;
