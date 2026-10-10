import { act, renderHook } from "@testing-library/react-native";

import { STICKY_ACTION_STATE } from "@/constants/StickyActionBar";
import { useApplyCalculation } from "@/hooks/useApplyCalculation";

const mockLoadPrayerTimes = jest.fn<Promise<void>, [boolean?]>(() => Promise.resolve());
const mockSaveSettings = jest.fn(() => Promise.resolve());
const mockMarkSettingsApplied = jest.fn();
const mockScheduleNotifications = jest.fn(() => Promise.resolve());
const mockRescheduleAlarms = jest.fn(() => Promise.resolve());
const mockShowError = jest.fn();
let mockIsModified = true;

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));
jest.mock("@/components/feedback", () => ({
  MessageToast: { showError: (...args: unknown[]) => mockShowError(...args) },
}));
jest.mock("@/stores/prayerTimes", () => ({
  usePrayerTimesStore: () => ({
    loadPrayerTimes: (force?: boolean) => mockLoadPrayerTimes(force),
  }),
}));
jest.mock("@/stores/providerSettings", () => ({
  useProviderSettingsStore: (select: (state: object) => unknown) =>
    select({
      isModified: mockIsModified,
      saveSettings: () => mockSaveSettings(),
      markSettingsApplied: () => mockMarkSettingsApplied(),
    }),
}));
jest.mock("@/stores/notification", () => ({
  useNotificationStore: () => ({ scheduleAllNotifications: mockScheduleNotifications }),
}));
jest.mock("@/utils/alarmScheduler", () => ({
  rescheduleAllAlarms: () => mockRescheduleAlarms(),
}));
jest.mock("../../../modules/expo-widget/src", () => ({ reloadPrayerWidgets: jest.fn() }));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));

const mount = () => renderHook(() => useApplyCalculation());

describe("useApplyCalculation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsModified = true;
  });

  it("hides the action while there is nothing to apply", async () => {
    mockIsModified = false;

    const { result } = await mount();

    expect(result.current.state).toBe(STICKY_ACTION_STATE.HIDDEN);
  });

  it("offers the action once the settings are modified", async () => {
    const { result } = await mount();

    expect(result.current.state).toBe(STICKY_ACTION_STATE.READY);
  });

  it("is busy, with the current step, while it applies", async () => {
    mockLoadPrayerTimes.mockReturnValueOnce(new Promise(() => {}));
    const { result } = await mount();

    await act(async () => {
      void result.current.apply();
      await Promise.resolve();
    });

    expect(result.current.state).toBe(STICKY_ACTION_STATE.BUSY);
    expect(result.current.busy).toBe(true);
    expect(result.current.status).toBe("location.update.step.prayerTimes");
  });

  it("refetches prayer times on every apply, not just the first", async () => {
    const { result } = await mount();

    await act(() => result.current.apply());
    await act(() => result.current.apply());

    expect(mockLoadPrayerTimes).toHaveBeenCalledTimes(2);
    expect(mockLoadPrayerTimes).toHaveBeenNthCalledWith(2, true);
  });

  it("marks the settings applied once the whole pipeline has landed", async () => {
    const { result } = await mount();

    await act(() => result.current.apply());

    expect(mockMarkSettingsApplied).toHaveBeenCalledTimes(1);
  });

  it("reports a failed refetch and stays ready to retry", async () => {
    mockLoadPrayerTimes.mockRejectedValueOnce(new Error("offline"));
    const { result } = await mount();

    await act(() => result.current.apply());

    expect(mockShowError).toHaveBeenCalledWith("providers.saveFailed", {
      action: { label: "common.retry", onPress: expect.any(Function) },
    });
    expect(mockMarkSettingsApplied).not.toHaveBeenCalled();
    expect(result.current.state).toBe(STICKY_ACTION_STATE.READY);
  });

  // The toast's retry must not start a second apply beside one already running.
  it("ignores the toast's retry while an apply is running", async () => {
    mockLoadPrayerTimes.mockRejectedValueOnce(new Error("offline"));
    const { result } = await mount();
    await act(() => result.current.apply());
    const [, { action }] = mockShowError.mock.calls[0];
    mockLoadPrayerTimes.mockReturnValueOnce(new Promise(() => {}));
    mockSaveSettings.mockClear();

    await act(async () => {
      void result.current.apply();
      await Promise.resolve();
    });
    await act(() => action.onPress());

    expect(mockSaveSettings).toHaveBeenCalledTimes(1);
  });

  it("applies again from the toast's retry", async () => {
    mockLoadPrayerTimes.mockRejectedValueOnce(new Error("offline"));
    const { result } = await mount();
    await act(() => result.current.apply());
    const [, { action }] = mockShowError.mock.calls[0];

    await act(() => action.onPress());

    expect(mockMarkSettingsApplied).toHaveBeenCalledTimes(1);
  });

  it("leaves the settings unapplied when rescheduling alarms fails", async () => {
    mockRescheduleAlarms.mockRejectedValueOnce(new Error("alarm store unavailable"));
    const { result } = await mount();

    await act(() => result.current.apply());

    expect(mockMarkSettingsApplied).not.toHaveBeenCalled();
  });
});
