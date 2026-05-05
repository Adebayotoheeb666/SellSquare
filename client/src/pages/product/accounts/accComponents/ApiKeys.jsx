import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import { selectLoggedInBusinessOwner } from "../../../../redux/features/auth/authSlice";
import marketplaceService from "../../../../services/marketplaceService";

const AVAILABLE_SCOPES = [
  "listings:read",
  "orders:read",
  "orders:write",
  "events:read",
];

const parseDomains = (value) =>
  String(value || "")
    .split(/[\n,]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

const toDomainsText = (allowlistedDomains = []) =>
  (Array.isArray(allowlistedDomains) ? allowlistedDomains : [])
    .map((entry) => (typeof entry === "string" ? entry : entry?.domain || ""))
    .filter(Boolean)
    .join("\n");

const formatCreatedAt = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

export default function ApiKeys() {
  const isBusinessOwner = useSelector(selectLoggedInBusinessOwner);
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState(AVAILABLE_SCOPES);
  const [allowedOriginsText, setAllowedOriginsText] = useState("");
  const [rateLimitPerMinute, setRateLimitPerMinute] = useState("120");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [actioningKeyId, setActioningKeyId] = useState("");
  const [editingKeyId, setEditingKeyId] = useState("");
  const [editForm, setEditForm] = useState(null);
  const [credentials, setCredentials] = useState([]);
  const [webhookEndpoints, setWebhookEndpoints] = useState([]);
  const [secretNotice, setSecretNotice] = useState(null);
  const [webhookName, setWebhookName] = useState("Nino Webhook");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEnvironment, setWebhookEnvironment] = useState("production");
  const [webhookEventsText, setWebhookEventsText] = useState("marketplace.*");
  const [activeWebhookId, setActiveWebhookId] = useState("");
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);

  const selectedScopesCount = useMemo(() => selectedScopes.length, [selectedScopes]);

  const loadKeys = async () => {
    try {
      setIsLoadingList(true);
      const response = await marketplaceService.listMarketplaceApiKeys();
      setCredentials(Array.isArray(response?.credentials) ? response.credentials : []);
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to load API keys";
      toast.error(message);
    } finally {
      setIsLoadingList(false);
    }
  };

  const loadWebhookEndpoints = async () => {
    try {
      const response = await marketplaceService.listWebhookEndpoints();
      const endpoints = Array.isArray(response?.endpoints) ? response.endpoints : [];
      setWebhookEndpoints(endpoints);

      const existingNinoEndpoint = endpoints.find((endpoint) => {
        const identity = String(endpoint?.endpointIdentity || "").toLowerCase();
        const name = String(endpoint?.name || "").toLowerCase();
        return identity.includes("nino") || name.includes("nino");
      });

      if (existingNinoEndpoint) {
        setActiveWebhookId(existingNinoEndpoint.id);
        setWebhookName(existingNinoEndpoint.name || "Nino Webhook");
        setWebhookUrl(existingNinoEndpoint.url || "");
        setWebhookEnvironment(existingNinoEndpoint.environment || "production");
        setWebhookEventsText(
          Array.isArray(existingNinoEndpoint.subscribedEvents)
            ? existingNinoEndpoint.subscribedEvents.join("\n")
            : "marketplace.*",
        );
      }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to load webhook endpoints";
      toast.error(message);
    }
  };

  useEffect(() => {
    if (isBusinessOwner) {
      loadKeys();
      loadWebhookEndpoints();
    }
  }, [isBusinessOwner]);

  const parseWebhookEvents = (value) => {
    const parsedEvents = String(value || "")
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (parsedEvents.length === 0) {
      return ["marketplace.*"];
    }

    return parsedEvents;
  };

  const toggleScope = (scope) => {
    setSelectedScopes((prev) => {
      if (prev.includes(scope)) {
        return prev.filter((entry) => entry !== scope);
      }
      return [...prev, scope];
    });
  };

  const handleGenerate = async (event) => {
    event.preventDefault();

    if (!isBusinessOwner) {
      toast.error("Only the business owner can generate API keys");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Key name is required");
      return;
    }

    const domains = parseDomains(allowedOriginsText);
    const perMinute = Number(rateLimitPerMinute);

    if (selectedScopes.length === 0) {
      toast.error("Select at least one scope");
      return;
    }

    if (!Number.isFinite(perMinute) || perMinute < 1) {
      toast.error("Rate limit per minute must be at least 1");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await marketplaceService.createMarketplaceApiKey({
        name: trimmedName,
        scopes: selectedScopes,
        allowlistedDomains: domains,
        rateLimit: {
          perMinute: Math.floor(perMinute),
        },
      });

      setSecretNotice({
        keyId: response?.credential?.keyId,
        secret: response?.secret,
        type: "created",
      });
      setName("");
      setSelectedScopes(AVAILABLE_SCOPES);
      setAllowedOriginsText("");
      setRateLimitPerMinute("120");
      await loadKeys();
      toast.success("API key generated successfully");
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to generate API key";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (key) => {
    setEditingKeyId(key.keyId);
    setEditForm({
      name: key.name || "",
      scopes: Array.isArray(key.scopes) && key.scopes.length > 0 ? key.scopes : [],
      allowedOriginsText: toDomainsText(key.allowlistedDomains),
      rateLimitPerMinute: String(key?.rateLimit?.perMinute || 120),
    });
  };

  const cancelEdit = () => {
    setEditingKeyId("");
    setEditForm(null);
  };

  const toggleEditScope = (scope) => {
    setEditForm((prev) => {
      const current = Array.isArray(prev?.scopes) ? prev.scopes : [];
      const nextScopes = current.includes(scope)
        ? current.filter((entry) => entry !== scope)
        : [...current, scope];

      return {
        ...prev,
        scopes: nextScopes,
      };
    });
  };

  const handleSaveSettings = async (keyId) => {
    const domains = parseDomains(editForm?.allowedOriginsText);
    const perMinute = Number(editForm?.rateLimitPerMinute);
    const scopes = Array.isArray(editForm?.scopes) ? editForm.scopes : [];

    if (!String(editForm?.name || "").trim()) {
      toast.error("Key name is required");
      return;
    }

    if (scopes.length === 0) {
      toast.error("Select at least one scope");
      return;
    }

    if (!Number.isFinite(perMinute) || perMinute < 1) {
      toast.error("Rate limit per minute must be at least 1");
      return;
    }

    try {
      setActioningKeyId(keyId);
      await marketplaceService.updateMarketplaceApiKey(keyId, {
        name: String(editForm?.name || "").trim(),
        scopes,
        allowlistedDomains: domains,
        rateLimit: {
          perMinute: Math.floor(perMinute),
        },
      });
      await loadKeys();
      cancelEdit();
      toast.success("API key settings updated");
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to update API key settings";
      toast.error(message);
    } finally {
      setActioningKeyId("");
    }
  };

  const handleRotate = async (keyId) => {
    try {
      setActioningKeyId(keyId);
      const response = await marketplaceService.rotateMarketplaceApiKey(keyId);
      setSecretNotice({
        keyId: response?.keyId,
        secret: response?.secret,
        type: "rotated",
      });
      await loadKeys();
      toast.success("API key secret rotated successfully");
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to rotate API key secret";
      toast.error(message);
    } finally {
      setActioningKeyId("");
    }
  };

  const copySecret = async () => {
    if (!secretNotice?.secret) return;

    try {
      await navigator.clipboard.writeText(secretNotice.secret);
      toast.success("Secret copied");
    } catch (error) {
      toast.error("Failed to copy secret");
    }
  };

  const handleRevoke = async (keyId) => {
    try {
      setActioningKeyId(keyId);
      await marketplaceService.revokeMarketplaceApiKey(keyId);
      await loadKeys();
      toast.success("API key revoked successfully");
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to revoke API key";
      toast.error(message);
    } finally {
      setActioningKeyId("");
    }
  };

  const handleSaveNinoWebhook = async (event) => {
    event.preventDefault();

    const trimmedName = String(webhookName || "").trim();
    const trimmedUrl = String(webhookUrl || "").trim();
    const subscribedEvents = parseWebhookEvents(webhookEventsText);

    if (!trimmedName) {
      toast.error("Webhook name is required");
      return;
    }

    if (!trimmedUrl) {
      toast.error("Webhook URL is required");
      return;
    }

    try {
      setIsSavingWebhook(true);
      if (activeWebhookId) {
        await marketplaceService.updateWebhookEndpoint(activeWebhookId, {
          name: trimmedName,
          url: trimmedUrl,
          environment: webhookEnvironment,
          endpointIdentity: "nino",
          subscribedEvents,
          status: "active",
        });
        toast.success("Nino webhook updated");
      } else {
        const response = await marketplaceService.createWebhookEndpoint({
          name: trimmedName,
          url: trimmedUrl,
          environment: webhookEnvironment,
          endpointIdentity: "nino",
          subscribedEvents,
        });

        setActiveWebhookId(response?.endpoint?.id || "");
        if (response?.secret) {
          setSecretNotice({
            keyId: response?.endpoint?.providerEndpointId || response?.endpoint?.id,
            secret: response.secret,
            type: "webhook",
          });
        }

        toast.success("Nino webhook registered");
      }

      await loadWebhookEndpoints();
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to save Nino webhook";
      toast.error(message);
    } finally {
      setIsSavingWebhook(false);
    }
  };

  if (!isBusinessOwner) {
    return (
      <div className="api-keys-container">
        <h3>Access Restricted</h3>
        <p className="api-keys-note">
          Only the business owner (admin) can access API key management.
        </p>
      </div>
    );
  }

  return (
    <div className="api-keys-container">
      <h3>API Keys</h3>
      <p className="api-keys-note">
        Manage API credentials for your business in one place: scopes, allowed
        origins, rate limits, rotation and revocation.
      </p>
      <div className="api-keys-warning">
        <strong>Important:</strong> Secret values are shown exactly once after
        create/rotate and cannot be viewed again. Store them in your secure
        vault before clearing this screen.
      </div>

      <div className="api-keys-toolbar">
        <button
          type="button"
          className="api-keys-refresh-btn"
          onClick={loadKeys}
          disabled={isLoadingList}
        >
          {isLoadingList ? "Loading..." : "Refresh Keys"}
        </button>
      </div>

      <form className="api-keys-form" onSubmit={handleGenerate}>
        <label htmlFor="apiKeyName">Key Name</label>
        <input
          id="apiKeyName"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Mobile app integration"
        />

        <label>Scopes ({selectedScopesCount} selected)</label>
        <div className="api-keys-scopes">
          {AVAILABLE_SCOPES.map((scope) => (
            <label key={scope} className="api-keys-scope-item">
              <input
                type="checkbox"
                checked={selectedScopes.includes(scope)}
                onChange={() => toggleScope(scope)}
              />
              <span>{scope}</span>
            </label>
          ))}
        </div>

        <label htmlFor="apiKeyOrigins">Allowed Origins (one domain per line)</label>
        <textarea
          id="apiKeyOrigins"
          value={allowedOriginsText}
          onChange={(event) => setAllowedOriginsText(event.target.value)}
          placeholder="example.com&#10;api.partner.com"
          rows={4}
        />

        <label htmlFor="apiRateLimit">Rate Limit (requests/minute)</label>
        <input
          id="apiRateLimit"
          type="number"
          min="1"
          value={rateLimitPerMinute}
          onChange={(event) => setRateLimitPerMinute(event.target.value)}
        />

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Generating..." : "Generate API Key"}
        </button>
      </form>

      {secretNotice?.secret && (
        <div className="api-keys-result">
          <h4>
            Secret {secretNotice.type === "rotated" ? "Rotated" : "Generated"} - Save Now
          </h4>
          <p>
            <strong>Key ID:</strong> {secretNotice?.keyId}
          </p>
          <p>
            <strong>Secret:</strong> {secretNotice.secret}
          </p>
          <div className="api-keys-secret-actions">
            <button type="button" onClick={copySecret}>Copy Secret</button>
            <button type="button" onClick={() => setSecretNotice(null)}>
              Clear from Screen
            </button>
          </div>
        </div>
      )}

      <div className="api-keys-list">
        <h4>Saved API Keys</h4>
        {credentials.length === 0 ? (
          <p className="api-keys-empty">No API keys found. Click Refresh Keys to load.</p>
        ) : (
          <div className="api-keys-table-wrap">
            <table className="api-keys-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Key ID</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((key) => {
                  const disabled = actioningKeyId === key.keyId;
                  const isRevoked = key.status === "revoked";
                  const isEditing = editingKeyId === key.keyId;

                  return (
                    <React.Fragment key={key.keyId}>
                      <tr>
                        <td>{key.name || "-"}</td>
                        <td className="api-keys-nowrap">{key.keyId}</td>
                        <td>{key.status}</td>
                        <td className="api-keys-nowrap">
                          {formatCreatedAt(key.createdAt)}
                        </td>
                        <td className="api-keys-nowrap">
                          <div className="api-keys-actions">
                            <button
                              type="button"
                              title="Rotate secret"
                              aria-label="Rotate secret"
                              className="api-keys-icon-btn"
                              disabled={disabled || isRevoked}
                              onClick={() => handleRotate(key.keyId)}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M20 4V9H15"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M4 20V15H9"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M6.5 9C7.3 6.7 9.5 5 12 5C14.1 5 16 6.1 17.1 7.7L20 9"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M17.5 15C16.7 17.3 14.5 19 12 19C9.9 19 8 17.9 6.9 16.3L4 15"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="revoke-btn api-keys-icon-btn"
                              title="Revoke key"
                              aria-label="Revoke key"
                              disabled={disabled || isRevoked}
                              onClick={() => handleRevoke(key.keyId)}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path d="M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                <path d="M6 6L18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              title="Edit key settings"
                              aria-label="Edit key settings"
                              className="api-keys-icon-btn"
                              disabled={disabled || isRevoked}
                              onClick={() => startEdit(key)}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path d="M4 20H8L18 10L14 6L4 16V20Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M13 7L17 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isEditing && editForm && (
                        <tr>
                          <td colSpan={5}>
                            <div className="api-keys-edit-panel">
                              <label>Key Name</label>
                              <input
                                type="text"
                                value={editForm.name}
                                onChange={(event) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    name: event.target.value,
                                  }))
                                }
                              />

                              <label>Scopes</label>
                              <div className="api-keys-scopes">
                                {AVAILABLE_SCOPES.map((scope) => (
                                  <label key={scope} className="api-keys-scope-item">
                                    <input
                                      type="checkbox"
                                      checked={editForm.scopes.includes(scope)}
                                      onChange={() => toggleEditScope(scope)}
                                    />
                                    <span>{scope}</span>
                                  </label>
                                ))}
                              </div>

                              <label>Allowed Origins</label>
                              <textarea
                                rows={3}
                                value={editForm.allowedOriginsText}
                                onChange={(event) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    allowedOriginsText: event.target.value,
                                  }))
                                }
                              />

                              <label>Rate Limit (requests/minute)</label>
                              <input
                                type="number"
                                min="1"
                                value={editForm.rateLimitPerMinute}
                                onChange={(event) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    rateLimitPerMinute: event.target.value,
                                  }))
                                }
                              />

                              <div className="api-keys-edit-actions">
                                <button
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => handleSaveSettings(key.keyId)}
                                >
                                  Save Settings
                                </button>
                                <button type="button" onClick={cancelEdit}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="api-keys-list">
        <h4>Webhook Registration</h4>
        <p className="api-keys-note">
          Register the webhook callback URL to receive marketplace realtime order updates.
        </p>

        <form className="api-keys-form api-keys-webhook-form" onSubmit={handleSaveNinoWebhook}>
          <label htmlFor="ninoWebhookName">Webhook Name</label>
          <input
            id="ninoWebhookName"
            type="text"
            value={webhookName}
            onChange={(event) => setWebhookName(event.target.value)}
            placeholder="Webhook"
          />

          <label htmlFor="ninoWebhookUrl">Webhook URL</label>
          <input
            id="ninoWebhookUrl"
            type="url"
            value={webhookUrl}
            onChange={(event) => setWebhookUrl(event.target.value)}
            placeholder="https://nino.example.com/webhooks/orders"
          />

          <label htmlFor="ninoWebhookEnvironment">Environment</label>
          <select
            id="ninoWebhookEnvironment"
            value={webhookEnvironment}
            onChange={(event) => setWebhookEnvironment(event.target.value)}
          >
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
          </select>

          <label htmlFor="ninoWebhookEvents">Subscribed Events (one per line)</label>
          <textarea
            id="ninoWebhookEvents"
            rows={4}
            value={webhookEventsText}
            onChange={(event) => setWebhookEventsText(event.target.value)}
            placeholder="marketplace.order.payment_confirmed&#10;marketplace.order.line.updated"
          />

          <button type="submit" disabled={isSavingWebhook}>
            {isSavingWebhook
              ? "Saving..."
              : activeWebhookId
                ? "Update Webhook"
                : "Register Webhook"}
          </button>
        </form>

        {webhookEndpoints.length > 0 ? (
          <div className="api-keys-table-wrap">
            <table className="api-keys-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>URL</th>
                  <th>Environment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {webhookEndpoints.map((endpoint) => (
                  <tr key={endpoint.id}>
                    <td>{endpoint.name || "-"}</td>
                    <td>{endpoint.url || "-"}</td>
                    <td>{endpoint.environment || "production"}</td>
                    <td>{endpoint.status || "active"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="api-keys-empty">No webhook endpoints registered yet.</p>
        )}
      </div>
    </div>
  );
}
