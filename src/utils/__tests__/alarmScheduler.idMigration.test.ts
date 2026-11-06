import { ALARM_OUTCOME } from "expo-alarm";
import { ScheduledAlarmType } from "@/enums/alarm";
import { type ScheduledAlarm, useAlarmStore } from "@/stores/alarm";
import { argsOf, nativeCalls, nativeResults, resetNativeLog } from "@/test-helpers/expoAlarmLog";
import { resetMemoryKv } from "@/test-helpers/memoryKvStore";
import { DEFAULT_TIMING_CONFIG, type TimingConfig } from "@/types/alarm";
import { generateDeterministicUUID, getAlarmKey, getLegacyAlarmKey } from "@/utils/alarmId";
import { completeAndRescheduleAlarm, ensureAlarmsScheduled } from "@/utils/alarmScheduler";

jest.mock("expo-alarm", () => jest.requireActual("@/test-helpers/expoAlarmLog").expoAlarmLogModule);
jest.mock(
  "expo-sqlite/kv-store",
  () => jest.requireActual("@/test-helpers/memoryKvStore").memoryKvStoreModule
);
jest.mock("@/localization/i18n", () => ({ __esModule: true, default: { t: (k: string) => k } }));
jest.mock("@/utils/alarmReport", () => ({
  alarmLog: { i: jest.fn(), w: jest.fn(), e: jest.fn() },
}));
jest.mock("@/stores/alarmStreak", () => ({
  useAlarmStreakStore: { getState: () => ({ recordFajrSuccess: mockRecordFajrSuccess }) },
}));
jest.mock("@/stores/alarmSettings", () => ({
  useAlarmSettingsStore: { getState: () => mockSettings },
}));
// The planner arms only for a verified place.
jest.mock("@/utils/timesPlace", () => {
  const { TIMES_PLACE } = jest.requireActual("@/constants/Location");
  return { readTimesPlace: async () => TIMES_PLACE.VERIFIED };
});
jest.mock("@/stores/prayerTimes", () => ({
  usePrayerTimesStore: { getState: () => mockTimes },
}));

const { FAJR, JUMMAH } = ScheduledAlarmType;
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

type TypeSettings = { enabled: boolean; timing: TimingConfig };
type PrayerDay = { timings: { fajr?: string; dhuhr?: string }; timezone: string };
type NativeAlarm = { id: string; triggerDate: Date; alarmType: ScheduledAlarmType };

const mockRecordFajrSuccess = jest.fn();
const settingsOf = (): { fajr: TypeSettings; friday: TypeSettings } => ({
  fajr: { enabled: true, timing: DEFAULT_TIMING_CONFIG },
  friday: { enabled: false, timing: { mode: "beforePrayerTime", minutesBefore: 30 } },
});
const mockSettings = settingsOf();
const mockTimes: {
  todayTimings: PrayerDay | null;
  tomorrowTimings: PrayerDay | null;
  twoWeeksTimings: PrayerDay[];
} = { todayTimings: null, tomorrowTimings: null, twoWeeksTimings: [] };

const setDays = (days: PrayerDay[]) =>
  Object.assign(mockTimes, {
    todayTimings: days[0] ?? null,
    tomorrowTimings: days[1] ?? null,
    twoWeeksTimings: days,
  });
const fajrDays = (times: readonly string[], timezone: string): PrayerDay[] =>
  times.map((fajr) => ({ timings: { fajr }, timezone }));
const dhuhrDays = (times: readonly string[], timezone: string): PrayerDay[] =>
  times.map((dhuhr) => ({ timings: { dhuhr }, timezone }));
const at = (time: string): number => new Date(time).getTime();

const idAt = (type: ScheduledAlarmType, time: string): string =>
  generateDeterministicUUID(getAlarmKey(type, new Date(time)));
const alarmAt = (
  type: ScheduledAlarmType,
  time: string,
  alarmId = idAt(type, time)
): ScheduledAlarm => ({
  alarmId,
  alarmType: type,
  title: type,
  triggerTime: at(time),
  liveActivityId: null,
  snoozeCount: 0,
});
// TODO(alarm-id-migration): a 2.x alarm, its id keyed on the UTC date.
const legacyAlarm = (type: ScheduledAlarmType, time: string): ScheduledAlarm =>
  alarmAt(type, time, generateDeterministicUUID(getLegacyAlarmKey(type, new Date(time))));
const seed = (...alarms: ScheduledAlarm[]) =>
  useAlarmStore.setState({
    scheduledAlarms: Object.fromEntries(alarms.map((alarm) => [alarm.alarmId, alarm])),
  });
// The store's alarms as [id, trigger], by trigger.
const stored = (): [string, string][] =>
  Object.values(useAlarmStore.getState().scheduledAlarms)
    .sort((a, b) => a.triggerTime - b.triggerTime)
    .map((alarm) => [alarm.alarmId, new Date(alarm.triggerTime).toISOString()]);
// Arms and cancels as [name, id], in order.
const armsAndCancels = (): [string, string][] =>
  nativeCalls.flatMap(([name, [arg]]): [string, string][] => {
    if (name === "scheduleAlarm") return [[name, (arg as NativeAlarm).id]];
    if (name === "cancelAlarm") return [[name, arg as string]];
    return [];
  });

const RIYADH = [
  "2026-10-27T01:40:00.000Z",
  "2026-10-28T01:41:00.000Z",
  "2026-10-29T01:42:00.000Z",
] as const;
// Tue 27 Oct to Mon 2 Nov with Riyadh's Fajr; the Friday is the 30th.
const RIYADH_WEEK: PrayerDay[] = Array.from({ length: 7 }, (_, k) => ({
  timings: {
    fajr: new Date(at(RIYADH[0]) + k * (DAY + MINUTE)).toISOString(),
    dhuhr: new Date(at("2026-10-27T09:25:00.000Z") + k * DAY).toISOString(),
  },
  timezone: "Asia/Riyadh",
}));
// Fajr crosses UTC midnight: two triggers on 27 Oct, one 2.x id.
const KARACHI = [
  "2026-10-27T00:00:00.000Z",
  "2026-10-27T23:59:00.000Z",
  "2026-10-28T23:58:00.000Z",
] as const;

beforeEach(() => {
  resetNativeLog();
  resetMemoryKv();
  mockRecordFajrSuccess.mockClear();
  nativeResults.getPendingChallenge = null;
  useAlarmStore.setState({ scheduledAlarms: {} });
  Object.assign(mockSettings, settingsOf());
  setDays(fajrDays(RIYADH, "Asia/Riyadh"));
  jest.useFakeTimers({ now: new Date("2026-10-26T20:00:00.000Z") });
});
afterEach(() => jest.useRealTimers());

describe("2.x alarm id migration", () => {
  it("moves 2.x alarms to instant ids on the first ensure", async () => {
    const legacy = RIYADH.slice(0, 2).map((time) => legacyAlarm(FAJR, time));
    seed(...legacy);

    await ensureAlarmsScheduled();

    expect(armsAndCancels()).toEqual([
      ["scheduleAlarm", idAt(FAJR, RIYADH[0])],
      ["scheduleAlarm", idAt(FAJR, RIYADH[1])],
      ["cancelAlarm", legacy[0].alarmId],
      ["cancelAlarm", legacy[1].alarmId],
    ]);
    expect(argsOf("deleteAlarmFromDB")).toEqual(legacy.map((alarm) => [alarm.alarmId]));
    expect(stored()).toEqual([
      [idAt(FAJR, RIYADH[0]), RIYADH[0]],
      [idAt(FAJR, RIYADH[1]), RIYADH[1]],
    ]);
  });

  it("restores the Fajr a shared 2.x id dropped", async () => {
    jest.setSystemTime(new Date("2026-10-26T23:00:00.000Z"));
    setDays(fajrDays(KARACHI, "Asia/Karachi"));
    seed(legacyAlarm(FAJR, KARACHI[1]));

    await ensureAlarmsScheduled();

    expect(stored()).toEqual([
      [idAt(FAJR, KARACHI[0]), KARACHI[0]],
      [idAt(FAJR, KARACHI[1]), KARACHI[1]],
    ]);
  });

  // The alarm screen opens up to a minute before the trigger.
  it.each([
    { solved: "after", solvedAfter: 30_000 },
    { solved: "before", solvedAfter: -30_000 },
  ])(
    "a 2.x completion 30 s $solved its trigger as the first run leaves one alarm per instant",
    async ({ solvedAfter }) => {
      const [rung, next] = RIYADH.slice(0, 2).map((time) => legacyAlarm(FAJR, time));
      seed(rung, next);
      jest.setSystemTime(rung.triggerTime + solvedAfter);

      await completeAndRescheduleAlarm(rung.alarmId);
      await ensureAlarmsScheduled();

      expect(mockRecordFajrSuccess.mock.calls).toEqual([[rung.triggerTime]]);
      expect(stored()).toEqual([
        [idAt(FAJR, RIYADH[1]), RIYADH[1]],
        [idAt(FAJR, RIYADH[2]), RIYADH[2]],
      ]);
    }
  );

  it("a queued Android completion of a 2.x id the store lost re-plans once", async () => {
    const [rung, next] = RIYADH.slice(0, 2).map((time) => legacyAlarm(FAJR, time));
    seed(next);
    jest.setSystemTime(rung.triggerTime + 30_000);

    await completeAndRescheduleAlarm(rung.alarmId, {
      alarmType: FAJR,
      outcome: ALARM_OUTCOME.SOLVED,
    });

    expect(armsAndCancels()).toEqual([
      ["cancelAlarm", rung.alarmId],
      ["scheduleAlarm", idAt(FAJR, RIYADH[1])],
      ["scheduleAlarm", idAt(FAJR, RIYADH[2])],
      ["cancelAlarm", next.alarmId],
    ]);
    expect(stored()).toEqual([
      [idAt(FAJR, RIYADH[1]), RIYADH[1]],
      [idAt(FAJR, RIYADH[2]), RIYADH[2]],
    ]);
  });

  it("leaves a ringing 2.x alarm for its challenge", async () => {
    const [ringing, next] = RIYADH.slice(0, 2).map((time) => legacyAlarm(FAJR, time));
    seed(ringing, next);
    jest.setSystemTime(ringing.triggerTime + MINUTE);

    await ensureAlarmsScheduled();

    expect(argsOf("cancelAlarm")).toEqual([[next.alarmId]]);
    expect(stored()).toEqual([
      [ringing.alarmId, RIYADH[0]],
      [idAt(FAJR, RIYADH[1]), RIYADH[1]],
      [idAt(FAJR, RIYADH[2]), RIYADH[2]],
    ]);
  });

  it("makes no native call once every id names its instant", async () => {
    seed(...RIYADH.slice(0, 2).map((time) => legacyAlarm(FAJR, time)));
    await ensureAlarmsScheduled();
    resetNativeLog();

    await ensureAlarmsScheduled();

    expect(nativeCalls).toEqual([]);
  });

  it("makes no native call while a ringing 2.x alarm waits for its challenge", async () => {
    const [ringing, next] = RIYADH.slice(0, 2).map((time) => legacyAlarm(FAJR, time));
    seed(ringing, next);
    jest.setSystemTime(ringing.triggerTime + MINUTE);
    await ensureAlarmsScheduled();
    resetNativeLog();

    await ensureAlarmsScheduled();

    expect(nativeCalls).toEqual([]);
  });

  it("a 2.x Fajr alarm plans no Jumuah", async () => {
    mockSettings.friday.enabled = true;
    setDays(RIYADH_WEEK);
    // Refused Fajr arms keep the 2.x Fajr alarm past its plan.
    nativeResults.scheduleAlarm = (alarm: NativeAlarm) => alarm.alarmType !== FAJR;
    seed(legacyAlarm(FAJR, RIYADH[0]), alarmAt(JUMMAH, "2026-10-30T08:55:00.000Z"));

    await ensureAlarmsScheduled();

    expect(armsAndCancels()).toEqual([
      ["scheduleAlarm", idAt(FAJR, RIYADH[0])],
      ["scheduleAlarm", idAt(FAJR, RIYADH[1])],
    ]);
  });

  it("moves a 2.x Jumuah alarm to its instant id", async () => {
    mockSettings.fajr.enabled = false;
    mockSettings.friday.enabled = true;
    const dhuhr = ["2026-10-30T09:25:00.000Z", "2026-11-06T09:25:00.000Z"];
    const triggers = dhuhr.map((time) => new Date(at(time) - 30 * MINUTE).toISOString());
    setDays(dhuhrDays(dhuhr, "Asia/Riyadh"));
    const legacy = legacyAlarm(JUMMAH, triggers[0]);
    seed(legacy);

    await ensureAlarmsScheduled();

    expect(argsOf("cancelAlarm")).toEqual([[legacy.alarmId]]);
    expect(stored()).toEqual([
      [idAt(JUMMAH, triggers[0]), triggers[0]],
      [idAt(JUMMAH, triggers[1]), triggers[1]],
    ]);
  });
});
