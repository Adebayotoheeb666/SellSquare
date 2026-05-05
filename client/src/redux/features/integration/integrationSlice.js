import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as integrationService from "../../../services/integrationService";

const initialState = {
  settings: null,
  isLoading: false,
  isConnecting: false,
  connectedPlatforms: [],
  error: null,
  lastUpdated: null,
};

// Async thunks
export const fetchIntegrationSettings = createAsyncThunk(
  "integration/fetchSettings",
  async (_, thunkAPI) => {
    try {
      const result = await integrationService.getIntegrationSettings();
      return result;
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const connectTikTokIntegration = createAsyncThunk(
  "integration/connectTikTok",
  async (automationSettings, thunkAPI) => {
    try {
      const result = await integrationService.connectTikTok(automationSettings);
      return { platform: "tiktok", data: result };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const disconnectTikTokIntegration = createAsyncThunk(
  "integration/disconnectTikTok",
  async (_, thunkAPI) => {
    try {
      await integrationService.disconnectTikTok();
      return { platform: "tiktok" };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const connectInstagramIntegration = createAsyncThunk(
  "integration/connectInstagram",
  async (automationSettings, thunkAPI) => {
    try {
      const result = await integrationService.connectInstagram(automationSettings);
      return { platform: "instagram", data: result };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const disconnectInstagramIntegration = createAsyncThunk(
  "integration/disconnectInstagram",
  async (_, thunkAPI) => {
    try {
      await integrationService.disconnectInstagram();
      return { platform: "instagram" };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const connectWhatsAppIntegration = createAsyncThunk(
  "integration/connectWhatsApp",
  async (payload = {}, thunkAPI) => {
    try {
      const result = await integrationService.connectWhatsApp(payload);
      return { platform: "whatsapp", data: result };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const disconnectWhatsAppIntegration = createAsyncThunk(
  "integration/disconnectWhatsApp",
  async (_, thunkAPI) => {
    try {
      await integrationService.disconnectWhatsApp();
      return { platform: "whatsapp" };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const connectEmailIntegration = createAsyncThunk(
  "integration/connectEmail",
  async (payload = {}, thunkAPI) => {
    try {
      const result = await integrationService.connectEmail(payload);
      return { platform: "email", data: result };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const disconnectEmailIntegration = createAsyncThunk(
  "integration/disconnectEmail",
  async (_, thunkAPI) => {
    try {
      await integrationService.disconnectEmail();
      return { platform: "email" };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const connectElevenLabsIntegration = createAsyncThunk(
  "integration/connectElevenLabs",
  async (apiKey, thunkAPI) => {
    try {
      const result = await integrationService.connectElevenLabs(apiKey);
      return { platform: "elevenlabs", data: result };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const disconnectElevenLabsIntegration = createAsyncThunk(
  "integration/disconnectElevenLabs",
  async (_, thunkAPI) => {
    try {
      await integrationService.disconnectElevenLabs();
      return { platform: "elevenlabs" };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const updateAutomationSettings = createAsyncThunk(
  "integration/updateAutomationSettings",
  async ({ platform, automationSettings }, thunkAPI) => {
    try {
      const result = await integrationService.updateAutomationSettings(platform, automationSettings);
      return { platform, data: result };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const updateGlobalSchedules = createAsyncThunk(
  "integration/updateSchedules",
  async (schedules, thunkAPI) => {
    try {
      const result = await integrationService.updateSchedules(schedules);
      return result;
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);
export const testIntegrationConnection = createAsyncThunk(
  "integration/test",
  async (platform, thunkAPI) => {
    try {
      const result = await integrationService.testIntegration(platform);
      return { platform, result };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);
const integrationSlice = createSlice({
  name: "integration",
  initialState,
  reducers: {
    clearIntegrationError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch settings
      .addCase(fetchIntegrationSettings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchIntegrationSettings.fulfilled, (state, action) => {
        state.isLoading = false;
        state.settings = action.payload;
        state.lastUpdated = new Date();
        // Track connected platforms
        state.connectedPlatforms = Object.entries(action.payload)
          .filter(([key, value]) => value?.enabled)
          .map(([key]) => key);
      })
      .addCase(fetchIntegrationSettings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Update Automation Settings
      .addCase(updateAutomationSettings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateAutomationSettings.fulfilled, (state, action) => {
        state.isLoading = false;
        const { platform, data } = action.payload;
        if (state.settings && state.settings[platform]) {
          state.settings[platform].automationSettings = data.data?.automationSettings || data.automationSettings || Object.assign(state.settings[platform].automationSettings, data);
        }
      })
      .addCase(updateAutomationSettings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Connect TikTok
      .addCase(connectTikTokIntegration.pending, (state) => {
        state.isConnecting = true;
        state.error = null;
      })
      .addCase(connectTikTokIntegration.fulfilled, (state, action) => {
        state.isConnecting = false;
        if (state.settings) {
          state.settings.tiktok = { ...state.settings.tiktok, enabled: true, status: "connected" };
        }
        if (!state.connectedPlatforms.includes("tiktok")) {
          state.connectedPlatforms.push("tiktok");
        }
      })
      .addCase(connectTikTokIntegration.rejected, (state, action) => {
        state.isConnecting = false;
        state.error = action.payload;
      })
      // Disconnect TikTok
      .addCase(disconnectTikTokIntegration.pending, (state) => {
        state.isConnecting = true;
        state.error = null;
      })
      .addCase(disconnectTikTokIntegration.fulfilled, (state) => {
        state.isConnecting = false;
        if (state.settings) {
          state.settings.tiktok = { ...state.settings.tiktok, enabled: false, status: "disconnected" };
        }
        state.connectedPlatforms = state.connectedPlatforms.filter(p => p !== "tiktok");
      })
      .addCase(disconnectTikTokIntegration.rejected, (state, action) => {
        state.isConnecting = false;
        state.error = action.payload;
      })
      // Connect Instagram
      .addCase(connectInstagramIntegration.pending, (state) => {
        state.isConnecting = true;
        state.error = null;
      })
      .addCase(connectInstagramIntegration.fulfilled, (state) => {
        state.isConnecting = false;
        if (state.settings) {
          state.settings.instagram = { ...state.settings.instagram, enabled: true, status: "connected" };
        }
        if (!state.connectedPlatforms.includes("instagram")) {
          state.connectedPlatforms.push("instagram");
        }
      })
      .addCase(connectInstagramIntegration.rejected, (state, action) => {
        state.isConnecting = false;
        state.error = action.payload;
      })
      // Disconnect Instagram
      .addCase(disconnectInstagramIntegration.fulfilled, (state) => {
        state.isConnecting = false;
        if (state.settings) {
          state.settings.instagram = { ...state.settings.instagram, enabled: false, status: "disconnected" };
        }
        state.connectedPlatforms = state.connectedPlatforms.filter(p => p !== "instagram");
      })
      .addCase(disconnectInstagramIntegration.rejected, (state, action) => {
        state.isConnecting = false;
        state.error = action.payload;
      })
      // Generic handlers for other platforms to reduce boilerplate
      .addMatcher(
        (action) => action.type.endsWith("/pending") && action.type.startsWith("integration/connect"),
        (state) => {
          state.isConnecting = true;
          state.error = null;
        }
      )
      .addMatcher(
        (action) => action.type.endsWith("/fulfilled") && action.type.startsWith("integration/connect"),
        (state, action) => {
          state.isConnecting = false;
          const { platform } = action.payload;
          if (state.settings && platform) {
            state.settings[platform] = { ...state.settings[platform], enabled: true, status: "connected" };
          }
          if (platform && !state.connectedPlatforms.includes(platform)) {
            state.connectedPlatforms.push(platform);
          }
        }
      )
      .addMatcher(
        (action) => action.type.endsWith("/rejected") && action.type.startsWith("integration/connect"),
        (state, action) => {
          state.isConnecting = false;
          state.error = action.payload;
        }
      )
      .addMatcher(
        (action) => action.type.endsWith("/fulfilled") && action.type.startsWith("integration/disconnect"),
        (state, action) => {
          state.isConnecting = false;
          const { platform } = action.payload;
          if (state.settings && platform) {
            state.settings[platform] = { ...state.settings[platform], enabled: false, status: "disconnected" };
          }
          if (platform) {
            state.connectedPlatforms = state.connectedPlatforms.filter(p => p !== platform);
          }
        }
      );
  },
});

export const { clearIntegrationError } = integrationSlice.actions;

export const selectIntegrationSettings = (state) => state.integration.settings;
export const selectIntegrationLoading = (state) => state.integration.isLoading;
export const selectIntegrationConnecting = (state) => state.integration.isConnecting;
export const selectConnectedPlatforms = (state) => state.integration.connectedPlatforms;
export const selectIntegrationError = (state) => state.integration.error;
export const selectLastUpdated = (state) => state.integration.lastUpdated;

export default integrationSlice.reducer;
