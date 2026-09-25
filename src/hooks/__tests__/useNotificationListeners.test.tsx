import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";

import { APP_STATE } from "@/constants/AppState";
import { useNotificationListeners } from "@/hooks/useNotificationListeners";
import { cleanupManager } from "@/services/cleanup";

jest.mock("@/utils/notifications", () => ({ configureNotifications: jest.fn() }));
jest.mock("@/services/cleanup", () => ({
  cleanupManager: {
    executeAll: jest.fn(),
    getRegisteredTasks: jest.fn(),
    isCleanupInProgress: jest.fn(),
  },
}));

/** The app-state listener the hook subscribed last. */
const appStateListener = () => jest.mocked(AppState.addEventListener).mock.lastCall?.[1];

describe("useNotificationListeners", () => {
  const startState = AppState.currentState;

  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    Object.assign(AppState, { currentState: startState });
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  // AppState reports no state when its native module is missing.
  it("runs the background cleanup when the start state is unknown", async () => {
    Object.assign(AppState, { currentState: null });
    const { unmount } = await renderHook(() => useNotificationListeners());

    await act(async () => appStateListener()?.(APP_STATE.BACKGROUND));

    expect(cleanupManager.executeAll).toHaveBeenCalledTimes(1);
    unmount();
  });
});
