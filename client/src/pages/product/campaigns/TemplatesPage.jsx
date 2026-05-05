import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAsyncToast } from "../../../customHook/useAsyncToast";
import TemplateBuilder from "./TemplateBuilder";
import "./campaigns.css";

const TemplatesPage = () => {
  const navigate = useNavigate();
  const { showToast } = useAsyncToast();
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [filterType, setFilterType] = useState("");

  // Fetch templates
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const url = filterType ? `/api/templates?type=${filterType}` : "/api/templates";
      const response = await fetch(url);

      if (!response.ok) throw new Error("Failed to fetch templates");

      const data = await response.json();
      setTemplates(data.data || []);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTemplate = async (templateData) => {
    setIsLoading(true);
    try {
      const url = selectedTemplate ? `/api/templates/${selectedTemplate._id}` : "/api/templates";
      const method = selectedTemplate ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateData),
      });

      if (!response.ok) throw new Error("Failed to save template");

      showToast(
        selectedTemplate ? "Template updated successfully" : "Template created successfully",
        "success"
      );

      setShowBuilder(false);
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete template");

      showToast("Template deleted successfully", "success");
      fetchTemplates();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDuplicateTemplate = async (templateId) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/templates/${templateId}/duplicate`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to duplicate template");

      showToast("Template duplicated successfully", "success");
      fetchTemplates();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeIcon = (type) => {
    const icons = { email: "📧", whatsapp: "💬", sms: "📱" };
    return icons[type] || "📬";
  };

  const filteredTemplates = filterType
    ? templates.filter((t) => t.type === filterType)
    : templates;

  if (showBuilder) {
    return (
      <div className="templates-container">
        <div style={{ marginBottom: "20px" }}>
          <button
            className="btn-secondary"
            onClick={() => {
              setShowBuilder(false);
              setSelectedTemplate(null);
            }}
            style={{ marginBottom: "20px" }}
          >
            ← Back to Templates
          </button>
        </div>
        <TemplateBuilder
          onSave={handleSaveTemplate}
          initialTemplate={selectedTemplate}
          isLoading={isLoading}
        />
      </div>
    );
  }

  return (
    <div className="templates-container">
      <div className="templates-header">
        <h1>Email & Message Templates</h1>
        <button
          className="btn-primary"
          onClick={() => {
            setSelectedTemplate(null);
            setShowBuilder(true);
          }}
        >
          + Create Template
        </button>
      </div>

      <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
        <button
          className={`btn-small ${!filterType ? "active" : ""}`}
          onClick={() => {
            setFilterType("");
            fetchTemplates();
          }}
        >
          All Types
        </button>
        <button
          className={`btn-small ${filterType === "email" ? "active" : ""}`}
          onClick={() => setFilterType("email")}
        >
          📧 Email
        </button>
        <button
          className={`btn-small ${filterType === "whatsapp" ? "active" : ""}`}
          onClick={() => setFilterType("whatsapp")}
        >
          💬 WhatsApp
        </button>
        <button
          className={`btn-small ${filterType === "sms" ? "active" : ""}`}
          onClick={() => setFilterType("sms")}
        >
          📱 SMS
        </button>
      </div>

      {isLoading && <p style={{ textAlign: "center" }}>Loading...</p>}

      {!isLoading && filteredTemplates.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            background: "#f9f9f9",
            borderRadius: "8px",
          }}
        >
          <p style={{ color: "#666", marginBottom: "20px" }}>No templates yet</p>
          <button
            className="btn-primary"
            onClick={() => {
              setSelectedTemplate(null);
              setShowBuilder(true);
            }}
          >
            Create Your First Template
          </button>
        </div>
      ) : (
        <div className="templates-list">
          {filteredTemplates.map((template) => (
            <div key={template._id} className="template-card">
              <div className="template-card-header">
                <h3 className="template-card-title">{template.name}</h3>
                <span className="template-type-badge">
                  {getTypeIcon(template.type)} {template.type.toUpperCase()}
                </span>
              </div>

              {template.description && (
                <p className="template-card-description">{template.description}</p>
              )}

              {template.variables.length > 0 && (
                <div style={{ marginBottom: "10px" }}>
                  <small style={{ color: "#666" }}>
                    Variables: {template.variables.join(", ")}
                  </small>
                </div>
              )}

              <div className="template-card-meta">
                <div style={{ fontSize: "12px", color: "#999" }}>
                  {new Date(template.createdAt).toLocaleDateString()}
                </div>
                <div className="template-card-actions">
                  <button
                    className="btn-small"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setShowBuilder(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn-small"
                    onClick={() => handleDuplicateTemplate(template._id)}
                  >
                    Duplicate
                  </button>
                  <button
                    className="btn-small"
                    style={{ background: "#ffebee", color: "#d32f2f" }}
                    onClick={() => handleDeleteTemplate(template._id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TemplatesPage;
