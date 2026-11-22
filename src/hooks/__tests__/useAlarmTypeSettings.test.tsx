import { act, renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";
import Storage from "expo-sqlite/kv-store";
import * as ExpoAlarm from "expo-alarm";

import { ALARM_TIMING_MODE, ALARM_TYPE } from "@/constants/Alarm";
import { WAKE_TASK_ID } from "@/constants/WakeTask";
import type { SOUND_ASSETS } from "@/constants/sounds";
import { ScheduledAlarmType } from "@/enums/alarm";
import { PlatformType, type PlatformTypeValue } from "@/enums/app";
import { useAlarmTypeSettings } from "@/hooks/useAlarmTypeSettings";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import {
  DEFAULT_VIBRATION_CONFIG,
  type AlarmType,
  type TimingConfig,
  type WakeTask,
} from "@/types/alarm";
import { alarmLog } from "@/utils/alarmReport";
import { scheduleFajrAlarm, scheduleFridayAlarm } from "@/utils/alarmScheduler";
import { legacyChallengeFromWakeTasks, wakeTasksFromLegacyChallenge } from "@/utils/wakeTasks";

jest.mock("expo-alarm", () => ({
  ...jest.requireActual("expo-alarm"),
  setAlarmSettings: jest.fn(),
}));
jest.mock("@/utils/alarmScheduler", () => ({
  scheduleFajrAlarm: jest.fn(),
  scheduleFridayAlarm: jest.fn(),
}));
jest.mock("@/utils/alarmReport", () => ({ alarmLog: { e: jest.fn(), w: jest.fn() } }));

const mockCancel = jest.fn();
const mockScheduleAlarm = jest.fn(async (_params: object) => true);
jest.mock("@/stores/alarm", () => ({
  useAlarmStore: {
    getState: () => ({ cancelAlarmsByType: mockCancel, scheduleAlarm: mockScheduleAlarm }),
    persist: {},
  },
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
  '{"state":{"fajr":{"enabled":true,"sound":"makkahAthan1","volume":0.5,"timing":{"mode":"atPrayerTime","minutesBefore":0},"challenge":{"type":"tap","difficulty":"medium","count":1},"tasks":[{"id":"tap"}],"gentleWakeUp":{"enabled":false,"durationMinutes":3},"vibration":{"enabled":true,"pattern":"default"},"snooze":{"enabled":true,"maxCount":3,"durationMinutes":5}},"friday":{"enabled":false,"sound":"beep","volume":1,"timing":{"mode":"beforePrayerTime","minutesBefore":30},"challenge":{"type":"tap","difficulty":"medium","count":1},"tasks":[{"id":"tap"}],"gentleWakeUp":{"enabled":false,"durationMinutes":3},"vibration":{"enabled":true,"pattern":"default"},"snooze":{"enabled":true,"maxCount":3,"durationMinutes":5}}},"version":0}';

const mount = (alarmType: AlarmType) => renderHook(() => useAlarmTypeSettings(alarmType));

const enableInStore = (alarmType: AlarmType) =>
  useAlarmSettingsStore.setState({
    [alarmType]: { ...useAlarmSettingsStore.getState()[alarmType], enabled: true },
  });

const onPlatform = (os: PlatformTypeValue) => jest.replaceProperty(Platform, "OS", os);

describe("useAlarmTypeSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAlarmSettingsStore.setState(INITIAL, true);
    usePrayerTimesStore.setState({ usingDefaultLocation: false });
    setNative.mockResolvedValue(true);
    scheduleFajr.mockResolvedValue(ALARM_ID);
    scheduleFriday.mockResolvedValue(ALARM_ID);
    mockCancel.mockResolvedValue(true);
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

  it("keeps a stack off the iOS settings", async () => {
    onPlatform(PlatformType.IOS);
    const { result } = await mount(ALARM_TYPE.FAJR);

    await act(async () => result.current.update({ tasks: [{ id: WAKE_TASK_ID.PRAYERS }] }));

    expect(setNative).not.toHaveBeenCalled();
  });

  it("sends a stack to Android with the challenge its overlay runs", async () => {
    onPlatform(PlatformType.ANDROID);
    const math = {
      id: WAKE_TASK_ID.MATH,
      difficulty: ExpoAlarm.CHALLENGE_DIFFICULTY.HARD,
      steps: 4,
    } as const satisfies WakeTask;
    const { result } = await mount(ALARM_TYPE.FAJR);

    await act(async () => result.current.update({ tasks: [math, { id: WAKE_TASK_ID.TAP }] }));

    expect(setNative).toHaveBeenCalledWith(ScheduledAlarmType.FAJR, {
      challengeType: ExpoAlarm.CHALLENGE_TYPE.MATH,
      challengeDifficulty: math.difficulty,
      challengeCount: math.steps,
      tasks: [math, { id: WAKE_TASK_ID.TAP }],
    });
    expect(result.current.settings.challenge.type).toBe(ExpoAlarm.CHALLENGE_TYPE.MATH);
  });

  // Native takes the pair the store keeps; the mapping decides both.
  it.each<WakeTask[]>([
    [],
    [{ id: WAKE_TASK_ID.PATTERN, difficulty: ExpoAlarm.CHALLENGE_DIFFICULTY.MEDIUM, steps: 2 }],
    [{ id: WAKE_TASK_ID.PRAYERS }, { id: WAKE_TASK_ID.DHIKR, steps: 3 }],
    [
      { id: WAKE_TASK_ID.DHIKR, steps: 5 },
      { id: WAKE_TASK_ID.TAP },
      { id: WAKE_TASK_ID.MATH, difficulty: ExpoAlarm.CHALLENGE_DIFFICULTY.EASY, steps: 1 },
    ],
  ])("stores and sends the stack %j as the mapping writes it", async (...tasks) => {
    onPlatform(PlatformType.ANDROID);
    const expected = legacyChallengeFromWakeTasks(tasks);
    const { result } = await mount(ALARM_TYPE.FAJR);

    await act(async () => result.current.update({ tasks }));

    expect(result.current.settings.tasks).toEqual(tasks);
    expect(result.current.settings.challenge).toEqual(expected);
    expect(setNative).toHaveBeenCalledWith(ScheduledAlarmType.FAJR, {
      challengeType: expected.type,
      challengeDifficulty: expected.difficulty,
      challengeCount: expected.count,
      tasks,
    });
  });

  // A challenge write, as the debug screen makes, keeps what a stack cannot.
  it.each([
    {
      type: ExpoAlarm.CHALLENGE_TYPE.TAP,
      difficulty: ExpoAlarm.CHALLENGE_DIFFICULTY.EASY,
      count: 3,
    },
    {
      type: ExpoAlarm.CHALLENGE_TYPE.MATH,
      difficulty: ExpoAlarm.CHALLENGE_DIFFICULTY.HARD,
      count: 7,
    },
    {
      type: ExpoAlarm.CHALLENGE_TYPE.DHIKR,
      difficulty: ExpoAlarm.CHALLENGE_DIFFICULTY.HARD,
      count: 3,
    },
  ] as const)("stores and sends a picked $type challenge as picked", async (challenge) => {
    onPlatform(PlatformType.ANDROID);
    const { result } = await mount(ALARM_TYPE.FAJR);

    await act(async () => result.current.update({ challenge }));

    expect(result.current.settings.challenge).toEqual(challenge);
    expect(setNative).toHaveBeenCalledWith(ScheduledAlarmType.FAJR, {
      challengeType: challenge.type,
      challengeDifficulty: challenge.difficulty,
      challengeCount: challenge.count,
      tasks: wakeTasksFromLegacyChallenge(challenge),
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

  it("logs a rebuild that throws", async () => {
    jest.useFakeTimers();
    scheduleFajr.mockRejectedValue(new Error("native refusal"));
    enableInStore(ALARM_TYPE.FAJR);
    const { result } = await mount(ALARM_TYPE.FAJR);

    await act(async () => result.current.update({ timing: BEFORE_15 }));
    await act(() => jest.runAllTimersAsync());

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

  // The scheduler refuses the default location's times; the switch follows it.
  it("stays off at the default location's times, with the real scheduler", async () => {
    const actual = jest.requireActual<{ scheduleFajrAlarm: typeof scheduleFajrAlarm }>(
      "@/utils/alarmScheduler"
    );
    scheduleFajr.mockImplementation(actual.scheduleFajrAlarm);
    const fajr = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    const today = { timezone: "UTC", timings: { fajr } } as unknown as DayPrayerTimes;
    usePrayerTimesStore.setState({
      usingDefaultLocation: true,
      todayTimings: today,
      tomorrowTimings: null,
      twoWeeksTimings: [today],
    });
    const { result } = await mount(ALARM_TYPE.FAJR);

    await act(() => result.current.setEnabled(true));

    expect(mockScheduleAlarm).not.toHaveBeenCalled();
    expect(result.current.settings.enabled).toBe(false);
  });

  it("cancels the scheduled type on disable", async () => {
    enableInStore(ALARM_TYPE.FRIDAY);
    const { result } = await mount(ALARM_TYPE.FRIDAY);

    await act(() => result.current.setEnabled(false));

    expect(mockCancel).toHaveBeenCalledWith(ScheduledAlarmType.JUMMAH);
    expect(result.current.settings.enabled).toBe(false);
  });

  it("keeps the switch on when the alarm cannot be cancelled", async () => {
    mockCancel.mockResolvedValue(false);
    enableInStore(ALARM_TYPE.FRIDAY);
    const { result } = await mount(ALARM_TYPE.FRIDAY);

    await act(() => result.current.setEnabled(false));

    expect(result.current.settings.enabled).toBe(true);
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
