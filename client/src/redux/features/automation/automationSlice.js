import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { BACKEND_URL } from "../../../config/apiConfig";

const initialState = {
  status: {
    integrations: {},
    automationsEnabled: {},
    lastSyncedAt: {},
  },
  jobStatus: {},
  contentIdeas: [],
  socialMediaEngagements: [],
  registrationFollowups: [],
  campaigns: [],
  isLoading: false,
  isLoadingJobs: false,
  isApprovingContent: false,
  error: null,
  lastChecked: null,
};

// Async thunks
export const fetchAutomationStatus = createAsyncThunk(
  "automation/fetchStatus",
  async (_, thunkAPI) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/automation/status`);
      return res.data?.data || {};
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const fetchJobStatus = createAsyncThunk(
  "automation/fetchJobStatus",
  async (_, thunkAPI) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/automation/jobs/status`);
      return res.data?.data || {};
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const fetchContentIdeas = createAsyncThunk(
  "automation/fetchContentIdeas",
  async ({ status = "pending_approval", limit = 20, skip = 0 }, thunkAPI) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/automation/ideas`, {
        params: { status, limit, skip },
      });
      return res.data?.data || [];
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const fetchSocialMediaEngagements = createAsyncThunk(
  "automation/fetchEngagements",
  async ({ platform = null, limit = 20, skip = 0 }, thunkAPI) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/automation/engagements`, {
        params: { platform, limit, skip },
      });
      return res.data?.data || [];
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const approveContentIdea = createAsyncThunk(
  "automation/approveContentIdea",
  async ({ ideaId, notes }, thunkAPI) => {
    try {
      const res = await axios.patch(
        `${BACKEND_URL}/api/automation/ideas/${ideaId}/approve`,
        { notes }
      );
      return res.data?.data;
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const rejectContentIdea = createAsyncThunk(
  "automation/rejectContentIdea",
  async ({ ideaId, reason }, thunkAPI) => {
    try {
      const res = await axios.patch(
        `${BACKEND_URL}/api/automation/ideas/${ideaId}/reject`,
        { reason }
      );
      return res.data?.data;
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const scheduleContentIdea = createAsyncThunk(
  "automation/scheduleContentIdea",
  async ({ ideaId, platforms, scheduledDate }, thunkAPI) => {
    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/automation/ideas/${ideaId}/schedule`,
        { platforms, scheduledDate }
      );
      return res.data?.data;
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const fetchRegistrationFollowups = createAsyncThunk(
  "automation/fetchFollowups",
  async ({ status = "in_sequence", limit = 20, skip = 0 } = {}, thunkAPI) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/automation/followups`, {
        params: { status, limit, skip },
      });
      return res.data?.data || [];
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const fetchCampaigns = createAsyncThunk(
  "automation/fetchCampaigns",
  async ({ status = null, limit = 20, skip = 0 } = {}, thunkAPI) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/automation/campaigns`, {
        params: { status, limit, skip },
      });
      return res.data?.data || [];
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const createCampaign = createAsyncThunk(
  "automation/createCampaign",
  async (campaignData, thunkAPI) => {
    try {
      const res = await axios.post(`${BACKEND_URL}/api/automation/campaigns`, campaignData);
      return res.data?.data;
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

const automationSlice = createSlice({
  name: "automation",
  initialState,
  reducers: {
    clearAutomationError: (state) => {
      state.error = null;
    },
    updateContentIdea: (state, action) => {
      const updatedIdea = action.payload;
      state.contentIdeas = state.contentIdeas.map((idea) =>
        idea._id === updatedIdea._id ? updatedIdea : idea
      );
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch automation status
      .addCase(fetchAutomationStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAutomationStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        state.status = action.payload;
        state.lastChecked = new Date();
      })
      .addCase(fetchAutomationStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch job status
      .addCase(fetchJobStatus.pending, (state) => {
        state.isLoadingJobs = true;
        state.error = null;
      })
      .addCase(fetchJobStatus.fulfilled, (state, action) => {
        state.isLoadingJobs = false;
        state.jobStatus = action.payload;
      })
      .addCase(fetchJobStatus.rejected, (state, action) => {
        state.isLoadingJobs = false;
        state.error = action.payload;
      })
      // Fetch content ideas
      .addCase(fetchContentIdeas.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchContentIdeas.fulfilled, (state, action) => {
        state.isLoading = false;
        state.contentIdeas = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchContentIdeas.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch social media engagements
      .addCase(fetchSocialMediaEngagements.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSocialMediaEngagements.fulfilled, (state, action) => {
        state.isLoading = false;
        state.socialMediaEngagements = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchSocialMediaEngagements.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Approve content idea
      .addCase(approveContentIdea.pending, (state) => {
        state.isApprovingContent = true;
        state.error = null;
      })
      .addCase(approveContentIdea.fulfilled, (state, action) => {
        state.isApprovingContent = false;
        state.contentIdeas = state.contentIdeas.map((idea) =>
          idea._id === action.payload._id ? action.payload : idea
        );
      })
      .addCase(approveContentIdea.rejected, (state, action) => {
        state.isApprovingContent = false;
        state.error = action.payload;
      })
      // Reject content idea
      .addCase(rejectContentIdea.pending, (state) => {
        state.isApprovingContent = true;
        state.error = null;
      })
      .addCase(rejectContentIdea.fulfilled, (state, action) => {
        state.isApprovingContent = false;
        state.contentIdeas = state.contentIdeas.map((idea) =>
          idea._id === action.payload._id ? action.payload : idea
        );
      })
      .addCase(rejectContentIdea.rejected, (state, action) => {
        state.isApprovingContent = false;
        state.error = action.payload;
      })
      // Schedule content idea
      .addCase(scheduleContentIdea.rejected, (state, action) => {
        state.isApprovingContent = false;
        state.error = action.payload;
      })
      // Fetch registration follow-ups
      .addCase(fetchRegistrationFollowups.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRegistrationFollowups.fulfilled, (state, action) => {
        state.isLoading = false;
        state.registrationFollowups = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchRegistrationFollowups.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch campaigns
      .addCase(fetchCampaigns.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCampaigns.fulfilled, (state, action) => {
        state.isLoading = false;
        state.campaigns = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchCampaigns.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Create campaign
      .addCase(createCampaign.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createCampaign.fulfilled, (state, action) => {
        state.isLoading = false;
        state.campaigns.unshift(action.payload);
      })
      .addCase(createCampaign.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearAutomationError, updateContentIdea } = automationSlice.actions;

export const selectAutomationStatus = (state) => state.automation.status;
export const selectJobStatus = (state) => state.automation.jobStatus;
export const selectContentIdeas = (state) => state.automation.contentIdeas;
export const selectSocialMediaEngagements = (state) => state.automation.socialMediaEngagements;
export const selectRegistrationFollowups = (state) => state.automation.registrationFollowups;
export const selectCampaigns = (state) => state.automation.campaigns;
export const selectAutomationLoading = (state) => state.automation.isLoading;
export const selectAutomationJobsLoading = (state) => state.automation.isLoadingJobs;
export const selectAutomationError = (state) => state.automation.error;
export const selectLastChecked = (state) => state.automation.lastChecked;

export default automationSlice.reducer;
