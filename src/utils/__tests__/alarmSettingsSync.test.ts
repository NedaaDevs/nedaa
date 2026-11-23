import { Platform } from "react-native";
import * as ExpoAlarm from "expo-alarm";

import { ALARM_TYPE } from "@/constants/Alarm";
import { WAKE_TASK_ID } from "@/constants/WakeTask";
import { ScheduledAlarmType } from "@/enums/alarm";
import { PlatformType, type PlatformTypeValue } from "@/enums/app";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import type { AlarmType, WakeTask } from "@/types/alarm";
import { alarmLog } from "@/utils/alarmReport";
import { pushSavedWakeTasks } from "@/utils/alarmSettingsSync";

jest.mock("expo-alarm", () => ({
  ...jest.requireActual("expo-alarm"),
  setAlarmSettings: jest.fn(),
}));
jest.mock("@/utils/alarmReport", () => ({ alarmLog: { e: jest.fn(), w: jest.fn() } }));

const setNative = jest.mocked(ExpoAlarm.setAlarmSettings);
const INITIAL = useAlarmSettingsStore.getState();
const STACK: readonly WakeTask[] = [
  { id: WAKE_TASK_ID.MATH, difficulty: ExpoAlarm.CHALLENGE_DIFFICULTY.HARD, steps: 3 },
  { id: WAKE_TASK_ID.TAP },
];

const onPlatform = (os: PlatformTypeValue) => jest.replaceProperty(Platform, "OS", os);
const hydrated = (done: boolean) =>
  jest.spyOn(useAlarmSettingsStore.persist, "hasHydrated").mockReturnValue(done);
const save = (alarmType: AlarmType, tasks: readonly WakeTask[]) =>
  useAlarmSettingsStore.getState().updateSettings(alarmType, { tasks });

beforeEach(() => {
  jest.clearAllMocks();
  useAlarmSettingsStore.setState(INITIAL, true);
  setNative.mockResolvedValue(true);
  hydrated(true);
});
afterEach(() => jest.restoreAllMocks());

describe("pushSavedWakeTasks", () => {
  it("writes each alarm's saved stack and its challenge to Android", async () => {
    onPlatform(PlatformType.ANDROID);
    save(ALARM_TYPE.FAJR, STACK);
    const { challenge } = useAlarmSettingsStore.getState()[ALARM_TYPE.FAJR];

    await pushSavedWakeTasks();

    expect(setNative).toHaveBeenCalledTimes(Object.values(ALARM_TYPE).length);
    expect(setNative).toHaveBeenCalledWith(ScheduledAlarmType.FAJR, {
      challengeType: challenge.type,
      challengeDifficulty: challenge.difficulty,
      challengeCount: challenge.count,
      tasks: STACK,
    });
    expect(challenge.type).toBe(ExpoAlarm.CHALLENGE_TYPE.MATH);
    expect(setNative).toHaveBeenCalledWith(
      ScheduledAlarmType.JUMMAH,
      expect.objectContaining({ tasks: INITIAL[ALARM_TYPE.FRIDAY].tasks })
    );
  });

  it("writes nothing while the saved settings are unread", async () => {
    onPlatform(PlatformType.ANDROID);
    hydrated(false);

    await pushSavedWakeTasks();

    expect(setNative).not.toHaveBeenCalled();
  });

  it("writes nothing on iOS", async () => {
    onPlatform(PlatformType.IOS);

    await pushSavedWakeTasks();

    expect(setNative).not.toHaveBeenCalled();
  });

  it("logs a refused write and still writes the next alarm", async () => {
    onPlatform(PlatformType.ANDROID);
    setNative.mockResolvedValueOnce(false);

    await pushSavedWakeTasks();

    expect(alarmLog.e).toHaveBeenCalledTimes(1);
    expect(setNative).toHaveBeenCalledTimes(Object.values(ALARM_TYPE).length);
  });
});
