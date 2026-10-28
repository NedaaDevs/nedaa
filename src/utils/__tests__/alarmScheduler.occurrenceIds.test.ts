import { ScheduledAlarmType } from "@/enums/alarm";
import { type ScheduledAlarm, useAlarmStore } from "@/stores/alarm";
import { argsOf, nativeCalls, nativeResults, resetNativeLog } from "@/test-helpers/expoAlarmLog";
import { resetMemoryKv } from "@/test-helpers/memoryKvStore";
import { DEFAULT_TIMING_CONFIG, type TimingConfig } from "@/types/alarm";
import { generateDeterministicUUID, getAlarmKey, getSnoozeKey } from "@/utils/alarmId";
import { FIRED_LEDGER } from "@/constants/FiredPrayerGuard";
import { readLedger } from "@/services/firedPrayerLedger";
import {
  completeAndRescheduleAlarm,
  rescheduleAllAlarms,
  scheduleFajrAlarm,
  scheduleFridayAlarm,
  schedulePreviewAlarm,
} from "@/utils/alarmScheduler";

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
  useAlarmStreakStore: { getState: () => ({ recordFajrSuccess: jest.fn() }) },
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
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type TypeSettings = { enabled: boolean; timing: TimingConfig };
type PrayerDay = { timings: { fajr?: string; dhuhr?: string }; timezone: string };
type NativeAlarm = { id: string; triggerDate: Date; alarmType: ScheduledAlarmType };

const minutesBefore = (minutes: number): TimingConfig =>
  minutes > 0 ? { mode: "beforePrayerTime", minutesBefore: minutes } : DEFAULT_TIMING_CONFIG;
const settingsOf = (): { fajr: TypeSettings; friday: TypeSettings } => ({
  fajr: { enabled: true, timing: DEFAULT_TIMING_CONFIG },
  friday: { enabled: false, timing: minutesBefore(30) },
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
// `count` instants from `first`, `step` apart.
const series = (first: string, step: number, count: number): string[] =>
  Array.from({ length: count }, (_, k) =>
    new Date(new Date(first).getTime() + k * step).toISOString()
  );
const fajrDays = (times: string[], timezone: string): PrayerDay[] =>
  times.map((fajr) => ({ timings: { fajr }, timezone }));
const dhuhrDays = (times: string[], timezone: string): PrayerDay[] =>
  times.map((dhuhr) => ({ timings: { dhuhr }, timezone }));
const later = (times: string[], minutes: number): string[] =>
  times.map((time) => new Date(new Date(time).getTime() + minutes * MINUTE).toISOString());

const iso = (at: number): string => new Date(at).toISOString();
const idAt = (type: ScheduledAlarmType, at: string | number): string =>
  generateDeterministicUUID(getAlarmKey(type, new Date(at)));
const records = (type: ScheduledAlarmType): ScheduledAlarm[] =>
  Object.values(useAlarmStore.getState().scheduledAlarms).filter((a) => a.alarmType === type);
const armedAt = (type: ScheduledAlarmType): string[] =>
  records(type)
    .map((a) => iso(a.triggerTime))
    .sort();
const recordIdAt = (type: ScheduledAlarmType, at: number): string => {
  const record = records(type).find((a) => a.triggerTime === at);
  if (!record) throw new Error(`no ${type} record at ${iso(at)}`);
  return record.alarmId;
};
const armedNatively = (calls: [string, unknown[]][] = nativeCalls): NativeAlarm[] =>
  calls.filter(([name]) => name === "scheduleAlarm").map(([, [alarm]]) => alarm as NativeAlarm);
// Arms and cancels as [name, id], in order.
const armsAndCancels = (): [string, string][] =>
  nativeCalls.flatMap(([name, [arg]]): [string, string][] => {
    if (name === "scheduleAlarm") return [[name, (arg as NativeAlarm).id]];
    if (name === "cancelAlarm") return [[name, arg as string]];
    return [];
  });
// The ids native holds once every logged call has succeeded.
const nativeIds = (): string[] => {
  const ids = new Set<string>();
  for (const [name, id] of armsAndCancels()) {
    if (name === "scheduleAlarm") ids.add(id);
    else ids.delete(id);
  }
  return [...ids].sort();
};
const seed = (...alarms: ScheduledAlarm[]) =>
  useAlarmStore.setState((state) => ({
    scheduledAlarms: {
      ...state.scheduledAlarms,
      ...Object.fromEntries(alarms.map((alarm) => [alarm.alarmId, alarm])),
    },
  }));
const occurrence = (type: ScheduledAlarmType, at: string): ScheduledAlarm => ({
  alarmId: idAt(type, at),
  alarmType: type,
  title: type,
  triggerTime: new Date(at).getTime(),
  liveActivityId: null,
  snoozeCount: 0,
});
const planOf = (type: ScheduledAlarmType): Promise<string | null> =>
  type === JUMMAH ? scheduleFridayAlarm() : scheduleFajrAlarm();
// Holds the nth native arm until release; the others succeed at once.
const holdArm = (nth: number): { reached: Promise<void>; release: () => void } => {
  let release = () => {};
  let reach = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reached = new Promise<void>((resolve) => {
    reach = resolve;
  });
  let count = 0;
  nativeResults.scheduleAlarm = () => {
    count += 1;
    if (count !== nth) return true;
    reach();
    return held.then(() => true);
  };
  return { reached, release: () => release() };
};
const holdFirstArm = () => holdArm(1);

// Fajr crosses UTC midnight: two triggers on 27 Oct.
const KARACHI = [
  "2026-10-27T00:00:00.000Z",
  "2026-10-27T23:59:00.000Z",
  "2026-10-28T23:58:00.000Z",
];
const FRIDAYS_DHUHR = series("2026-10-30T09:25:00.000Z", 7 * DAY, 3);
// From Friday 30 Oct, with Dhuhr 8 h after Fajr: Friday's Fajr and the Jumuah
// alarm fall within one window.
const WEEK_FROM_FRIDAY: PrayerDay[] = series("2026-10-30T01:40:00.000Z", DAY, 8).map((fajr) => ({
  timings: { fajr, dhuhr: iso(new Date(fajr).getTime() + 8 * HOUR) },
  timezone: "Asia/Riyadh",
}));

beforeEach(() => {
  resetNativeLog();
  resetMemoryKv();
  nativeResults.getPendingChallenge = null;
  useAlarmStore.setState({ scheduledAlarms: {} });
  Object.assign(mockSettings, settingsOf());
  jest.useFakeTimers({ now: new Date("2026-10-26T23:00:00.000Z") });
});
afterEach(() => jest.useRealTimers());

type Chain = {
  place: string;
  type: ScheduledAlarmType;
  before: number;
  timezone: string;
  first: string;
  step: number;
  // From the trigger to the solve; the alarm screen opens up to a minute early.
  solvedAfter?: number;
};

const CHAINS: Chain[] = [
  {
    place: "Karachi",
    type: FAJR,
    before: 0,
    timezone: "Asia/Karachi",
    first: "2026-10-27T00:00:00.000Z",
    step: DAY - MINUTE,
  },
  {
    place: "Kolkata, 30 min before",
    type: FAJR,
    before: 30,
    timezone: "Asia/Kolkata",
    first: "2026-10-27T00:15:00.000Z",
    step: DAY - MINUTE,
  },
  {
    place: "Dubai, 10 min before",
    type: FAJR,
    before: 10,
    timezone: "Asia/Dubai",
    first: "2026-10-27T00:10:00.000Z",
    step: DAY - MINUTE,
  },
  {
    place: "UTC+3, Fajr at 00:20 local, 30 min before",
    type: FAJR,
    before: 30,
    timezone: "Asia/Riyadh",
    first: "2026-10-26T21:20:00.000Z",
    step: DAY + MINUTE,
  },
  {
    place: "London across 25 Oct 2026, 90 min before",
    type: FAJR,
    before: 90,
    timezone: "Europe/London",
    first: "2026-10-23T05:15:00.000Z",
    step: DAY + MINUTE,
  },
  {
    place: "New York across 1 Nov 2026",
    type: FAJR,
    before: 0,
    timezone: "America/New_York",
    first: "2026-10-30T09:50:00.000Z",
    step: DAY + MINUTE,
  },
  {
    place: "Riyadh, Jumuah 30 min before",
    type: JUMMAH,
    before: 30,
    timezone: "Asia/Riyadh",
    first: "2026-10-30T09:25:00.000Z",
    step: 7 * DAY,
  },
  {
    place: "Riyadh, solved 30 s before the trigger",
    type: FAJR,
    before: 0,
    timezone: "Asia/Riyadh",
    first: "2026-10-27T01:40:00.000Z",
    step: DAY + MINUTE,
    solvedAfter: -30_000,
  },
  {
    place: "Riyadh, Jumuah solved 30 s before the trigger",
    type: JUMMAH,
    before: 30,
    timezone: "Asia/Riyadh",
    first: "2026-10-30T09:25:00.000Z",
    step: 7 * DAY,
    solvedAfter: -30_000,
  },
];

describe("alarm ids per occurrence", () => {
  it.each(CHAINS)(
    "gives every occurrence of a ring-and-complete chain its own id in $place",
    async ({ type, before, timezone, first, step, solvedAfter = 30_000 }) => {
      const prayers = series(first, step, 7);
      const triggers = prayers.map((prayer) => new Date(prayer).getTime() - before * MINUTE);
      const isJummah = type === JUMMAH;
      mockSettings.fajr = { enabled: !isJummah, timing: minutesBefore(before) };
      mockSettings.friday = { enabled: isJummah, timing: minutesBefore(before) };
      setDays(isJummah ? dhuhrDays(prayers, timezone) : fajrDays(prayers, timezone));
      jest.setSystemTime(triggers[0] - 3 * HOUR);
      await planOf(type);

      const completed: string[] = [];
      const rearmedCompleted: string[] = [];
      for (let ring = 0; ring < 5; ring += 1) {
        jest.setSystemTime(triggers[ring] + solvedAfter);
        const rungId = recordIdAt(type, triggers[ring]);
        const callsBefore = nativeCalls.length;
        await completeAndRescheduleAlarm(rungId);
        completed.push(rungId);
        const rearmed = armedNatively(nativeCalls.slice(callsBefore)).map((alarm) => alarm.id);
        rearmedCompleted.push(...rearmed.filter((id) => completed.includes(id)));
        expect(armedAt(type)).toEqual([iso(triggers[ring + 1]), iso(triggers[ring + 2])]);
      }

      expect(rearmedCompleted).toEqual([]);
      const armed = armedNatively();
      const pairs = new Set(armed.map((alarm) => `${alarm.id}@${alarm.triggerDate.getTime()}`));
      expect(new Set(armed.map((alarm) => alarm.id)).size).toBe(triggers.length);
      expect(new Set(armed.map((alarm) => alarm.triggerDate.getTime())).size).toBe(triggers.length);
      expect(pairs.size).toBe(triggers.length);
    }
  );

  it("arms both Fajrs that share a UTC date", async () => {
    setDays(fajrDays(KARACHI, "Asia/Karachi"));

    await scheduleFajrAlarm();

    expect(armedAt(FAJR)).toEqual([KARACHI[0], KARACHI[1]]);
    expect(records(FAJR).map((a) => a.alarmId)).toEqual([
      idAt(FAJR, KARACHI[0]),
      idAt(FAJR, KARACHI[1]),
    ]);
  });

  it("a second completion of one alarm leaves the re-armed pair armed", async () => {
    setDays(fajrDays(KARACHI, "Asia/Karachi"));
    await scheduleFajrAlarm();
    jest.setSystemTime(new Date(KARACHI[0]).getTime() + 30_000);
    const rungId = idAt(FAJR, KARACHI[0]);

    await completeAndRescheduleAlarm(rungId);
    await completeAndRescheduleAlarm(rungId);

    expect(argsOf("cancelAlarm")).toEqual([[rungId], [rungId]]);
    expect(armedAt(FAJR)).toEqual([KARACHI[1], KARACHI[2]]);
  });

  it("arming unchanged times again cancels nothing", async () => {
    setDays(fajrDays(KARACHI, "Asia/Karachi"));
    await scheduleFajrAlarm();

    await scheduleFajrAlarm();

    expect(argsOf("cancelAlarm")).toEqual([]);
    expect(armedAt(FAJR)).toEqual([KARACHI[0], KARACHI[1]]);
  });

  // Up to the width of the window; a larger move relies on the cancel by type.
  it.each([14, 180, 660])(
    "cancels the occurrence a %i min move replaces, after arming the move",
    async (minutes) => {
      setDays(fajrDays(KARACHI, "Asia/Karachi"));
      await scheduleFajrAlarm();
      const moved = later(KARACHI, minutes);
      setDays(fajrDays(moved, "Asia/Karachi"));
      resetNativeLog();

      await scheduleFajrAlarm();

      expect(armsAndCancels()).toEqual([
        ["scheduleAlarm", idAt(FAJR, moved[0])],
        ["scheduleAlarm", idAt(FAJR, moved[1])],
        ["cancelAlarm", idAt(FAJR, KARACHI[0])],
        ["cancelAlarm", idAt(FAJR, KARACHI[1])],
      ]);
      expect(argsOf("deleteAlarmFromDB")).toEqual([
        [idAt(FAJR, KARACHI[0])],
        [idAt(FAJR, KARACHI[1])],
      ]);
      expect(armedAt(FAJR)).toEqual([moved[0], moved[1]]);
    }
  );

  it("leaves another type's alarm within the window alone", async () => {
    mockSettings.friday.enabled = true;
    setDays(WEEK_FROM_FRIDAY);
    await scheduleFridayAlarm();
    const jumuah = records(JUMMAH);

    await scheduleFajrAlarm();

    expect(argsOf("cancelAlarm")).toEqual([]);
    expect(records(JUMMAH)).toEqual(jumuah);
  });

  it("keeps the occurrence when its replacement fails to arm", async () => {
    setDays(fajrDays(KARACHI, "Asia/Karachi"));
    await scheduleFajrAlarm();
    setDays(fajrDays(later(KARACHI, 14), "Asia/Karachi"));
    nativeResults.scheduleAlarm = false;

    await scheduleFajrAlarm();

    expect(argsOf("cancelAlarm")).toEqual([]);
    expect(armedAt(FAJR)).toEqual([KARACHI[0], KARACHI[1]]);
  });

  // The settings screen keeps its switch On for the id this returns.
  it("returns null when the next occurrence fails to arm and the one after arms", async () => {
    setDays(fajrDays(KARACHI, "Asia/Karachi"));
    nativeResults.scheduleAlarm = (alarm: NativeAlarm) => alarm.id !== idAt(FAJR, KARACHI[0]);

    expect(await scheduleFajrAlarm()).toBeNull();
    expect(armedAt(FAJR)).toEqual([KARACHI[1]]);
  });

  it("leaves snoozes, rehearsals, test alarms, past-due alarms and a backup past the data alone", async () => {
    const snoozeAt = new Date("2026-10-26T23:05:00.000Z");
    const pastDue = occurrence(FAJR, "2026-10-26T22:50:00.000Z");
    const backup = occurrence(FAJR, KARACHI[1]);
    seed(pastDue, backup, {
      ...occurrence(FAJR, snoozeAt.toISOString()),
      alarmId: generateDeterministicUUID(getSnoozeKey(FAJR, snoozeAt, 1)),
      snoozeCount: 1,
    });
    await schedulePreviewAlarm(FAJR, 30);
    await useAlarmStore.getState().scheduleAlarm({
      id: generateDeterministicUUID(`debug_${Date.now()}`),
      triggerDate: new Date("2026-10-27T00:30:00.000Z"),
      title: "Test",
      alarmType: FAJR,
    });
    const before = Object.keys(useAlarmStore.getState().scheduledAlarms);
    // Only today's Fajr is known, so the plan arms no following occurrence.
    setDays(fajrDays([KARACHI[0]], "Asia/Karachi"));

    await scheduleFajrAlarm();

    expect(argsOf("cancelAlarm")).toEqual([]);
    expect(Object.keys(useAlarmStore.getState().scheduledAlarms).sort()).toEqual(
      [...before, idAt(FAJR, KARACHI[0])].sort()
    );
  });

  it("arms two Fridays under their own ids", async () => {
    mockSettings.fajr.enabled = false;
    mockSettings.friday.enabled = true;
    setDays(dhuhrDays(FRIDAYS_DHUHR, "Asia/Riyadh"));

    await scheduleFridayAlarm();

    const fridays = later(FRIDAYS_DHUHR, -30);
    expect(armedAt(JUMMAH)).toEqual([fridays[0], fridays[1]]);
    expect(records(JUMMAH).map((a) => a.alarmId)).toEqual([
      idAt(JUMMAH, fridays[0]),
      idAt(JUMMAH, fridays[1]),
    ]);
  });

  it("two overlapping plans leave the later plan armed", async () => {
    const firstArm = holdFirstArm();
    setDays(fajrDays(KARACHI, "Asia/Karachi"));
    const planA = scheduleFajrAlarm();
    await firstArm.reached;
    const planB = scheduleFajrAlarm();
    // Plan B reads the times when its turn comes, not when it is queued.
    const moved = later(KARACHI, 14);
    setDays(fajrDays(moved, "Asia/Karachi"));

    firstArm.release();
    await Promise.all([planA, planB]);

    expect(armedAt(FAJR)).toEqual([moved[0], moved[1]]);
    expect(nativeIds()).toEqual([idAt(FAJR, moved[0]), idAt(FAJR, moved[1])].sort());
  });

  it("arms nothing for a type turned off while its plan waits", async () => {
    const firstArm = holdFirstArm();
    mockSettings.friday.enabled = true;
    setDays(WEEK_FROM_FRIDAY);
    const fajrPlan = scheduleFajrAlarm();
    await firstArm.reached;
    const fridayPlan = scheduleFridayAlarm();
    // The settings store replaces a type's settings object on each update.
    mockSettings.friday = { ...mockSettings.friday, enabled: false };

    firstArm.release();
    await fajrPlan;

    expect(await fridayPlan).toBeNull();
    expect(armedNatively().filter((alarm) => alarm.alarmType === JUMMAH)).toEqual([]);
    expect(records(JUMMAH)).toEqual([]);
  });

  it("books nothing a cancel by type removed while the plan waited", async () => {
    setDays(fajrDays(KARACHI, "Asia/Karachi"));
    await scheduleFajrAlarm();
    const secondArm = holdArm(2);
    const plan = scheduleFajrAlarm();
    await secondArm.reached;
    // A city change cancels by type while the plan's second arm is in flight.
    const moved = later(KARACHI, 20);
    setDays(fajrDays(moved, "Asia/Karachi"));
    const relocate = rescheduleAllAlarms();

    secondArm.release();
    await Promise.all([plan, relocate]);

    const booked = readLedger(FIRED_LEDGER.ALARMS, Date.now()).map((entry) => iso(entry.at));
    expect(booked).not.toContain(KARACHI[0]);
    expect(armedAt(FAJR)).toEqual([moved[0], moved[1]]);
  });

  it("plans again after a plan throws", async () => {
    // A stored day with no timings makes the candidate read throw.
    setDays([{ timezone: "Asia/Karachi" } as PrayerDay]);
    await expect(scheduleFajrAlarm()).rejects.toThrow(TypeError);
    setDays(fajrDays(KARACHI, "Asia/Karachi"));

    await scheduleFajrAlarm();

    expect(armedAt(FAJR)).toEqual([KARACHI[0], KARACHI[1]]);
  });
});
