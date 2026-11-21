import { act, renderHook } from "@testing-library/react-native";
import { ALARM_OUTCOME } from "expo-alarm";

import { ALARM_TIMING_MODE, ALARM_TYPE } from "@/constants/Alarm";
import { ScheduledAlarmType } from "@/enums/alarm";
import { useAlarmTypeSettings } from "@/hooks/useAlarmTypeSettings";
import { useAlarmStore } from "@/stores/alarm";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useAlarmStreakStore } from "@/stores/alarmStreak";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { argsOf, nativeResults, resetNativeLog } from "@/test-helpers/expoAlarmLog";
import { resetMemoryKv } from "@/test-helpers/memoryKvStore";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { detectActiveAlarm } from "@/utils/activeAlarmDetector";
import { isAlarmDue } from "@/utils/alarmDue";
import { completeAndRescheduleAlarm, rescheduleAllAlarms } from "@/utils/alarmScheduler";
import { quietEndsAt } from "@/utils/emergencyQuiet";
import { toLocalDateISO } from "@/utils/streak";

jest.mock("expo-alarm", () => jest.requireActual("@/test-helpers/expoAlarmLog").expoAlarmLogModule);
jest.mock(
  "expo-sqlite/kv-store",
  () => jest.requireActual("@/test-helpers/memoryKvStore").memoryKvStoreModule
);
jest.mock("@/localization/i18n", () => ({ __esModule: true, default: { t: (k: string) => k } }));
jest.mock("@/utils/alarmReport", () => ({
  alarmLog: { i: jest.fn(), w: jest.fn(), e: jest.fn() },
}));
// The stored times are for a verified place.
jest.mock("@/utils/timesPlace", () => {
  const { TIMES_PLACE } = jest.requireActual("@/constants/Location");
  return { readTimesPlace: async () => TIMES_PLACE.VERIFIED };
});

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const RINGING_ID = "11111111-1111-4111-8111-111111111111";
const START = new Date(2026, 10, 21, 5, 1);
const INITIAL_SETTINGS = useAlarmSettingsStore.getState();

/** Rings a Fajr alarm that fired `rangFor` ago, then quiets it. */
const ringThenQuiet = async (
  rangFor = MINUTE_MS
): Promise<{ quietId: string; ringsAt: number }> => {
  const store = useAlarmStore.getState();
  await store.scheduleAlarm({
    id: RINGING_ID,
    triggerDate: new Date(Date.now() - rangFor),
    title: ScheduledAlarmType.FAJR,
    alarmType: ScheduledAlarmType.FAJR,
  });
  const result = await store.quietAlarm(RINGING_ID, {
    ringsAt: new Date(quietEndsAt(Date.now())),
    recordUse: () => undefined,
    silence: () => undefined,
  });
  if (!result) throw new Error("the quiet failed");
  resetNativeLog();
  return { quietId: result.quietId, ringsAt: result.ringsAt.getTime() };
};

const expectKept = (quietId: string) => {
  expect(useAlarmStore.getState().scheduledAlarms[quietId]).toBeDefined();
  expect(argsOf("cancelAlarm")).not.toContainEqual([quietId]);
};

beforeEach(() => {
  jest.useFakeTimers({ now: START });
  resetNativeLog();
  resetMemoryKv();
  useAlarmStore.setState({ scheduledAlarms: {} });
  useAlarmSettingsStore.setState(
    { ...INITIAL_SETTINGS, fajr: { ...INITIAL_SETTINGS.fajr, enabled: true } },
    true
  );
  const tomorrow = {
    timezone: "UTC",
    timings: { fajr: new Date(START.getTime() + 24 * HOUR_MS).toISOString() },
  } as unknown as DayPrayerTimes;
  usePrayerTimesStore.setState({
    todayTimings: null,
    tomorrowTimings: tomorrow,
    twoWeeksTimings: [],
  });
  useAlarmStreakStore.setState({
    streak: 3,
    bestStreak: 3,
    lastSuccessDate: toLocalDateISO(START.getTime() - 24 * HOUR_MS),
    lastHeldDate: null,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("a running emergency quiet's re-ring", () => {
  it("stays armed when the alarm is switched off", async () => {
    const { quietId } = await ringThenQuiet();
    const { result } = await renderHook(() => useAlarmTypeSettings(ALARM_TYPE.FAJR));

    await act(() => result.current.setEnabled(false));

    expectKept(quietId);
  });

  it("stays armed when every alarm is moved to new times", async () => {
    const { quietId } = await ringThenQuiet();

    await rescheduleAllAlarms();

    expect(argsOf("scheduleAlarm")).not.toHaveLength(0);
    expectKept(quietId);
  });

  it("stays armed when a timing change rebuilds the alarm", async () => {
    const { quietId } = await ringThenQuiet();
    const { result } = await renderHook(() => useAlarmTypeSettings(ALARM_TYPE.FAJR));

    await act(async () =>
      result.current.update({
        timing: { mode: ALARM_TIMING_MODE.BEFORE_PRAYER_TIME, minutesBefore: 15 },
      })
    );
    await act(() => jest.advanceTimersByTimeAsync(MINUTE_MS));

    expect(argsOf("scheduleAlarm")).not.toHaveLength(0);
    expectKept(quietId);
  });

  it("is cancelled with its type once the quiet is over", async () => {
    const { quietId, ringsAt } = await ringThenQuiet();
    jest.setSystemTime(ringsAt);

    await useAlarmStore.getState().cancelAlarmsByType(ScheduledAlarmType.FAJR);

    expect(argsOf("cancelAlarm")).toContainEqual([quietId]);
  });
});

describe("a relaunch during the quiet", () => {
  it("finds the quieted alarm still owed, and opens its screen", async () => {
    const { quietId } = await ringThenQuiet();
    nativeResults.getCompletedAlarmIds = [RINGING_ID];
    nativeResults.getFutureAlarmIds = [];
    nativeResults.getPendingChallenge = null;
    const { scheduledAlarms } = useAlarmStore.getState();

    const active = await detectActiveAlarm(scheduledAlarms);

    expect(active).toMatchObject({ alarmId: quietId, alarmType: ScheduledAlarmType.FAJR });
    expect(
      isAlarmDue({
        alarmId: quietId,
        record: scheduledAlarms[quietId],
        pendingAlarmId: null,
        now: Date.now(),
      })
    ).toBe(true);
  });
});

describe("the Fajr streak after a quiet", () => {
  it("grows when the task is solved during the quiet", async () => {
    const { quietId } = await ringThenQuiet();

    await completeAndRescheduleAlarm(quietId, { outcome: ALARM_OUTCOME.SOLVED });

    expect(useAlarmStreakStore.getState().streak).toBe(4);
  });

  it("holds when the alarm is stopped after it rings again", async () => {
    const { quietId, ringsAt } = await ringThenQuiet();
    jest.setSystemTime(ringsAt + MINUTE_MS);

    await completeAndRescheduleAlarm(quietId, { outcome: ALARM_OUTCOME.STOPPED });

    expect(useAlarmStreakStore.getState()).toMatchObject({
      streak: 3,
      lastHeldDate: toLocalDateISO(Date.now()),
    });
  });

  it("counts from the first ring, so a solve past its hour is a missed morning", async () => {
    const { quietId } = await ringThenQuiet(58 * MINUTE_MS);
    jest.advanceTimersByTime(3 * MINUTE_MS);

    await completeAndRescheduleAlarm(quietId, { outcome: ALARM_OUTCOME.SOLVED });

    expect(useAlarmStreakStore.getState().streak).toBe(3);
  });
});
