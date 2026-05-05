import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { isSuperAdminEmail } from "../../../../utils/superAdmin";
import {
  selectBusiness,
  selectConnectedStores,
  selectLoggedInBusinessOwner,
  SET_LOGIN,
  SET_NAME,
  SET_USER,
  SET_BUSINESS,
  SET_CONNECTED_STORES,
} from "../../../../redux/features/auth/authSlice";
import {
  getConnectedStores,
  connectStore,
  registerAndConnectStore,
  switchBusinessStore,
  disconnectStore,
  getBusiness,
} from "../../../../services/authService";
import { useAsyncToast } from "../../../../customHook/useAsyncToast";
import "./manageStores.css";

// ─── Icons ────────────────────────────────────────
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M8 3v10M3 8h10" />
  </svg>
);

const LinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M6.5 9.5a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5l-1 1" />
    <path d="M9.5 6.5a3.5 3.5 0 00-5 0l-2 2a3.5 3.5 0 005 5l1-1" />
  </svg>
);

const SwitchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 1l2.5 2.5L10 6" />
    <path d="M1.5 6V5a2 2 0 012-2H12.5" />
    <path d="M4 13L1.5 10.5 4 8" />
    <path d="M12.5 8V9a2 2 0 01-2 2H1.5" />
  </svg>
);

const DisconnectIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M2 2l10 10" />
    <path d="M8 3.5h2a2.5 2.5 0 010 5H9" />
    <path d="M6 10.5H4a2.5 2.5 0 010-5h1" />
  </svg>
);

const StoreIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <path d="M9 22V12h6v10" />
  </svg>
);

const LockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

// ─── Component ────────────────────────────────────
export default function ManageStores() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const currentUser = useSelector((state) => state.auth);
  const business = useSelector(selectBusiness);
  const connectedStores = useSelector(selectConnectedStores);
  const isBusinessOwner = useSelector(selectLoggedInBusinessOwner);
  const isSuperAdmin = isSuperAdminEmail(currentUser?.user?.email);
  const { executeWithToast } = useAsyncToast();

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connectForm, setConnectForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    businessName: "",
    businessEmail: "",
    businessAddress: "",
    businessPhone: "",
    industry: "",
    country: "",
  });

  useEffect(() => {
    // Load stores for both owners and staff with assigned branches
    if (isBusinessOwner || currentUser?.user?.salesLoggedIn) {
      loadConnectedStores();
    }
  }, [isBusinessOwner, currentUser?.user?.salesLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadConnectedStores = async () => {
    try {
      const data = await getConnectedStores();
      if (data?.connectedStores) {
        dispatch(SET_CONNECTED_STORES(data.connectedStores));
      }
    } catch {
      // Silently fail
    }
  };

  // ─── Handlers ─────────────────────────────
  const handleConnectStore = async (e) => {
    e.preventDefault();
    if (!connectForm.email || !connectForm.password) {
      return toast.error("Please fill in all fields");
    }
    setLoading(true);
    try {
      await executeWithToast(
        (async () => {
          const data = await connectStore(connectForm);
          if (data?.connectedStores) {
            dispatch(SET_CONNECTED_STORES(data.connectedStores));
          }
          setShowConnectModal(false);
          setConnectForm({ email: "", password: "" });
        })(),
        {
          loading: "Connecting store...",
          success: "Store connected successfully!",
          error: (err) => err?.message || "Failed to connect store.",
        }
      );
    } catch {
      // handled by toast
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterStore = async (e) => {
    e.preventDefault();
    if (!registerForm.businessName || !registerForm.businessEmail) {
      return toast.error("Business name and email are required");
    }
    setLoading(true);
    try {
      await executeWithToast(
        (async () => {
          const data = await registerAndConnectStore(registerForm);
          if (data?.connectedStores) {
            dispatch(SET_CONNECTED_STORES(data.connectedStores));
          }
          setShowRegisterModal(false);
          setRegisterForm({
            businessName: "",
            businessEmail: "",
            businessAddress: "",
            businessPhone: "",
            industry: "",
            country: "",
          });
        })(),
        {
          loading: "Creating new branch...",
          success: "New branch created and connected!",
          error: (err) => err?.message || "Failed to create branch.",
        }
      );
    } catch {
      // handled by toast
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchBusiness = async (businessId) => {
    const storeName =
      connectedStores.find((s) => s._id === businessId)?.businessName || "business";
    setLoading(true);
    try {
      await executeWithToast(
        (async () => {
          const data = await switchBusinessStore(businessId);
          // Update all auth state with the new business context
          dispatch(SET_LOGIN(true));
          dispatch(SET_NAME(data.businessName));
          dispatch(SET_USER(data));
          if (data.connectedStores) {
            dispatch(SET_CONNECTED_STORES(data.connectedStores));
          }
          // Fetch the full business object for the new context
          const businessData = await getBusiness();
          if (businessData) {
            dispatch(SET_BUSINESS(businessData));
          }
          // Navigate to dashboard; the bootstrap scope watcher will
          // detect the changed business._id and re-bootstrap all data
          navigate("/dashboard");
        })(),
        {
          loading: `Switching to ${storeName}...`,
          success: `Switched to ${storeName}`,
          error: (err) => err?.message || "Failed to switch business.",
        }
      );
    } catch {
      // handled by toast
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectStore = async (businessId, businessName) => {
    if (!window.confirm(`Disconnect "${businessName}"? You can re-connect later.`)) return;
    setLoading(true);
    try {
      await executeWithToast(
        (async () => {
          const data = await disconnectStore(businessId);
          if (data?.connectedStores) {
            dispatch(SET_CONNECTED_STORES(data.connectedStores));
          }
        })(),
        {
          loading: "Disconnecting...",
          success: "Store disconnected.",
          error: (err) => err?.message || "Failed to disconnect store.",
        }
      );
    } catch {
      // handled by toast
    } finally {
      setLoading(false);
    }
  };

  // ─── Check if staff has assigned branches ─────────
  const hasAssignedBranches =
    currentUser?.user?.salesLoggedIn &&
    connectedStores &&
    connectedStores.length > 0;

  // ─── Restricted view for non-owners without branches ─────────
  if (!isBusinessOwner && !hasAssignedBranches) {
    return (
      <div className="manage-stores ms-restricted">
        <div className="ms-restricted-icon"><LockIcon /></div>
        <h3>No Assigned Branches</h3>
        <p>You don't have any branches assigned yet. Contact your admin to get started.</p>
      </div>
    );
  }

  // ─── Main render ────────────────────────────
  return (
    <div className="manage-stores">
      {/* Header */}
      <div className="ms-header">
        <div className="ms-header-top">
          <div>
            <h2>Manage Stores</h2>
            <p className="ms-header-subtitle">
              {isBusinessOwner
                ? "Connect and manage your business branches from one place"
                : "Switch between your assigned branches"}
            </p>
          </div>
          {isSuperAdmin && <Link to="/admin" className="ms-admin-link">Admin</Link>}
        </div>
      </div>

      {/* Current Business Hero */}
      <div className="ms-current">
        <p className="ms-current-label">Current Store</p>
        <div className="ms-current-content">
          <img
            src={business?.photo || "https://i.ibb.co/4pDNDk1/avatar.png"}
            alt={business?.businessName}
            className="ms-current-avatar"
          />
          <div className="ms-current-info">
            <h3>{business?.businessName}</h3>
            <p>{business?.businessEmail}</p>
            <div className="ms-current-tags">
              {business?.industry && <span className="ms-tag">{business.industry}</span>}
              {business?.country && <span className="ms-tag">{business.country}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons - only show for owners */}
      {isBusinessOwner && (
        <div className="ms-actions">
          <button
            className="ms-action-btn primary"
            onClick={() => setShowRegisterModal(true)}
            disabled={loading}
          >
            <PlusIcon /> New Branch
          </button>
          <button
            className="ms-action-btn secondary"
            onClick={() => setShowConnectModal(true)}
            disabled={loading}
          >
            <LinkIcon /> Connect Existing
          </button>
        </div>
      )}

      {/* Connected Stores */}
      {connectedStores.length > 0 ? (
        <>
          <h4 className="ms-section-title">
            Connected Stores ({connectedStores.length})
          </h4>
          <div className="ms-stores-grid">
            {connectedStores.map((store) => (
              <div key={store._id} className="ms-store-card">
                <div className="ms-store-card-top">
                  <img
                    src={store.photo || "https://i.ibb.co/4pDNDk1/avatar.png"}
                    alt={store.businessName}
                    className="ms-store-avatar"
                  />
                  <div className="ms-store-info">
                    <h4>{store.businessName}</h4>
                    <p>{store.businessEmail}</p>
                    <div className="ms-store-tags">
                      {store.industry && <span className="ms-store-tag">{store.industry}</span>}
                      {store.country && <span className="ms-store-tag">{store.country}</span>}
                    </div>
                  </div>
                </div>
                <div className="ms-store-actions">
                  <button
                    className="ms-switch-btn"
                    onClick={() => handleSwitchBusiness(store._id)}
                    disabled={loading}
                  >
                    <SwitchIcon /> Switch
                  </button>
                  {isBusinessOwner && (
                    <button
                      className="ms-disconnect-btn"
                      onClick={() => handleDisconnectStore(store._id, store.businessName)}
                      disabled={loading}
                      title="Disconnect"
                    >
                      <DisconnectIcon />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="ms-empty">
          <div className="ms-empty-icon"><StoreIcon /></div>
          <p>No connected stores yet.<br />Create a branch or connect an existing business to get started.</p>
        </div>
      )}

      {/* ─── Connect Modal ─────────────────── */}
      {showConnectModal && (
        <div className="ms-modal-overlay" onClick={() => setShowConnectModal(false)}>
          <div className="ms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ms-modal-header">
              <h3>Connect Existing Business</h3>
              <button className="ms-modal-close" onClick={() => setShowConnectModal(false)}>
                &times;
              </button>
            </div>
            <p className="ms-modal-desc">
              Enter the admin email (or business email) and password of the business you want to connect.
            </p>
            <form onSubmit={handleConnectStore}>
              <div className="ms-modal-body">
                <div className="ms-field">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="admin@business.com"
                    value={connectForm.email}
                    onChange={(e) => setConnectForm({ ...connectForm, email: e.target.value })}
                    required
                  />
                </div>
                <div className="ms-field">
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="Admin password"
                    value={connectForm.password}
                    onChange={(e) => setConnectForm({ ...connectForm, password: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="ms-modal-footer">
                <button type="button" className="ms-btn ms-btn-cancel" onClick={() => setShowConnectModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="ms-btn ms-btn-confirm" disabled={loading}>
                  {loading ? "Connecting..." : "Connect"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Register Modal ────────────────── */}
      {showRegisterModal && (
        <div className="ms-modal-overlay" onClick={() => setShowRegisterModal(false)}>
          <div className="ms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ms-modal-header">
              <h3>Create New Branch</h3>
              <button className="ms-modal-close" onClick={() => setShowRegisterModal(false)}>
                &times;
              </button>
            </div>
            <p className="ms-modal-desc">
              Set up a new business branch. You'll be set as the admin automatically.
            </p>
            <form onSubmit={handleRegisterStore}>
              <div className="ms-modal-body">
                <div className="ms-field">
                  <label>Business Name *</label>
                  <input
                    type="text"
                    placeholder="Branch name"
                    value={registerForm.businessName}
                    onChange={(e) => setRegisterForm({ ...registerForm, businessName: e.target.value })}
                    required
                  />
                </div>
                <div className="ms-field">
                  <label>Business Email *</label>
                  <input
                    type="email"
                    placeholder="branch@business.com"
                    value={registerForm.businessEmail}
                    onChange={(e) => setRegisterForm({ ...registerForm, businessEmail: e.target.value })}
                    required
                  />
                </div>
                <div className="ms-form-row">
                  <div className="ms-field">
                    <label>Address</label>
                    <input
                      type="text"
                      placeholder="Branch address"
                      value={registerForm.businessAddress}
                      onChange={(e) => setRegisterForm({ ...registerForm, businessAddress: e.target.value })}
                    />
                  </div>
                  <div className="ms-field">
                    <label>Phone</label>
                    <input
                      type="text"
                      placeholder="Phone number"
                      value={registerForm.businessPhone}
                      onChange={(e) => setRegisterForm({ ...registerForm, businessPhone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="ms-form-row">
                  <div className="ms-field">
                    <label>Industry</label>
                    <input
                      type="text"
                      placeholder="Industry"
                      value={registerForm.industry}
                      onChange={(e) => setRegisterForm({ ...registerForm, industry: e.target.value })}
                    />
                  </div>
                  <div className="ms-field">
                    <label>Country</label>
                    <input
                      type="text"
                      placeholder="Country"
                      value={registerForm.country}
                      onChange={(e) => setRegisterForm({ ...registerForm, country: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="ms-modal-footer">
                <button type="button" className="ms-btn ms-btn-cancel" onClick={() => setShowRegisterModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="ms-btn ms-btn-confirm" disabled={loading}>
                  {loading ? "Creating..." : "Create Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
