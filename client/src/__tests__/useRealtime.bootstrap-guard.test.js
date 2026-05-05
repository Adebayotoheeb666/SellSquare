import React from "react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, waitFor } from "@testing-library/react";
import authReducer, { SET_LOGIN } from "../redux/features/auth/authSlice";
import dataCacheReducer, {
  completeBootstrap,
} from "../redux/features/dataCache/dataCacheSlice";
import realtimeReducer from "../redux/features/realtime/realtimeSlice";
import { useRealtimeConnection } from "../customHook/useRealtime";

const mockConnect = jest.fn();
const mockDisconnect = jest.fn();

jest.mock("../services/realtimeClient", () => ({
  realtimeClient: {
    connect: (...args) => mockConnect(...args),
    disconnect: (...args) => mockDisconnect(...args),
  },
  ConnectionState: {
    DISCONNECTED: "disconnected",
    CONNECTING: "connecting",
    CONNECTED: "connected",
    RECONNECTING: "reconnecting",
    ERROR: "error",
  },
}));

function TestRealtimeHook() {
  useRealtimeConnection();
  return null;
}

describe("useRealtimeConnection bootstrap guard", () => {
  const createStore = () =>
    configureStore({
      reducer: {
        auth: authReducer,
        dataCache: dataCacheReducer,
        realtime: realtimeReducer,
      },
    });

  beforeEach(() => {
    mockConnect.mockClear();
    mockDisconnect.mockClear();
    localStorage.clear();
  });

  test("does not connect before bootstrap is complete", async () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <TestRealtimeHook />
      </Provider>,
    );

    store.dispatch(SET_LOGIN(true));

    await waitFor(() => {
      expect(mockConnect).not.toHaveBeenCalled();
    });

    store.dispatch(completeBootstrap());

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });
});
