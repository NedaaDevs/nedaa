import { act, renderHook } from "@testing-library/react-native";

import { STICKY_ACTION_STATE } from "@/constants/StickyActionBar";
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { useApplyCalculation } from "@/hooks/useApplyCalculation";
import { useProviderSettingsStore } from "@/stores/providerSettings";

const mockLoadPrayerTimes = jest.fn<Promise<void>, [boolean?]>(() => Promise.resolve());
const mockScheduleNotifications = jest.fn(() => Promise.resolve());
const mockRescheduleAlarms = jest.fn(() => Promise.resolve());
const mockShowError = jest.fn();

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
jest.mock("@/stores/notification", () => ({
  useNotificationStore: () => ({ scheduleAllNotifications: mockScheduleNotifications }),
}));
jest.mock("@/utils/alarmScheduler", () => ({
  rescheduleAllAlarms: () => mockRescheduleAlarms(),
}));
jest.mock("expo-widget", () => ({ reloadPrayerWidgets: jest.fn() }));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));

const mount = () => renderHook(() => useApplyCalculation());
const store = () => useProviderSettingsStore.getState();
/** Applied: the draft is gone and the saved method is the applied one. */
const applied = () => !store().isModified && store().getCurrentSettings()?.method === 4;

describe("useApplyCalculation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProviderSettingsStore.setState({
      currentProviderId: PRAYER_TIME_PROVIDERS.ALADHAN.id,
      allSettings: { [PRAYER_TIME_PROVIDERS.ALADHAN.id]: { method: 3 } },
      draft: null,
      isModified: false,
      pendingReapply: false,
      applying: false,
      applyStep: null,
    });
    store().updateCurrentSettings({ method: 4 });
  });

  it("hides the action while there is nothing to apply", async () => {
    store().updateCurrentSettings({ method: 3 });

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

    expect(applied()).toBe(true);
  });

  // A screen reopened mid-apply mounts a fresh hook; the lock must reach it.
  it("is busy on a second screen while the first one applies", async () => {
    mockLoadPrayerTimes.mockReturnValueOnce(new Promise(() => {}));
    const first = await mount();
    await act(async () => {
      void first.result.current.apply();
      await Promise.resolve();
    });

    const second = await mount();
    await act(() => second.result.current.apply());

    expect(second.result.current.busy).toBe(true);
    expect(mockLoadPrayerTimes).toHaveBeenCalledTimes(1);
  });

  it("reports a failed refetch and stays ready to retry", async () => {
    mockLoadPrayerTimes.mockRejectedValueOnce(new Error("offline"));
    const { result } = await mount();

    await act(() => result.current.apply());

    expect(mockShowError).toHaveBeenCalledWith("providers.saveFailed", {
      action: { label: "common.retry", onPress: expect.any(Function) },
    });
    expect(applied()).toBe(false);
    expect(result.current.state).toBe(STICKY_ACTION_STATE.READY);
  });

  // The toast's retry must not start a second apply beside one already running.
  it("ignores the toast's retry while an apply is running", async () => {
    mockLoadPrayerTimes.mockRejectedValueOnce(new Error("offline"));
    const { result } = await mount();
    await act(() => result.current.apply());
    const [, { action }] = mockShowError.mock.calls[0];
    mockLoadPrayerTimes.mockReturnValueOnce(new Promise(() => {}));
    mockLoadPrayerTimes.mockClear();

    await act(async () => {
      void result.current.apply();
      await Promise.resolve();
    });
    await act(() => action.onPress());

    expect(mockLoadPrayerTimes).toHaveBeenCalledTimes(1);
  });

  it("applies again from the toast's retry", async () => {
    mockLoadPrayerTimes.mockRejectedValueOnce(new Error("offline"));
    const { result } = await mount();
    await act(() => result.current.apply());
    const [, { action }] = mockShowError.mock.calls[0];

    await act(() => action.onPress());

    expect(applied()).toBe(true);
  });

  it("leaves the settings unapplied when rescheduling alarms fails", async () => {
    mockRescheduleAlarms.mockRejectedValueOnce(new Error("alarm store unavailable"));
    const { result } = await mount();

    await act(() => result.current.apply());

    expect(applied()).toBe(false);
  });
});
