import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  updateSubscriptionPlan,
  sendAdminBusinessMessage as sendAdminBusinessMessageApi,
} from "../../../services/authService";
import {
  connectTikTok as connectTikTokApi,
  disconnectTikTok as disconnectTikTokApi,
  connectInstagram as connectInstagramApi,
  disconnectInstagram as disconnectInstagramApi,
  getIntegrationSettings as getIntegrationSettingsApi,
} from "../../../services/integrationService";
import {
  fetchIntegrationSettings,
  connectTikTokIntegration,
  disconnectTikTokIntegration,
  connectInstagramIntegration,
  disconnectInstagramIntegration,
  selectIntegrationSettings,
  selectIntegrationConnecting,
  selectIntegrationError,
} from "../../../redux/features/integration/integrationSlice";
import {
  fetchAutomationStatus,
  fetchJobStatus,
  fetchContentIdeas,
  selectAutomationStatus,
  selectJobStatus,
  selectContentIdeas,
  selectAutomationLoading,
  selectAutomationError,
} from "../../../redux/features/automation/automationSlice";
import {
  updateApplicationStatus as updateApplicationStatusApi,
  sendBrief,
  sendFollowUpEmail,
} from "../../../services/applicationService";
import { useAsyncToast } from "../../../customHook/useAsyncToast";
import { Helmet } from 'react-helmet';
import moment from "moment";
import { useDispatch, useSelector } from "react-redux";
import AutomationTab from "./components/AutomationTab";
import {
  fetchAdminBusinesses,
  fetchAdminApplications,
  selectAdminBusinesses,
  selectAdminApplications,
  selectAdminLoadingBusinesses,
  selectAdminLoadingApplications,
  updateBusinessInList,
} from "../../../redux/features/admin/adminSlice";
import { useCachedFetch } from "../../../customHook/useCachedFetch";
import { BOOTSTRAP_DATA } from "../../../redux/features/dataCache/dataCacheSlice";
import BusinessSetupVerification from "./BusinessSetupVerification";
import EscrowManagementTab from "./components/EscrowManagementTab";


import "./admin.css";


const Admin = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const businesses = useSelector(selectAdminBusinesses);
  const applications = useSelector(selectAdminApplications);
  const isLoadingBusinesses = useSelector(selectAdminLoadingBusinesses);
  const isLoadingApplications = useSelector(selectAdminLoadingApplications);
  // Search and debounce logic
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const debounceTimeout = useRef();
  // Update debounced value and URL param only after debounce
  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      // Update URL param after debounce
      const params = new URLSearchParams(location.search);
      if (searchTerm) {
        params.set("search", searchTerm);
      } else {
        params.delete("search");
      }
      navigate(`?${params.toString()}`);
    }, 500);
    return () => clearTimeout(debounceTimeout.current);
  }, [searchTerm, location.search, navigate]);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingBusiness, setEditingBusiness] = useState(null);
  const [subscriptionType, setSubscriptionType] = useState("");
  const [plan, setPlan] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const businessesPerPage = 10;
  const { executeWithToast } = useAsyncToast();
  const isLoading = isLoadingBusinesses;
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [platformMetrics, setPlatformMetrics] = useState(null);
  const [activityFilter, setActivityFilter] = useState(7); // days
  const [showActivityDropdown, setShowActivityDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState("businesses");
  const [briefForm, setBriefForm] = useState({ id: null, instructions: "", dueDate: "" });
  const [emailForm, setEmailForm] = useState({ id: null, subject: "", message: "", attachments: [] });
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [collapsedBriefResponses, setCollapsedBriefResponses] = useState({});
  const [selectedBusinessIds, setSelectedBusinessIds] = useState(new Set());
  const [communicationRecipientType, setCommunicationRecipientType] = useState("owner");
  const [communicationForm, setCommunicationForm] = useState({
    purpose: "accountHealth",
    subject: "Action required on your SellSquare account",
    message:
      "Hello {{businessName}} team,\n\nWe noticed there are account updates that need your attention. Please review your store settings and reach out if you need support.\n\nRegards,\nSellSquare Admin",
    replyTo: "",
  });
  const [accountSearchTerm, setAccountSearchTerm] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");

  // Redux selectors for integration
  const integrationSettings = useSelector(selectIntegrationSettings);
  const connectingPlatform = useSelector(selectIntegrationConnecting);
  const integrationError = useSelector(selectIntegrationError);

  // Redux selectors for automation
  const automationStatus = useSelector(selectAutomationStatus);
  const jobStatus = useSelector(selectJobStatus);
  const contentIdeas = useSelector(selectContentIdeas);
  const automationLoading = useSelector(selectAutomationLoading);

  // File input ref for attachments
  const fileInputRef = useRef(null);
  const editFormRef = useRef(null);
  const activityDropdownRef = useRef(null);

  const communicationDefaults = useMemo(
    () => ({
      accountHealth: {
        label: "Account Health",
        subject: "Action required on your SellSquare account",
        message:
          "Hello {{businessName}} team,\n\nWe noticed there are account updates that need your attention. Please review your store settings and reach out if you need support.\n\nRegards,\nSellSquare Admin",
      },
      subscriptionReminder: {
        label: "Subscription Reminder",
        subject: "Subscription reminder for {{businessName}}",
        message:
          "Hello {{ownerName}},\n\nThis is a reminder that your current plan is {{plan}} and your due date is {{dueDate}}. Please renew before the due date to avoid service interruptions.\n\nRegards,\nSellSquare Admin",
      },
      policyUpdate: {
        label: "Policy Update",
        subject: "Important policy update from SellSquare",
        message:
          "Hello {{businessName}} team,\n\nWe have published an important policy update that affects store operations on the platform. Please review the updated guidance and contact us for clarification if needed.\n\nRegards,\nSellSquare Admin",
      },
      performanceNudge: {
        label: "Performance Nudge",
        subject: "Performance suggestions for {{businessName}}",
        message:
          "Hello {{ownerName}},\n\nWe reviewed your store activity and prepared recommendations that may improve your sales and catalog health. Reply to this email if you want a tailored optimization review.\n\nRegards,\nSellSquare Admin",
      },
      newAccountWelcome: {
        label: "New Account Welcome",
        subject: "Welcome to SellSquare, {{businessName}}",
        message:
          "Hello {{ownerName}},\n\nWelcome to SellSquare. Your business account has been successfully created and is now active.\n\nRecommended next steps:\n1. Complete your business profile details\n2. Add your first products\n3. Invite your sales team\n\nIf you need help, reply to this email and our team will assist you.\n\nRegards,\nSellSquare Admin",
      },
      custom: {
        label: "Custom",
        subject: "Message from SellSquare Admin",
        message:
          "Hello {{businessName}} team,\n\nWe wanted to share an update regarding your account.\n\nRegards,\nSellSquare Admin",
      },
    }),
    [],
  );

  useCachedFetch(BOOTSTRAP_DATA.ADMIN_BUSINESSES, fetchAdminBusinesses);

  useCachedFetch(BOOTSTRAP_DATA.ADMIN_APPLICATIONS, fetchAdminApplications, {
    enabled: activeTab === "applications",
  });

  // Recalculate active businesses when activity filter changes
  const metrics = useMemo(() => {
    if (!businesses || businesses.length === 0) return null;
    const activeBusinesses = businesses.filter((b) => {
      const lastActivity = [
        b.lastProductUpdate,
        b.lastCheckoutUpdate,
        b.lastProductGroupUpdate,
      ]
        .filter(Boolean)
        .map((date) => new Date(date))
        .sort((a, b) => b - a)[0];

      if (!lastActivity) return false;
      const daysSinceActivity =
        (new Date() - lastActivity) / (1000 * 60 * 60 * 24);
      return daysSinceActivity <= activityFilter;
    }).length;

    return {
      totalBusinesses: businesses.length,
      totalProducts: businesses.reduce((sum, b) => sum + (b.productCount || 0), 0),
      totalCheckouts: businesses.reduce((sum, b) => sum + (b.checkoutCount || 0), 0),
      totalProductGroups: businesses.reduce(
        (sum, b) => sum + (b.productGroupCount || 0),
        0
      ),
      totalRevenue: businesses.reduce(
        (sum, b) => sum + (b.totalRevenue || 0),
        0
      ),
      activeBusinesses,
    };
  }, [businesses, activityFilter]);

  useEffect(() => {
    setPlatformMetrics(metrics);
  }, [metrics]);

  // Sync search input with URL param on mount/location change
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get("search") || "";
    setSearchTerm(query);
    setDebouncedSearchTerm(query);
  }, [location.search]);

  // Only update searchTerm, debounce handles URL and filter
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const fillTemplateVariables = useCallback((value, business) => {
    if (!business) return value;
    const ownerName = `${business.businessOwner?.firstName || ""} ${
      business.businessOwner?.lastName || ""
    }`.trim();
    const dueDate = business.subscription?.nextDueDate
      ? moment(business.subscription.nextDueDate).format("MMM D, YYYY")
      : "N/A";

    const vars = {
      businessName: business.businessName || "Business",
      ownerName: ownerName || "Business Owner",
      plan: business.subscription?.plan || "N/A",
      dueDate,
    };

    return String(value || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
      return vars[key] != null ? String(vars[key]) : "";
    });
  }, []);

  const applyCommunicationTemplate = useCallback(
    (business, purpose) => {
      const selectedTemplate =
        communicationDefaults[purpose] || communicationDefaults.custom;

      return {
        subject: fillTemplateVariables(selectedTemplate.subject, business),
        message: fillTemplateVariables(selectedTemplate.message, business),
      };
    },
    [communicationDefaults, fillTemplateVariables],
  );

  useEffect(() => {
    function handleClickOutside(event) {
      if (editFormRef.current && !editFormRef.current.contains(event.target)) {
        setEditingBusiness(null);
      }

      // Close activity dropdown when clicking outside
      if (activityDropdownRef.current && !activityDropdownRef.current.contains(event.target)) {
        setShowActivityDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load integration settings when integration tab is active
  useEffect(() => {
    if (activeTab === "integration" && !integrationSettings) {
      dispatch(fetchIntegrationSettings());
    }
  }, [activeTab, integrationSettings, dispatch]);

  // Load automation status when automation tab is active
  useEffect(() => {
    if (activeTab === "automation") {
      dispatch(fetchAutomationStatus());
      dispatch(fetchJobStatus());
      dispatch(fetchContentIdeas({ status: "pending_approval" }));
    }
  }, [activeTab, dispatch]);

  const handleConnectTikTok = () => {
    dispatch(connectTikTokIntegration({
      monitoringEnabled: true,
      engagementEnabled: true,
      contentGenerationEnabled: true,
      contentApprovalRequired: true,
      postingFrequency: "daily",
    }));
  };

  const handleDisconnectTikTok = () => {
    dispatch(disconnectTikTokIntegration());
  };

  const handleConnectInstagram = () => {
    dispatch(connectInstagramIntegration({
      monitoringEnabled: true,
      engagementEnabled: true,
      contentGenerationEnabled: true,
      contentApprovalRequired: true,
      postingFrequency: "daily",
    }));
  };

  const handleDisconnectInstagram = () => {
    dispatch(disconnectInstagramIntegration());
  };

  const handleEditClick = (business) => {
    setEditingBusiness(business);
    setSubscriptionType(business.subscription.subscriptionType);
    setPlan(business.subscription.plan);
    setNextDueDate(
      moment(business.subscription.nextDueDate).format("YYYY-MM-DD")
    );
  };

  const handleUpdateSubscription = async (e) => {
    e.preventDefault();

    try {
      const updatedSubscription = {
        subscriptionType,
        plan,
        nextDueDate,
      };
      await executeWithToast(
        updateSubscriptionPlan(editingBusiness._id, updatedSubscription),
        {
          loading: "Updating subscription...",
          success: "Subscription updated successfully!",
          error: "Failed to update subscription. Please try again.",
        }
      );
      dispatch(
        updateBusinessInList({
          ...editingBusiness,
          subscription: updatedSubscription,
        })
      );
      setEditingBusiness(null);
    } catch (error) {
      console.error("Failed to update subscription:", error);
    }
  };

  const statusOptions = ["received", "reviewing", "interview", "rejected", "accepted"];

  /**
   * EVENT-DRIVEN ARCHITECTURE:
   * Applications are loaded via useCachedFetch (uses bootstrap cache).
   * After mutations (status updates, brief sending), we don't need to manually refresh.
   * The backend should emit WebSocket events that update the Redux cache automatically.
   * If backend doesn't emit events for applications, we can add them.
   * For now, keep manual refresh only after mutations until backend events are confirmed.
   */
  const handleRefreshApplications = useCallback(async () => {
    // Only refresh after explicit mutations, not on tab change
    try {
      await dispatch(fetchAdminApplications()).unwrap();
    } catch (error) {
      console.error("Failed to refresh applications", error);
    }
  }, [dispatch]);

  const handleStatusChange = async (applicationId, status) => {
    setStatusUpdatingId(applicationId);
    try {
      await updateApplicationStatusApi(applicationId, status);
      await handleRefreshApplications();
    } catch (error) {
      console.error("Failed to update status", error);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const openBriefForm = (app) => {
    setBriefForm({
      id: app._id,
      instructions: "Add any notes or constraints (optional)",
      dueDate: "",
    });
    setEmailForm({ id: null, subject: "", message: "" });
  };

  const submitBriefForm = async (e) => {
    e.preventDefault();
    if (!briefForm.id) return;

    await executeWithToast(sendBrief(briefForm.id, {
      instructions: briefForm.instructions,
      dueDate: briefForm.dueDate || undefined,
    }), {
      loading: "Sending brief...",
      success: "Brief sent",
      error: "Failed to send brief",
    });

    setBriefForm({ id: null, instructions: "", dueDate: "" });
    await handleRefreshApplications();
  };

  const openEmailForm = (app) => {
    setEmailForm({
      id: app._id,
      subject: `Next steps for ${app.position}`,
      message: "Hi, thanks for applying. Sharing a quick update...",
      attachments: [],
    });
    setBriefForm({ id: null, instructions: "", dueDate: "" });
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle file selection for email attachments
  const handleAttachmentChange = (e) => {
    const files = Array.from(e.target.files || []);

    // Validate file count
    if (files.length > 5) {
      alert("Maximum 5 attachments allowed");
      return;
    }

    // Validate file sizes (10MB max each)
    const invalidFiles = files.filter(f => f.size > 10 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      alert(`Some files exceed 10MB limit: ${invalidFiles.map(f => f.name).join(", ")}`);
      return;
    }

    setEmailForm({ ...emailForm, attachments: files });
  };

  // Remove a specific attachment
  const removeAttachment = (index) => {
    const newAttachments = [...emailForm.attachments];
    newAttachments.splice(index, 1);
    setEmailForm({ ...emailForm, attachments: newAttachments });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const submitEmailForm = async (e) => {
    e.preventDefault();
    if (!emailForm.id) return;

    await executeWithToast(sendFollowUpEmail(emailForm.id, {
      subject: emailForm.subject,
      message: emailForm.message,
      attachments: emailForm.attachments,
    }), {
      loading: emailForm.attachments.length > 0
        ? `Sending email with ${emailForm.attachments.length} attachment(s)...`
        : "Sending email...",
      success: emailForm.attachments.length > 0
        ? `Email sent with ${emailForm.attachments.length} attachment(s)`
        : "Email sent",
      error: "Failed to send email",
    });

    setEmailForm({ id: null, subject: "", message: "", attachments: [] });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatDate = (date) => (date ? moment(date).format("MMM D, YYYY") : "—");

  const openCommunicationComposer = (business, recipientType = "owner") => {
    setSelectedBusinessIds(new Set([business._id]));
    setCommunicationRecipientType(recipientType);
    const template = communicationDefaults.accountHealth;
    setCommunicationForm({
      purpose: "accountHealth",
      subject: template.subject,
      message: template.message,
      replyTo: "",
    });
    setActiveTab("communications");
  };

  const previewBusiness = useMemo(() => {
    if (!selectedBusinessIds.size || !businesses) return null;
    return businesses.find((b) => selectedBusinessIds.has(b._id)) || null;
  }, [businesses, selectedBusinessIds]);

  const previewSubject = useMemo(
    () => fillTemplateVariables(communicationForm.subject, previewBusiness),
    [fillTemplateVariables, communicationForm.subject, previewBusiness],
  );

  const previewMessage = useMemo(
    () => fillTemplateVariables(communicationForm.message, previewBusiness),
    [fillTemplateVariables, communicationForm.message, previewBusiness],
  );

  const previewRecipientEmail = useMemo(() => {
    if (!previewBusiness) return "";
    return communicationRecipientType === "business"
      ? previewBusiness.businessEmail || ""
      : previewBusiness.businessOwner?.email || "";
  }, [previewBusiness, communicationRecipientType]);

  const toggleBusinessSelection = useCallback((businessId) => {
    setSelectedBusinessIds((prev) => {
      const next = new Set(prev);
      if (next.has(businessId)) {
        next.delete(businessId);
      } else {
        next.add(businessId);
      }
      return next;
    });
  }, []);

  const handleCommunicationPurposeChange = (nextPurpose) => {
    const template = communicationDefaults[nextPurpose] || communicationDefaults.custom;
    setCommunicationForm((prev) => ({
      ...prev,
      purpose: nextPurpose,
      subject: template.subject,
      message: template.message,
    }));
  };

  const submitCommunicationForm = async (e) => {
    e.preventDefault();
    if (!selectedBusinessIds.size) return;

    await executeWithToast(
      sendAdminBusinessMessageApi({
        businessIds: Array.from(selectedBusinessIds),
        recipientType: communicationRecipientType,
        purpose: communicationForm.purpose,
        subject: communicationForm.subject,
        message: communicationForm.message,
        replyTo: communicationForm.replyTo || undefined,
      }),
      {
        loading: `Sending to ${selectedBusinessIds.size} business${selectedBusinessIds.size !== 1 ? "es" : ""}…`,
        success: `Message sent to ${selectedBusinessIds.size} business${selectedBusinessIds.size !== 1 ? "es" : ""}`,
        error: "Failed to send message",
      },
    );
  };

  const accountFilterOptions = useMemo(
    () => [
      { value: "all", label: "All Accounts" },
      { value: "newAccounts", label: "New Accounts" },
      { value: "activeAccounts", label: "Active Accounts" },
      { value: "inactiveAccounts", label: "Inactive Accounts" },
      { value: "expiringSoon", label: "Expiring Soon" },
      { value: "professionalPlan", label: "Professional Plan" },
      { value: "highRevenue", label: "High Revenue" },
    ],
    [],
  );

  const getLatestBusinessActivityTimestamp = useCallback((business) => {
    const activityDates = [
      business.lastProductUpdate,
      business.lastCheckoutUpdate,
      business.lastProductGroupUpdate,
    ]
      .filter(Boolean)
      .map((date) => new Date(date).getTime())
      .filter((date) => !Number.isNaN(date));

    if (!activityDates.length) return null;
    return Math.max(...activityDates);
  }, []);

  const communicationBusinesses = useMemo(() => {
    const normalizedSearch = accountSearchTerm.trim().toLowerCase();
    const now = Date.now();
    const dayMs = 1000 * 60 * 60 * 24;

    return (businesses || [])
      .filter((business) => {
        if (!normalizedSearch) return true;
        return [
          business.businessName,
          business.businessEmail,
          business.businessOwner?.email,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(normalizedSearch),
          );
      })
      .filter((business) => {
        if (accountFilter === "all") return true;

        const createdAt = business.createdAt
          ? new Date(business.createdAt).getTime()
          : null;
        const latestActivity = getLatestBusinessActivityTimestamp(business);
        const daysSinceLastActivity = latestActivity
          ? (now - latestActivity) / dayMs
          : Infinity;
        const dueAt = business.subscription?.nextDueDate
          ? new Date(business.subscription.nextDueDate).getTime()
          : null;
        const daysToDue = dueAt ? (dueAt - now) / dayMs : Infinity;

        switch (accountFilter) {
          case "newAccounts":
            return createdAt ? (now - createdAt) / dayMs <= 30 : false;
          case "activeAccounts":
            return daysSinceLastActivity <= 30;
          case "inactiveAccounts":
            return daysSinceLastActivity > 45;
          case "expiringSoon":
            return daysToDue >= 0 && daysToDue <= 14;
          case "professionalPlan":
            return (
              String(business.subscription?.plan || "").toLowerCase() ===
              "professional"
            );
          case "highRevenue":
            return Number(business.totalRevenue || 0) >= 500000;
          default:
            return true;
        }
      });
  }, [
    businesses,
    accountSearchTerm,
    accountFilter,
    getLatestBusinessActivityTimestamp,
  ]);

  const allFilteredSelected = useMemo(
    () =>
      communicationBusinesses.length > 0 &&
      communicationBusinesses.every((b) => selectedBusinessIds.has(b._id)),
    [communicationBusinesses, selectedBusinessIds],
  );

  const toggleSelectAllFiltered = useCallback(() => {
    if (allFilteredSelected) {
      setSelectedBusinessIds((prev) => {
        const next = new Set(prev);
        communicationBusinesses.forEach((b) => next.delete(b._id));
        return next;
      });
    } else {
      setSelectedBusinessIds((prev) => {
        const next = new Set(prev);
        communicationBusinesses.forEach((b) => next.add(b._id));
        return next;
      });
    }
  }, [allFilteredSelected, communicationBusinesses]);

  const openBusinessModal = (business, event) => {
    if (event) {
      event.stopPropagation();
    }
    setSelectedBusiness(business);
  };

  // Filtered businesses based on the search term
  const filteredBusinesses = businesses
    ?.filter((business) =>
      business.businessName.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    )
    .sort((a, b) => {
      // Get the most recent activity date for each business
      const getLatestActivity = (business) => {
        const dates = [
          business.lastProductUpdate,
          business.lastCheckoutUpdate,
          business.lastProductGroupUpdate
        ].filter(Boolean).map(date => new Date(date));

        return dates.length > 0 ? Math.max(...dates) : 0;
      };

      const aLatest = getLatestActivity(a);
      const bLatest = getLatestActivity(b);

      // Sort by most recent activity first (descending)
      return bLatest - aLatest;
    });

  // Get current businesses for pagination
  const indexOfLastBusiness = currentPage * businessesPerPage;
  const indexOfFirstBusiness = indexOfLastBusiness - businessesPerPage;
  const currentBusinesses = filteredBusinesses?.slice(
    indexOfFirstBusiness,
    indexOfLastBusiness
  );

  // Change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const format = "MMMM Do YYYY, h:mmA";

  // SVG Icon Components
  const BuildingIcon = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 21H21M5 21V7L13 3V21M19 21V11L13 7.5M9 9V9.01M9 12V12.01M9 15V15.01M9 18V18.01" stroke="var(--brand-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const PackageIcon = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 16V8C20.9996 7.64928 20.9071 7.30481 20.7315 7.00116C20.556 6.69751 20.3037 6.44536 20 6.27L13 2.27C12.696 2.09446 12.3511 2.00205 12 2.00205C11.6489 2.00205 11.304 2.09446 11 2.27L4 6.27C3.69626 6.44536 3.44398 6.69751 3.26846 7.00116C3.09294 7.30481 3.00036 7.64928 3 8V16C3.00036 16.3507 3.09294 16.6952 3.26846 16.9988C3.44398 17.3025 3.69626 17.5546 4 17.73L11 21.73C11.304 21.9055 11.6489 21.9979 12 21.9979C12.3511 21.9979 12.696 21.9055 13 21.73L20 17.73C20.3037 17.5546 20.556 17.3025 20.7315 16.9988C20.9071 16.6952 20.9996 16.3507 21 16Z" stroke="var(--brand-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.27002 6.96L12 12.01L20.73 6.96M12 22.08V12" stroke="var(--brand-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const CartIcon = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 2L7.17 4H2V6H3.18L5.68 15.39C5.88 16.03 6.47 16.5 7.14 16.5H18.86C19.53 16.5 20.12 16.03 20.32 15.39L22.82 6H7M7 18C5.9 18 5 18.9 5 20C5 21.1 5.9 22 7 22C8.1 22 9 21.1 9 20C9 18.9 8.1 18 7 18ZM17 18C15.9 18 15 18.9 15 20C15 21.1 15.9 22 17 22C18.1 22 19 21.1 19 20C19 18.9 18.1 18 17 18Z" fill="var(--brand-color)" />
    </svg>
  );

  const MoneyIcon = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13.41 18.09V20H10.74V18.07C9.03 17.71 7.58 16.61 7.5 14.67H9.77C9.84 15.69 10.5 16.49 12.19 16.49C13.55 16.49 14.61 15.79 14.61 14.61C14.61 13.55 13.88 12.93 12.34 12.49C10.39 11.93 8.33 11.21 8.33 8.93C8.33 7.16 9.58 5.95 10.74 5.54V3.5H13.41V5.47C15.16 5.88 16.15 7.25 16.21 8.88H13.94C13.9 7.82 13.34 7.09 12.19 7.09C11.11 7.09 10.31 7.68 10.31 8.77C10.31 9.75 11.03 10.26 12.53 10.68C14.48 11.23 16.59 12.03 16.59 14.5C16.58 16.31 15.31 17.68 13.41 18.09Z" fill="var(--brand-color)" />
    </svg>
  );

  const ChartIcon = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 3V21H21M7 16L12 11L15 14L20 9M20 9V13M20 9H16" stroke="var(--brand-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const CheckIcon = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="var(--brand-color)" strokeWidth="2" fill="none" />
      <path d="M8 12L11 15L16 9" stroke="var(--brand-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const getActivityFilterLabel = () => {
    if (activityFilter === 7) return '7 days';
    if (activityFilter === 30) return '1 month';
    if (activityFilter === 90) return '3 months';
    if (activityFilter === 180) return '6 months';
    return `${activityFilter} days`;
  };

  return (
    <div className="admin_page">
      {/* Loader removed - using toast notifications instead */}
      <Helmet>
        <title>Admin Dashboard | Sell Square - Business Management</title>
        <meta
          name="description"
          content="Admin dashboard for Sell Square platform. Manage all registered businesses, view metrics, update subscriptions, and monitor platform-wide activity."
        />
        <meta
          name="keywords"
          content="sell square admin, platform administration, business management, subscription management, admin dashboard"
        />
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:title" content="Admin Dashboard | Sell Square" />
        <meta
          property="og:description"
          content="Platform administration and business management dashboard."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.sellsquarehub.com/admin" />
        <meta
          property="og:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <link rel="canonical" href="https://www.sellsquarehub.com/admin" />
      </Helmet>
      <h1>Admin Dashboard</h1>

      <div className="admin_tabs">
        <button
          className={activeTab === "businesses" ? "active" : ""}
          onClick={() => setActiveTab("businesses")}
        >
          Businesses
        </button>
        <button
          className={activeTab === "applications" ? "active" : ""}
          onClick={() => setActiveTab("applications")}
        >
          Applications
        </button>
        <button
          className={activeTab === "automation" ? "active" : ""}
          onClick={() => setActiveTab("automation")}
        >
          Automation
        </button>
        <button
          className={activeTab === "integration" ? "active" : ""}
          onClick={() => setActiveTab("integration")}
        >
          Integration
        </button>
        <button
          className={activeTab === "communications" ? "active" : ""}
          onClick={() => setActiveTab("communications")}
        >
          Communications
        </button>
        <button
          className={activeTab === "escrow" ? "active" : ""}
          onClick={() => setActiveTab("escrow")}
        >
          Escrow Management
        </button>
        <button
          className={activeTab === "setup-verification" ? "active" : ""}
          onClick={() => setActiveTab("setup-verification")}
        >
          Business Setup Verification
        </button>
      </div>

      {activeTab === "businesses" && (
        <>
          {/* Platform Metrics Section */}
          {platformMetrics && (
            <div className="metrics_dashboard">
              <div className="metric_card">
                <div className="metric_icon">
                  <BuildingIcon />
                </div>
                <div className="metric_content">
                  <h3>{platformMetrics.totalBusinesses}</h3>
                  <p>Total Businesses</p>
                </div>
              </div>
              <div className="metric_card">
                <div className="metric_icon">
                  <PackageIcon />
                </div>
                <div className="metric_content">
                  <h3>{platformMetrics.totalProducts.toLocaleString()}</h3>
                  <p>Total Products</p>
                </div>
              </div>
              <div className="metric_card">
                <div className="metric_icon">
                  <CartIcon />
                </div>
                <div className="metric_content">
                  <h3>{platformMetrics.totalCheckouts.toLocaleString()}</h3>
                  <p>Total Checkouts</p>
                </div>
              </div>
              <div className="metric_card">
                <div className="metric_icon">
                  <MoneyIcon />
                </div>
                <div className="metric_content">
                  <h3>₦{platformMetrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
                  <p>Total Revenue</p>
                </div>
              </div>
              <div className="metric_card">
                <div className="metric_icon">
                  <ChartIcon />
                </div>
                <div className="metric_content">
                  <h3>{platformMetrics.totalProductGroups.toLocaleString()}</h3>
                  <p>Product Groups</p>
                </div>
              </div>
              <div className="metric_card clickable" onClick={() => setShowActivityDropdown(!showActivityDropdown)} ref={activityDropdownRef}>
                <div className="metric_icon">
                  <CheckIcon />
                </div>
                <div className="metric_content">
                  <h3>{platformMetrics.activeBusinesses}</h3>
                  <p>Active ({getActivityFilterLabel()})</p>
                </div>
                {showActivityDropdown && (
                  <div className="activity_dropdown">
                    <div
                      className={`dropdown_item ${activityFilter === 7 ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setActivityFilter(7); setShowActivityDropdown(false); }}
                    >
                      7 days
                    </div>
                    <div
                      className={`dropdown_item ${activityFilter === 30 ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setActivityFilter(30); setShowActivityDropdown(false); }}
                    >
                      1 month
                    </div>
                    <div
                      className={`dropdown_item ${activityFilter === 90 ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setActivityFilter(90); setShowActivityDropdown(false); }}
                    >
                      3 months
                    </div>
                    <div
                      className={`dropdown_item ${activityFilter === 180 ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setActivityFilter(180); setShowActivityDropdown(false); }}
                    >
                      6 months
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="search_bar">
            <input
              type="text"
              placeholder="Search businesses by name..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
          <div className="businesses-table-wrapper">
            {currentBusinesses?.length > 0 ? (
              <table className="businesses-table">
                <thead>
                  <tr>
                    <th className="col-business">Business</th>
                    <th className="col-email">Email</th>
                    <th className="col-metrics">Products</th>
                    <th className="col-metrics">Checkouts</th>
                    <th className="col-metrics">Groups</th>
                    <th className="col-plan">Plan</th>
                    <th className="col-due-date">Due Date</th>
                    <th className="col-activity">Last Activity</th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentBusinesses.map((business) => {
                    const lastActivity = [business.lastProductUpdate, business.lastCheckoutUpdate, business.lastProductGroupUpdate]
                      .filter(Boolean)
                      .map(date => new Date(date))
                      .sort((a, b) => b - a)[0];

                    return (
                      <tr key={business._id} className="business-table-row">
                        <td className="col-business">
                          <div className="business-cell">
                            <img
                              src={business.photo}
                              alt={business.businessName}
                              className="business-logo"
                            />
                            <span className="business-name">{business.businessName}</span>
                          </div>
                        </td>
                        <td className="col-email">{business.businessEmail}</td>
                        <td className="col-metrics">{business.productCount || 0}</td>
                        <td className="col-metrics">{business.checkoutCount || 0}</td>
                        <td className="col-metrics">{business.productGroupCount || 0}</td>
                        <td className="col-plan">
                          <span className="plan-badge">{business.subscription?.plan || 'N/A'}</span>
                        </td>
                        <td className="col-due-date">
                          {moment(business.subscription?.nextDueDate).format('MMM D, YYYY')}
                        </td>
                        <td className="col-activity">
                          {lastActivity ? moment(lastActivity).fromNow() : 'No activity'}
                        </td>
                        <td className="col-actions">
                          <div className="action-buttons">
                            <button
                              className="action-btn view-btn"
                              onClick={(e) => openBusinessModal(business, e)}
                              title="View Details"
                              aria-label="View Details"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                            <button
                              className="action-btn edit-btn"
                              onClick={() => handleEditClick(business)}
                              title="Edit Subscription"
                              aria-label="Edit Subscription"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                              </svg>
                            </button>
                            <button
                              className="action-btn message-btn"
                              onClick={() => openCommunicationComposer(business, "owner")}
                              title="Message Owner"
                              aria-label="Message Owner"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="2" y="4" width="20" height="16" rx="2" />
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="no_results">
                <div className="empty_state_icon">
                  <svg width="120" height="120" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 7H16V5C16 3.9 15.1 3 14 3H10C8.9 3 8 3.9 8 5V7H4C2.9 7 2 7.9 2 9V20C2 21.1 2.9 22 4 22H20C21.1 22 22 21.1 22 20V9C22 7.9 21.1 7 20 7ZM10 5H14V7H10V5ZM20 20H4V9H8V11H10V9H14V11H16V9H20V20Z" fill="var(--brand-color)" fillOpacity="0.2" />
                    <circle cx="12" cy="15" r="3" fill="var(--brand-color)" fillOpacity="0.4" />
                  </svg>
                </div>
                <h3 className="empty_state_title">No Businesses Found</h3>
                <p className="empty_state_description">
                  {searchTerm ? (
                    <>
                      No businesses match your search <strong>"{searchTerm}"</strong>.<br />
                      Try adjusting your search terms.
                    </>
                  ) : (
                    <>
                      There are no registered businesses yet.<br />
                      New businesses will appear here once registered.
                    </>
                  )}
                </p>
                {searchTerm && (
                  <button className="clear_search_btn" onClick={() => { setSearchTerm(''); navigate('/admin'); }}>
                    Clear Search
                  </button>
                )}
              </div>
            )}
          </div>
          {selectedBusiness && (
            <div className="business_modal_overlay" onClick={() => setSelectedBusiness(null)}>
              <div className="business_modal" onClick={(e) => e.stopPropagation()}>
                <button
                  className="modal_close_btn"
                  onClick={() => setSelectedBusiness(null)}
                  type="button"
                  aria-label="Close modal"
                >
                  ×
                </button>

                <div className="business_modal_header">
                  <img
                    src={selectedBusiness.photo}
                    alt={selectedBusiness.businessName}
                    className="business_image_compact"
                  />
                  <div className="business_modal_meta">
                    <p className="modal_kicker">Business profile</p>
                    <h2>{selectedBusiness.businessName}</h2>
                    <p className="business_email modal_email">{selectedBusiness.businessEmail}</p>
                    <span className="business_due_date modal_due">Due: {moment(selectedBusiness.subscription?.nextDueDate).format('MMM D, YYYY')}</span>
                  </div>
                </div>

                <div className="business_modal_metrics">
                  <div className="metric_item">
                    <span className="metric_label">Products</span>
                    <span className="metric_value">{selectedBusiness.productCount || 0}</span>
                  </div>
                  <div className="metric_item">
                    <span className="metric_label">Checkouts</span>
                    <span className="metric_value">{selectedBusiness.checkoutCount || 0}</span>
                  </div>
                  <div className="metric_item">
                    <span className="metric_label">Groups</span>
                    <span className="metric_value">{selectedBusiness.productGroupCount || 0}</span>
                  </div>
                  <div className="metric_item">
                    <span className="metric_label">Plan</span>
                    <span className="metric_value plan_badge">{selectedBusiness.subscription?.plan || 'N/A'}</span>
                  </div>
                  <div className="metric_item">
                    <span className="metric_label">Total Revenue</span>
                    <span className="metric_value">₦{(selectedBusiness.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  </div>
                </div>

                <div className="detail_section">
                  <h3>Business Information</h3>
                  <p><strong>ID:</strong> {selectedBusiness._id}</p>
                  <p><strong>Phone:</strong> {selectedBusiness.businessPhone}</p>
                  <p><strong>Address:</strong> {selectedBusiness.businessAddress}</p>
                  <p><strong>Industry:</strong> {selectedBusiness.industry}</p>
                  <p><strong>Country:</strong> {selectedBusiness.country}</p>
                </div>

                <div className="detail_section">
                  <h3>Business Owner</h3>
                  <p><strong>Name:</strong> {`${selectedBusiness.businessOwner.firstName} ${selectedBusiness.businessOwner.lastName}`}</p>
                  <p><strong>Email:</strong> {selectedBusiness.businessOwner.email}</p>
                </div>

                {selectedBusiness.salesRep && selectedBusiness.salesRep.length > 0 && (
                  <div className="detail_section">
                    <h3>Sales Representatives ({selectedBusiness.salesRep.length})</h3>
                    {selectedBusiness.salesRep.map((rep, index) => (
                      <div key={index} className="sales_rep">
                        <p><strong>Name:</strong> {`${rep.firstName} ${rep.lastName}`}</p>
                        <p><strong>Email:</strong> {rep.email}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="detail_section">
                  <h3>Subscription Details</h3>
                  <p><strong>Type:</strong> {selectedBusiness.subscription.subscriptionType}</p>
                  <p><strong>Plan:</strong> {selectedBusiness.subscription.plan}</p>
                  <p><strong>Next Due Date:</strong> {moment(selectedBusiness.subscription.nextDueDate).format(format)}</p>
                  <button
                    className="uppdate_sub_btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBusiness(null);
                      handleEditClick(selectedBusiness);
                    }}
                  >
                    Update Subscription
                  </button>
                  <button
                    className="uppdate_sub_btn secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBusiness(null);
                      openCommunicationComposer(selectedBusiness, "owner");
                    }}
                  >
                    Message Owner
                  </button>
                </div>

                <div className="detail_section">
                  <h3>Activity Timeline</h3>
                  <p>
                    <strong>Total Revenue:</strong>{" "}
                    ₦{(selectedBusiness.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p>
                    <strong>Last Product Update:</strong>{" "}
                    {selectedBusiness.lastProductUpdate
                      ? moment(selectedBusiness.lastProductUpdate).format(format)
                      : "No activity"}
                  </p>
                  <p>
                    <strong>Last Checkout:</strong>{" "}
                    {selectedBusiness.lastCheckoutUpdate
                      ? moment(selectedBusiness.lastCheckoutUpdate).format(format)
                      : "No activity"}
                  </p>
                  <p>
                    <strong>Last Group Update:</strong>{" "}
                    {selectedBusiness.lastProductGroupUpdate
                      ? moment(selectedBusiness.lastProductGroupUpdate).format(format)
                      : "No activity"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Pagination
            businessesPerPage={businessesPerPage}
            totalBusinesses={filteredBusinesses?.length}
            paginate={paginate}
            currentPage={currentPage}
            isLoading={isLoading}
          />
          {editingBusiness && (
            <div className="edit_form" onClick={() => setEditingBusiness(null)}>
              <div ref={editFormRef} onClick={(e) => e.stopPropagation()}>
                <button
                  className="modal_close_btn"
                  onClick={() => setEditingBusiness(null)}
                  type="button"
                  aria-label="Close modal"
                >
                  ×
                </button>
                <h2>Update Subscription for {editingBusiness.businessName}</h2>
                <form onSubmit={handleUpdateSubscription}>
                  <div>
                    <label>Subscription Type</label>
                    <select
                      value={subscriptionType}
                      onChange={(e) => setSubscriptionType(e.target.value)}
                    >
                      <option value="permanent">Permanent</option>
                      <option value="recurring">Recurring</option>
                    </select>
                  </div>
                  <div>
                    <label>Plan</label>
                    <select value={plan} onChange={(e) => setPlan(e.target.value)}>
                      <option value="Basic">Basic</option>
                      <option value="Standard">Standard</option>
                      <option value="Professional">Professional</option>
                    </select>
                  </div>
                  <div>
                    <label>Next Due Date</label>
                    <input
                      type="date"
                      value={nextDueDate}
                      onChange={(e) => setNextDueDate(e.target.value)}
                    />
                  </div>
                  <div className="update_form_actions">
                    <button type="submit">Update</button>
                    <button type="button" onClick={() => setEditingBusiness(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}


      {activeTab === "setup-verification" && (
        <BusinessSetupVerification />
      )}


      {activeTab === "applications" && (
        <div className="applications_panel">
          <div className="applications_header">
            <div>
              <h2>Marketing Internship Applications</h2>
              <p>Review submissions, send briefs, and follow up with candidates.</p>
            </div>
            <button className="refresh_btn" onClick={handleRefreshApplications} disabled={isLoadingApplications}>
              {isLoadingApplications ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {isLoadingApplications ? (
            <div className="applications_empty">Loading applications...</div>
          ) : applications.length === 0 ? (
            <div className="applications_empty">No applications yet.</div>
          ) : (
            <div className="applications_list">
              {applications.map((app) => (
                <div key={app._id} className="application_card">
                  <div className="application_header">
                    <div>
                      <h3>{app.fullName}</h3>
                      <p className="application_position">{app.position}</p>
                      <p className="application_contact">{app.email} · {app.phone}</p>
                    </div>
                    <div className="application_meta_right">
                      <span className="application_date">Applied: {formatDate(app.appliedAt)}</span>
                      {app.portfolioUrl && (
                        <a href={app.portfolioUrl} target="_blank" rel="noreferrer" className="portfolio_link">Portfolio</a>
                      )}
                    </div>
                  </div>

                  {(app.cvPath || app.coverLetterPath) && (
                    <div className="application_files">
                      {app.cvPath && (
                        <a
                          className="file_btn"
                          href={app.cvPath}
                          target="_blank"
                          rel="noreferrer"
                          title={`View resume for ${app.fullName}`}
                        >
                          <span className="file_btn_title">Resume</span>
                          <span className="file_btn_meta">{app.cvFileName || "View resume"}</span>
                        </a>
                      )}

                      {app.coverLetterPath && (
                        <a
                          className="file_btn secondary"
                          href={app.coverLetterPath}
                          target="_blank"
                          rel="noreferrer"
                          title={`View cover letter for ${app.fullName}`}
                        >
                          <span className="file_btn_title">Cover letter</span>
                          <span className="file_btn_meta">{app.coverLetterFileName || "Cover letter file"}</span>
                        </a>
                      )}
                    </div>
                  )}

                  <div className="application_actions">
                    <div className="status_control">
                      {/* <label>Status</label> */}
                      <select
                        value={app.status}
                        onChange={(e) => handleStatusChange(app._id, e.target.value)}
                        disabled={statusUpdatingId === app._id}
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                    <div className="brief_controls">
                      <button className="ghost_btn" onClick={() => openBriefForm(app)}>Send brief</button>
                      <button className="ghost_btn" onClick={() => openEmailForm(app)}>Send email</button>
                    </div>
                    {app.latestBrief && (
                      <div className="brief_status">
                        <span className={`pill pill-${app.latestBrief.status}`}>{app.latestBrief.status}</span>
                        <span className="brief_meta">Sent {formatDate(app.latestBrief.sentAt)}{app.latestBrief.submittedAt ? ` · Submitted ${formatDate(app.latestBrief.submittedAt)}` : ""}</span>
                        {app.latestBrief.dueDate && <span className="brief_meta"> · Due {formatDate(app.latestBrief.dueDate)}</span>}
                      </div>
                    )}
                  </div>

                  {app.latestBrief?.instructions && (
                    <div className="brief_note_inline">
                      <strong>Notes:</strong> {app.latestBrief.instructions}
                    </div>
                  )}

                  {app.latestBrief?.responses && app.latestBrief.status !== "sent" && (
                    <div className="brief_response_block">
                      <div
                        className="brief_response_header"
                        onClick={() => setCollapsedBriefResponses(prev => ({
                          ...prev,
                          [app._id]: !prev[app._id]
                        }))}
                      >
                        <h4>Brief responses</h4>
                        <span className={`collapse_icon ${collapsedBriefResponses[app._id] === false ? 'expanded' : 'collapsed'}`}>
                          {collapsedBriefResponses[app._id] === false ? '−' : '+'}
                        </span>
                      </div>
                      {collapsedBriefResponses[app._id] === false && (
                        <div className="brief_response_grid">
                          <div>
                            <p className="response_label">Campaign idea</p>
                            <p className="response_value">{app.latestBrief.responses.campaignIdea || "—"}</p>
                          </div>
                          <div>
                            <p className="response_label">Channel plan</p>
                            <p className="response_value">{app.latestBrief.responses.channelPlan || "—"}</p>
                          </div>
                          <div>
                            <p className="response_label">Measurement plan</p>
                            <p className="response_value">{app.latestBrief.responses.measurementPlan || "—"}</p>
                          </div>
                          <div>
                            <p className="response_label">Links</p>
                            <p className="response_value">{app.latestBrief.responses.links || "—"}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {briefForm.id === app._id && (
                    <form className="inline_form" onSubmit={submitBriefForm}>
                      <div className="form_row">
                        <label>Due date (optional)</label>
                        <input
                          type="date"
                          value={briefForm.dueDate}
                          onChange={(e) => setBriefForm({ ...briefForm, dueDate: e.target.value })}
                        />
                      </div>
                      <div className="form_row">
                        <label>Notes / constraints</label>
                        <textarea
                          rows="3"
                          value={briefForm.instructions}
                          onChange={(e) => setBriefForm({ ...briefForm, instructions: e.target.value })}
                        />
                      </div>
                      <div className="form_actions">
                        <button type="submit">Send brief</button>
                        <button type="button" className="ghost_btn" onClick={() => setBriefForm({ id: null, instructions: "", dueDate: "" })}>Cancel</button>
                      </div>
                    </form>
                  )}

                  {emailForm.id === app._id && (
                    <form className="inline_form" onSubmit={submitEmailForm}>
                      <div className="form_row">
                        <label>Subject</label>
                        <input
                          type="text"
                          value={emailForm.subject}
                          onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form_row">
                        <label>Message</label>
                        <textarea
                          rows="4"
                          value={emailForm.message}
                          onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form_row">
                        <label>Attachments (optional, max 5 files, 10MB each)</label>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
                          onChange={handleAttachmentChange}
                          style={{ marginBottom: "8px" }}
                        />
                        {emailForm.attachments.length > 0 && (
                          <div className="attachment_list" style={{ marginTop: "8px" }}>
                            {emailForm.attachments.map((file, idx) => (
                              <div
                                key={idx}
                                className="attachment_item"
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "6px 10px",
                                  background: "#f5f5f5",
                                  borderRadius: "4px",
                                  marginBottom: "4px",
                                  fontSize: "13px"
                                }}
                              >
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>
                                  📎 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeAttachment(idx)}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "#e74c3c",
                                    cursor: "pointer",
                                    padding: "2px 6px",
                                    fontSize: "14px"
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="form_actions">
                        <button type="submit">
                          {emailForm.attachments.length > 0
                            ? `Send email (${emailForm.attachments.length} attachment${emailForm.attachments.length > 1 ? "s" : ""})`
                            : "Send email"}
                        </button>
                        <button type="button" className="ghost_btn" onClick={() => {
                          setEmailForm({ id: null, subject: "", message: "", attachments: [] });
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}>Cancel</button>
                      </div>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "integration" && (
        <div className="integration_panel">
          <div className="integration_header">
            <div>
              <h2>Social Media Integrations</h2>
              <p>Connect and manage your TikTok and Instagram shops for seamless multi-channel selling.</p>
            </div>
          </div>

          <div className="integration_grid">
            {/* TikTok Integration */}
            <div className="integration_card">
              <div className="integration_card_header">
                <h3>TikTok Shop</h3>
                <span className={`integration_badge ${integrationSettings?.tiktok?.enabled ? "active" : ""}`}>
                  {integrationSettings?.tiktok?.enabled ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div className="integration_card_content">
                <p className="integration_description">Connect your TikTok Shop to sync products and automate orders.</p>

                <div className="integration_features">
                  <h4>Integration Features:</h4>
                  <ul>
                    <li>Automatic product synchronization</li>
                    <li>Real-time order webhooks</li>
                    <li>Sales and analytics metrics</li>
                    <li>Inventory management</li>
                  </ul>
                </div>

                <button
                  className="integration_btn"
                  onClick={integrationSettings?.tiktok?.enabled ? handleDisconnectTikTok : handleConnectTikTok}
                  disabled={connectingPlatform === "tiktok"}
                >
                  {connectingPlatform === "tiktok" ? "Processing..." : (integrationSettings?.tiktok?.enabled ? "Disconnect TikTok Shop" : "Connect TikTok Shop")}
                </button>
              </div>
            </div>

            {/* Instagram Integration */}
            <div className="integration_card">
              <div className="integration_card_header">
                <h3>Instagram Shop</h3>
                <span className={`integration_badge ${integrationSettings?.instagram?.enabled ? "active" : ""}`}>
                  {integrationSettings?.instagram?.enabled ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div className="integration_card_content">
                <p className="integration_description">Link your Instagram Shop to start selling directly on Instagram.</p>

                <div className="integration_features">
                  <h4>Integration Features:</h4>
                  <ul>
                    <li>Instagram catalog sync</li>
                    <li>Real-time order notifications</li>
                    <li>Performance analytics</li>
                    <li>Customer engagement tracking</li>
                  </ul>
                </div>

                <button
                  className="integration_btn"
                  onClick={integrationSettings?.instagram?.enabled ? handleDisconnectInstagram : handleConnectInstagram}
                  disabled={connectingPlatform === "instagram"}
                >
                  {connectingPlatform === "instagram" ? "Processing..." : (integrationSettings?.instagram?.enabled ? "Disconnect Instagram Shop" : "Connect Instagram Shop")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "communications" && (
        <div className="communications_panel">
          <div className="communications_header">
            <div>
              <h2>Communications & Messaging</h2>
              <p>Manage email and WhatsApp communications. Send personalized messages at scale to your businesses.</p>
            </div>
            <div className="communications_badge">
              <span>Email & WhatsApp</span>
              <span>Per-business personalisation</span>
            </div>
          </div>

          <div className="communications_grid">
            <div className="communications_accounts_section">
              <div className="communications_toolbar">
                <div className="communications_search">
                  <input
                    type="text"
                    placeholder="Search account by business name or email"
                    value={accountSearchTerm}
                    onChange={(e) => setAccountSearchTerm(e.target.value)}
                  />
                </div>
                <div className="communications_filters" role="tablist" aria-label="Account filters">
                  {accountFilterOptions.map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      className={`account_filter_chip ${
                        accountFilter === option.value ? "active" : ""
                      }`}
                      onClick={() => setAccountFilter(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipient type toggle */}
              <div className="comm_recipient_toggle">
                <span className="comm_recipient_label">Send to:</span>
                <div className="comm_recipient_options">
                  <button
                    type="button"
                    className={`comm_recipient_btn ${
                      communicationRecipientType === "owner" ? "active" : ""
                    }`}
                    onClick={() => setCommunicationRecipientType("owner")}
                  >
                    Owner email
                  </button>
                  <button
                    type="button"
                    className={`comm_recipient_btn ${
                      communicationRecipientType === "business" ? "active" : ""
                    }`}
                    onClick={() => setCommunicationRecipientType("business")}
                  >
                    Business email
                  </button>
                </div>
              </div>

              {/* Selection bar */}
              <div className="comm_selection_bar">
                <div className="comm_selection_count">
                  {selectedBusinessIds.size > 0 ? (
                    <span className="comm_count_badge">{selectedBusinessIds.size} selected</span>
                  ) : (
                    <span className="comm_count_none">No businesses selected</span>
                  )}
                </div>
                <div className="comm_selection_actions">
                  <button
                    type="button"
                    className="comm_select_link"
                    onClick={toggleSelectAllFiltered}
                  >
                    {allFilteredSelected ? "Deselect view" : "Select all in view"}
                  </button>
                  {selectedBusinessIds.size > 0 && (
                    <button
                      type="button"
                      className="comm_select_link comm_clear_link"
                      onClick={() => setSelectedBusinessIds(new Set())}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Business list */}
              <div className="communications_business_list">
                {communicationBusinesses.length ? (
                  communicationBusinesses.map((business) => {
                    const isChecked = selectedBusinessIds.has(business._id);
                    return (
                      <label
                        key={business._id}
                        className={`communications_business_item ${
                          isChecked ? "selected" : ""
                        }`}
                        htmlFor={`biz-check-${business._id}`}
                      >
                        <input
                          id={`biz-check-${business._id}`}
                          type="checkbox"
                          className="comm_checkbox"
                          checked={isChecked}
                          onChange={() => toggleBusinessSelection(business._id)}
                        />
                        <div className="comm_biz_info">
                          <h4>{business.businessName}</h4>
                          <p>{business.businessOwner?.email || business.businessEmail}</p>
                          <p className="communications_meta_line">
                            {business.subscription?.plan || "No Plan"} · Due{" "}
                            {formatDate(business.subscription?.nextDueDate)}
                          </p>
                        </div>
                      </label>
                    );
                  })
                ) : (
                  <div className="applications_empty">
                    No accounts match your current search and filter.
                  </div>
                )}
              </div>
            </div>

            <form className="communications_form" onSubmit={submitCommunicationForm}>
              <div className="communications_preview_card">
                {previewBusiness ? (
                  <>
                    <p className="preview_label">Preview · {previewBusiness.businessName}</p>
                    <p className="preview_subject">{previewSubject || "—"}</p>
                    <p className="preview_recipient">
                      → {previewRecipientEmail || "No email available"}
                    </p>
                    {selectedBusinessIds.size > 1 && (
                      <p className="preview_more">
                        +{selectedBusinessIds.size - 1} more business
                        {selectedBusinessIds.size - 1 !== 1 ? "es" : ""}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="preview_label">Preview</p>
                    <p className="preview_empty">Select at least one business to preview</p>
                  </>
                )}
              </div>

              <div className="form_row">
                <label>Purpose</label>
                <select
                  value={communicationForm.purpose}
                  onChange={(e) => handleCommunicationPurposeChange(e.target.value)}
                >
                  {Object.entries(communicationDefaults).map(([value, item]) => (
                    <option key={value} value={value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form_row">
                <label>Subject template</label>
                <input
                  type="text"
                  value={communicationForm.subject}
                  onChange={(e) =>
                    setCommunicationForm((prev) => ({ ...prev, subject: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="form_row">
                <label>Message template</label>
                <textarea
                  rows="9"
                  value={communicationForm.message}
                  onChange={(e) =>
                    setCommunicationForm((prev) => ({ ...prev, message: e.target.value }))
                  }
                  required
                />
                <div className="template_hint">
                  Placeholders: {"{{businessName}}"}, {"{{ownerName}}"}, {"{{plan}}"}, {"{{dueDate}}"}
                </div>
              </div>

              <div className="form_row">
                <label>Reply-to (optional)</label>
                <input
                  type="email"
                  placeholder="team@sellsquarehub.com"
                  value={communicationForm.replyTo}
                  onChange={(e) =>
                    setCommunicationForm((prev) => ({ ...prev, replyTo: e.target.value }))
                  }
                />
              </div>

              <div className="whatsapp_section">
                <div className="whatsapp_header">
                  <h3>WhatsApp Integration</h3>
                </div>
                <div className="whatsapp_content">
                  <p className="whatsapp_description">Configure WhatsApp Business API to send automated messages to your customers.</p>

                  <div className="form_row">
                    <label>WhatsApp Business Phone Number ID</label>
                    <input
                      type="text"
                      placeholder="Enter your WhatsApp Business Phone Number ID"
                      disabled
                    />
                  </div>

                  <div className="form_row">
                    <label>Access Token</label>
                    <input
                      type="password"
                      placeholder="Enter your WhatsApp access token"
                      disabled
                    />
                  </div>

                  <div className="whatsapp_features">
                    <h4>WhatsApp Features:</h4>
                    <ul>
                      <li>Order notifications and updates</li>
                      <li>Customer support messaging</li>
                      <li>Delivery confirmations</li>
                      <li>Automated message templates</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="form_actions">
                <button type="submit" disabled={!selectedBusinessIds.size}>
                  {selectedBusinessIds.size > 0
                    ? `Send to ${selectedBusinessIds.size} business${
                        selectedBusinessIds.size !== 1 ? "es" : ""
                      }`
                    : "Select businesses to send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === "automation" && (
        <AutomationTab />
      )}

      {activeTab === "escrow" && (
        <EscrowManagementTab />
      )}
    </div>
  );
}

const Pagination = ({
  businessesPerPage,
  totalBusinesses,
  paginate,
  currentPage,
  isLoading,
}) => {
  const pageNumbers = [];

  for (let i = 1; i <= Math.ceil(totalBusinesses / businessesPerPage); i++) {
    pageNumbers.push(i);
  }

  return (
    <nav className={`pagination ${isLoading ? 'pagination-disabled' : ''}`}>
      <ul>
        {pageNumbers.map((number) => (
          <li key={number} className={number === currentPage ? "active" : ""}>
            <a
              onClick={(e) => {
                if (!isLoading) {
                  paginate(number);
                }
                e.preventDefault();
              }}
              href="#!"
              style={{ cursor: isLoading ? 'not-allowed' : 'pointer' }}
            >
              {number}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Admin;
