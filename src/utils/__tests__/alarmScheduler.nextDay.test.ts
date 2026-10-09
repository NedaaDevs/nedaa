import { ScheduledAlarmType } from "@/enums/alarm";
import { schedulePrayerAlarm } from "@/utils/alarmScheduler";

const mockScheduleAlarm = jest.fn((_params: { triggerDate: Date }) => Promise.resolve(true));
const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 6, 1, 23, 40);
const fajrOn = (dayOffset: number) =>
  new Date(Date.UTC(2026, 6, 2 + dayOffset, 1, 0)).toISOString();
const dayTiming = (dayOffset: number) => ({
  timings: { fajr: fajrOn(dayOffset) },
  timezone: "UTC",
});

jest.mock("@/localization/i18n", () => ({ __esModule: true, default: { t: (k: string) => k } }));
jest.mock("@/utils/alarmReport", () => ({
  alarmLog: { i: jest.fn(), w: jest.fn(), e: jest.fn() },
}));
jest.mock("@/stores/alarmStreak", () => ({ useAlarmStreakStore: { getState: jest.fn() } }));
jest.mock("@/stores/alarm", () => ({
  useAlarmStore: {
    getState: () => ({ scheduleAlarm: mockScheduleAlarm }),
    persist: {},
  },
}));
jest.mock("@/stores/alarmSettings", () => ({
  useAlarmSettingsStore: {
    getState: () => ({
      fajr: { enabled: true, timing: { mode: "beforePrayerTime", minutesBefore: 90 } },
    }),
    persist: {},
  },
}));
// Fajr at 01:00 with a 90-minute offset triggers at 23:30 the day before.
jest.mock("@/stores/prayerTimes", () => ({
  usePrayerTimesStore: {
    getState: () => ({
      todayTimings: dayTiming(-1),
      tomorrowTimings: dayTiming(0),
      twoWeeksTimings: [dayTiming(0), dayTiming(1), dayTiming(2)],
    }),
  },
}));

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  mockScheduleAlarm.mockClear();
});
afterEach(() => jest.useRealTimers());

describe("schedulePrayerAlarm next occurrence", () => {
  it("reaches past tomorrow when an offset puts tomorrow's trigger before now", async () => {
    await schedulePrayerAlarm("fajr", ScheduledAlarmType.FAJR);

    const { triggerDate } = mockScheduleAlarm.mock.calls[0][0];
    expect(triggerDate.getTime()).toBe(new Date(fajrOn(1)).getTime() - 1.5 * HOUR);
  });

  // A completion that never reaches JS leaves the following day armed.
  it("arms the occurrence after the next one as well", async () => {
    await schedulePrayerAlarm("fajr", ScheduledAlarmType.FAJR);

    const triggers = mockScheduleAlarm.mock.calls.map(([params]) => params.triggerDate.getTime());
    expect(triggers).toEqual([
      new Date(fajrOn(1)).getTime() - 1.5 * HOUR,
      new Date(fajrOn(2)).getTime() - 1.5 * HOUR,
    ]);
  });
});
