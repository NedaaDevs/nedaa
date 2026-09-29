import { act, renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";
import Storage from "expo-sqlite/kv-store";
import * as ExpoAlarm from "expo-alarm";

import { ALARM_TIMING_MODE, ALARM_TYPE } from "@/constants/Alarm";
import type { SOUND_ASSETS } from "@/constants/sounds";
import { ScheduledAlarmType } from "@/enums/alarm";
import { PlatformType } from "@/enums/app";
import { useAlarmTypeSettings } from "@/hooks/useAlarmTypeSettings";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { DEFAULT_VIBRATION_CONFIG, type AlarmType, type TimingConfig } from "@/types/alarm";
import { alarmLog } from "@/utils/alarmReport";
import { scheduleFajrAlarm, scheduleFridayAlarm } from "@/utils/alarmScheduler";

jest.mock("expo-alarm", () => ({ setAlarmSettings: jest.fn() }));
jest.mock("@/utils/alarmScheduler", () => ({
  scheduleFajrAlarm: jest.fn(),
  scheduleFridayAlarm: jest.fn(),
}));
jest.mock("@/utils/alarmReport", () => ({ alarmLog: { e: jest.fn() } }));

const mockCancel = jest.fn();
jest.mock("@/stores/alarm", () => ({
  useAlarmStore: { getState: () => ({ cancelAlarmsByType: mockCancel }) },
}));

const setNative = jest.mocked(ExpoAlarm.setAlarmSettings);
const scheduleFajr = jest.mocked(scheduleFajrAlarm);
const scheduleFriday = jest.mocked(scheduleFridayAlarm);

const ALARM_ID = "alarm-id";
const BUNDLED_SOUND: keyof typeof SOUND_ASSETS = "makkahAthan1";
const BEFORE_15: TimingConfig = { mode: ALARM_TIMING_MODE.BEFORE_PRAYER_TIME, minutesBefore: 15 };
const INITIAL = useAlarmSettingsStore.getState();

// Golden bytes: a change here orphans every saved alarm setting.
const PERSISTED_KEY = "alarm-settings-storage";
const PERSISTED =
  '{"state":{"fajr":{"enabled":true,"sound":"makkahAthan1","volume":0.5,"timing":{"mode":"atPrayerTime","minutesBefore":0},"challenge":{"type":"tap","difficulty":"easy","count":1},"gentleWakeUp":{"enabled":false,"durationMinutes":3},"vibration":{"enabled":true,"pattern":"default"},"snooze":{"enabled":true,"maxCount":3,"durationMinutes":5}},"friday":{"enabled":false,"sound":"beep","volume":1,"timing":{"mode":"beforePrayerTime","minutesBefore":30},"challenge":{"type":"tap","difficulty":"easy","count":1},"gentleWakeUp":{"enabled":false,"durationMinutes":3},"vibration":{"enabled":true,"pattern":"default"},"snooze":{"enabled":true,"maxCount":3,"durationMinutes":5}}},"version":0}';

const mount = (alarmType: AlarmType) => renderHook(() => useAlarmTypeSettings(alarmType));

const enableInStore = (alarmType: AlarmType) =>
  useAlarmSettingsStore.setState({
    [alarmType]: { ...useAlarmSettingsStore.getState()[alarmType], enabled: true },
  });

const onPlatform = (os: PlatformType) => jest.replaceProperty(Platform, "OS", os);

describe("useAlarmTypeSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAlarmSettingsStore.setState(INITIAL, true);
    setNative.mockResolvedValue(true);
    scheduleFajr.mockResolvedValue(ALARM_ID);
    scheduleFriday.mockResolvedValue(ALARM_ID);
    mockCancel.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("persists the bytes alarm-settings-storage has always held", async () => {
    onPlatform(PlatformType.ANDROID);
    const { result } = await mount(ALARM_TYPE.FAJR);

    await act(() => result.current.setEnabled(true));
    await act(async () => {
      result.current.update({ sound: BUNDLED_SOUND });
      result.current.update({ volume: 0.5 });
    });

    expect(jest.mocked(Storage.setItem).mock.calls.at(-1)).toEqual([PERSISTED_KEY, PERSISTED]);
  });

  it("reads the settings of its own type", async () => {
    enableInStore(ALARM_TYPE.FRIDAY);
    const { result } = await mount(ALARM_TYPE.FRIDAY);

    expect(result.current.settings).toBe(useAlarmSettingsStore.getState().friday);
  });

  it("writes native settings under the scheduled type, the sound by its file name", async () => {
    onPlatform(PlatformType.IOS);
    const { result } = await mount(ALARM_TYPE.FRIDAY);

    await act(async () => result.current.update({ sound: BUNDLED_SOUND, volume: 0.5 }));

    expect(setNative).toHaveBeenCalledWith(ScheduledAlarmType.JUMMAH, {
      sound: "makkah_athan1",
      volume: 0.5,
    });
  });

  it("sends the Android-only settings on Android alone", async () => {
    const vibration = { ...DEFAULT_VIBRATION_CONFIG, enabled: false };

    onPlatform(PlatformType.IOS);
    const ios = await mount(ALARM_TYPE.FAJR);
    await act(async () => ios.result.current.update({ vibration }));
    expect(setNative).not.toHaveBeenCalled();

    onPlatform(PlatformType.ANDROID);
    const android = await mount(ALARM_TYPE.FAJR);
    await act(async () => android.result.current.update({ vibration }));
    expect(setNative).toHaveBeenCalledWith(ScheduledAlarmType.FAJR, {
      vibrationEnabled: vibration.enabled,
      vibrationPattern: vibration.pattern,
    });
  });

  it("rebuilds an enabled alarm once after a burst of timing changes", async () => {
    jest.useFakeTimers();
    onPlatform(PlatformType.ANDROID);
    enableInStore(ALARM_TYPE.FAJR);
    const { result } = await mount(ALARM_TYPE.FAJR);

    await act(async () => {
      result.current.update({ timing: BEFORE_15 });
      result.current.update({ timing: { ...BEFORE_15, minutesBefore: 20 } });
    });
    expect(scheduleFajr).not.toHaveBeenCalled();

    await act(() => jest.runAllTimersAsync());

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockCancel).toHaveBeenCalledWith(ScheduledAlarmType.FAJR);
    expect(scheduleFajr).toHaveBeenCalledTimes(1);
  });

  it("keeps the existing alarm when the native write fails", async () => {
    jest.useFakeTimers();
    onPlatform(PlatformType.ANDROID);
    setNative.mockResolvedValue(false);
    enableInStore(ALARM_TYPE.FRIDAY);
    const { result } = await mount(ALARM_TYPE.FRIDAY);

    await act(async () => result.current.update({ timing: BEFORE_15 }));
    await act(() => jest.runAllTimersAsync());

    expect(mockCancel).not.toHaveBeenCalled();
    expect(scheduleFriday).not.toHaveBeenCalled();
    expect(alarmLog.e).toHaveBeenCalled();
  });

  it.each([
    [PlatformType.IOS, 1],
    [PlatformType.ANDROID, 0],
  ])("rebuilds after a sound change on %s: %i time(s)", async (os, rebuilds) => {
    jest.useFakeTimers();
    onPlatform(os);
    enableInStore(ALARM_TYPE.FAJR);
    const { result } = await mount(ALARM_TYPE.FAJR);

    await act(async () => result.current.update({ sound: BUNDLED_SOUND }));
    await act(() => jest.runAllTimersAsync());

    expect(scheduleFajr).toHaveBeenCalledTimes(rebuilds);
  });

  it("leaves a disabled alarm unscheduled after a timing change", async () => {
    jest.useFakeTimers();
    const { result } = await mount(ALARM_TYPE.FAJR);

    await act(async () => result.current.update({ timing: BEFORE_15 }));
    await act(() => jest.runAllTimersAsync());

    expect(mockCancel).not.toHaveBeenCalled();
    expect(scheduleFajr).not.toHaveBeenCalled();
  });

  it("schedules on enable and turns back off when nothing was scheduled", async () => {
    scheduleFajr.mockResolvedValue(null);
    const { result } = await mount(ALARM_TYPE.FAJR);

    await act(() => result.current.setEnabled(true));

    expect(scheduleFajr).toHaveBeenCalledTimes(1);
    expect(setNative.mock.calls).toEqual([
      [ScheduledAlarmType.FAJR, { enabled: true }],
      [ScheduledAlarmType.FAJR, { enabled: false }],
    ]);
    expect(result.current.settings.enabled).toBe(false);
  });

  it("turns back off when scheduling throws", async () => {
    scheduleFriday.mockRejectedValue(new Error("native refusal"));
    const { result } = await mount(ALARM_TYPE.FRIDAY);

    await act(() => result.current.setEnabled(true));

    expect(result.current.settings.enabled).toBe(false);
  });

  it("cancels the scheduled type on disable", async () => {
    enableInStore(ALARM_TYPE.FRIDAY);
    const { result } = await mount(ALARM_TYPE.FRIDAY);

    await act(() => result.current.setEnabled(false));

    expect(mockCancel).toHaveBeenCalledWith(ScheduledAlarmType.JUMMAH);
    expect(result.current.settings.enabled).toBe(false);
  });

  // The sheet and the screen can both be mounted; one lock serves them.
  it("serializes toggles made from two mounts of one type", async () => {
    let finishScheduling: (id: string | null) => void = () => {};
    scheduleFajr.mockReturnValueOnce(
      new Promise((resolve) => {
        finishScheduling = resolve;
      })
    );
    const sheet = await mount(ALARM_TYPE.FAJR);
    const screen = await mount(ALARM_TYPE.FAJR);

    let toggles: Promise<unknown> = Promise.resolve();
    await act(async () => {
      toggles = Promise.all([
        sheet.result.current.setEnabled(true),
        screen.result.current.setEnabled(false),
      ]);
    });
    expect(mockCancel).not.toHaveBeenCalled();

    await act(async () => {
      finishScheduling(ALARM_ID);
      await toggles;
    });

    expect(mockCancel).toHaveBeenCalledWith(ScheduledAlarmType.FAJR);
    expect(useAlarmSettingsStore.getState().fajr.enabled).toBe(false);
  });
});
