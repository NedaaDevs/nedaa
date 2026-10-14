import { act, renderHook } from "@testing-library/react-native";

import { useInitialSetup } from "@/hooks/useInitialSetup";
import { initDatabases } from "@/services/databases";
import { appSetup } from "@/services/setup";
import { useAppStore } from "@/stores/app";
import { useCustomSoundsStore } from "@/stores/customSounds";
import { useNotificationStore } from "@/stores/notification";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { AppLogger } from "@/utils/appLogger";

jest.mock("@/screenshot-mode/flag", () => ({ IS_SCREENSHOT_MODE: false }));
jest.mock("@/services/setup", () => ({ appSetup: jest.fn(() => Promise.resolve()) }));
jest.mock("@/services/databases", () => ({ initDatabases: jest.fn(() => Promise.resolve()) }));
jest.mock("@/utils/crashHandler", () => ({ installCrashHandler: jest.fn() }));
jest.mock("@/utils/appLifecycle", () => ({ installLifecycleLogging: jest.fn() }));
jest.mock("@/utils/nativeDiagnostics", () => ({
  processNativeDiagnostics: jest.fn(() => Promise.resolve()),
}));

/** Lets the setup's awaited steps run. */
const settle = () => act(async () => {});

beforeEach(() => {
  jest.mocked(appSetup).mockClear();
  jest.mocked(initDatabases).mockClear();
  jest.spyOn(AppLogger, "prune").mockImplementation(() => {});
  useCustomSoundsStore.setState({ initialize: jest.fn(() => Promise.resolve()) });
  useAppStore.setState({ isFirstRun: true });
});
afterEach(() => jest.restoreAllMocks());

// The flow fetches and schedules on its own; app setup waits for its end.
it("runs no app setup while the first run lasts", async () => {
  await renderHook(() => useInitialSetup());
  await settle();

  expect(initDatabases).not.toHaveBeenCalled();
  expect(appSetup).not.toHaveBeenCalled();
});

it("runs app setup once when the first run ends, with the stores' states", async () => {
  await renderHook(() => useInitialSetup());
  await settle();

  await act(async () => useAppStore.setState({ isFirstRun: false }));
  await settle();

  expect(appSetup).toHaveBeenCalledTimes(1);
  expect(appSetup).toHaveBeenCalledWith(
    usePrayerTimesStore.getState(),
    useNotificationStore.getState()
  );
  expect(jest.mocked(initDatabases).mock.invocationCallOrder[0]).toBeLessThan(
    jest.mocked(appSetup).mock.invocationCallOrder[0]
  );
});

it("does not run app setup again on a later render", async () => {
  useAppStore.setState({ isFirstRun: false });
  const view = await renderHook(() => useInitialSetup());
  await settle();

  await view.rerender({});
  await settle();

  expect(appSetup).toHaveBeenCalledTimes(1);
});
