import { ScheduledAlarmType } from "@/enums/alarm";
import { useAlarmStore } from "@/stores/alarm";
import { resetMemoryKv } from "@/test-helpers/memoryKvStore";
import { DEFAULT_TIMING_CONFIG, type TimingConfig } from "@/types/alarm";
import {
  rescheduleAllAlarms,
  scheduleFajrAlarm,
  scheduleFridayAlarm,
  schedulePreviewAlarm,
} from "@/utils/alarmScheduler";

const mockResults: Record<string, unknown> = {};

jest.mock(
  "expo-alarm",
  () =>
    new Proxy(
      {},
      {
        get: (_target, name) => {
          if (name === "__esModule") return true;
          return (..._args: unknown[]) =>
            Promise.resolve(String(name) in mockResults ? mockResults[String(name)] : true);
        },
      }
    )
);
jest.mock(
  "expo-sqlite/kv-store",
  () => jest.requireActual("@/test-helpers/memoryKvStore").memoryKvStoreModule
);
jest.mock("@/localization/i18n", () => ({ __esModule: true, default: { t: (k: string) => k } }));
jest.mock("@/utils/alarmReport", () => ({
  alarmLog: { i: jest.fn(), w: jest.fn(), e: jest.fn() },
}));
jest.mock("@/stores/alarmStreak", () => ({ useAlarmStreakStore: { getState: jest.fn() } }));
jest.mock("@/stores/alarmSettings", () => ({
  useAlarmSettingsStore: { getState: () => mockAlarmSettings },
}));
jest.mock("@/stores/prayerTimes", () => ({
  usePrayerTimesStore: { getState: () => mockTimes },
}));

type TypeSettings = { enabled: boolean; timing: TimingConfig; snooze: { maxCount: number } };

const alarmSettings = (): { fajr: TypeSettings; friday: TypeSettings } => ({
  fajr: { enabled: true, timing: DEFAULT_TIMING_CONFIG, snooze: { maxCount: 3 } },
  friday: {
    enabled: false,
    timing: { mode: "beforePrayerTime", minutesBefore: 30 },
    snooze: { maxCount: 3 },
  },
});
const mockAlarmSettings = alarmSettings();
const mockTimes: { todayTimings: unknown; tomorrowTimings: unknown; twoWeeksTimings: unknown[] } = {
  todayTimings: null,
  tomorrowTimings: null,
  twoWeeksTimings: [],
};

const prayerDay = (ymd: string, fajr: string, dhuhr = "09:00", timezone = "Asia/Riyadh") => ({
  timings: { fajr: `${ymd}T${fajr}:00Z`, dhuhr: `${ymd}T${dhuhr}:00Z` },
  timezone,
});
const setDays = (days: ReturnType<typeof prayerDay>[]) =>
  Object.assign(mockTimes, {
    todayTimings: days[0],
    tomorrowTimings: days[1],
    twoWeeksTimings: days,
  });
const armed = (type: ScheduledAlarmType) =>
  Object.values(useAlarmStore.getState().scheduledAlarms)
    .filter((a) => a.alarmType === type && !a.isPreview)
    .map((a) => new Date(a.triggerTime).toISOString())
    .sort();

beforeEach(() => {
  resetMemoryKv();
  useAlarmStore.setState({ scheduledAlarms: {} });
  mockResults.getPendingChallenge = null;
  Object.assign(mockAlarmSettings, alarmSettings());
});
afterEach(() => jest.useRealTimers());

describe("prayer alarms after a reschedule", () => {
  it("does not arm today's Fajr again after a same-day move west", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-26T00:00:00Z") });
    setDays([
      prayerDay("2026-10-26", "01:40"),
      prayerDay("2026-10-27", "01:41"),
      prayerDay("2026-10-28", "01:42"),
    ]);
    await scheduleFajrAlarm();
    jest.setSystemTime(new Date("2026-10-26T01:50:00Z"));
    setDays([
      prayerDay("2026-10-26", "02:05"),
      prayerDay("2026-10-27", "02:06"),
      prayerDay("2026-10-28", "02:07"),
    ]);
    await rescheduleAllAlarms();
    expect(armed(ScheduledAlarmType.FAJR)).toEqual([
      "2026-10-27T02:06:00.000Z",
      "2026-10-28T02:07:00.000Z",
    ]);
  });

  it("arms the next Friday after Jumuah rang on a same-day move west", async () => {
    mockAlarmSettings.fajr.enabled = false;
    mockAlarmSettings.friday.enabled = true;
    jest.useFakeTimers({ now: new Date("2026-10-30T06:00:00Z") });
    setDays([
      prayerDay("2026-10-30", "01:45"),
      prayerDay("2026-11-06", "01:50"),
      prayerDay("2026-11-13", "01:55"),
    ]);
    await scheduleFridayAlarm(); // 08:30 on Oct 30 and Nov 6
    jest.setSystemTime(new Date("2026-10-30T08:40:00Z"));
    setDays([
      prayerDay("2026-10-30", "02:10", "09:25"),
      prayerDay("2026-11-06", "02:15", "09:25"),
      prayerDay("2026-11-13", "02:20", "09:25"),
    ]);
    await rescheduleAllAlarms();
    expect(armed(ScheduledAlarmType.JUMMAH)).toEqual([
      "2026-11-06T08:55:00.000Z",
      "2026-11-13T08:55:00.000Z",
    ]);
  });

  it("skips the occurrence across midnight with a before-Fajr offset", async () => {
    mockAlarmSettings.fajr.timing = { mode: "beforePrayerTime", minutesBefore: 90 };
    jest.useFakeTimers({ now: new Date("2026-07-01T22:00:00Z") });
    setDays([
      prayerDay("2026-07-02", "01:00", "09:00", "UTC"),
      prayerDay("2026-07-03", "01:00", "09:00", "UTC"),
    ]);
    await scheduleFajrAlarm(); // 23:30 on Jul 1 and Jul 2
    jest.setSystemTime(new Date("2026-07-01T23:40:00Z"));
    setDays([
      prayerDay("2026-07-02", "01:25", "09:00", "UTC"),
      prayerDay("2026-07-03", "01:26", "09:00", "UTC"),
      prayerDay("2026-07-04", "01:27", "09:00", "UTC"),
    ]);
    await rescheduleAllAlarms();
    expect(armed(ScheduledAlarmType.FAJR)).toEqual([
      "2026-07-02T23:56:00.000Z",
      "2026-07-03T23:57:00.000Z",
    ]);
  });

  it("a rehearsal or a test alarm does not count as a rung Fajr", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-25T21:00:00Z") });
    await schedulePreviewAlarm(ScheduledAlarmType.FAJR, 30);
    await useAlarmStore.getState().scheduleAlarm({
      id: "debug-test",
      triggerDate: new Date("2026-10-25T21:01:00Z"),
      title: "Test",
      alarmType: ScheduledAlarmType.FAJR,
    });
    jest.setSystemTime(new Date("2026-10-25T21:05:00Z"));
    setDays([prayerDay("2026-10-26", "01:40"), prayerDay("2026-10-27", "01:41")]);
    await scheduleFajrAlarm();
    expect(armed(ScheduledAlarmType.FAJR)).toContain("2026-10-26T01:40:00.000Z");
  });
});
