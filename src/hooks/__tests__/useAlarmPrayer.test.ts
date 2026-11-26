import { renderHook } from "@testing-library/react-native";

import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { ScheduledAlarmType } from "@/enums/alarm";
import { useAlarmPrayer } from "@/hooks/useAlarmPrayer";
import { useAlarmStore, type ScheduledAlarm } from "@/stores/alarm";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import type { DayPrayerTimes } from "@/types/prayerTimes";

const ALARM_ID = "alarm-1";
let mockNow = new Date("2026-09-25T12:00:00.000Z");
jest.mock("@/hooks/useMinuteClock", () => ({ useMinuteClock: () => mockNow }));

/** A stored day whose Fajr and Dhuhr fall at fixed UTC times. */
const day = (date: string, key: number): DayPrayerTimes => ({
  date: key,
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: `${date}T04:30:00.000Z`,
    [PRAYER_ID.DHUHR]: `${date}T12:10:00.000Z`,
    [PRAYER_ID.ASR]: `${date}T15:20:00.000Z`,
    [PRAYER_ID.MAGHRIB]: `${date}T18:05:00.000Z`,
    [PRAYER_ID.ISHA]: `${date}T19:25:00.000Z`,
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: `${date}T05:50:00.000Z`,
    [OTHER_TIMING.SUNSET]: `${date}T18:05:00.000Z`,
  } as DayPrayerTimes["otherTimings"],
});
const TODAY = day("2026-09-25", 20260925);
const TOMORROW = day("2026-09-26", 20260926);

const ring = (alarmType: ScheduledAlarmType, triggerTime: string): ScheduledAlarm => ({
  alarmId: ALARM_ID,
  alarmType,
  title: "",
  triggerTime: Date.parse(triggerTime),
  liveActivityId: null,
  snoozeCount: 0,
});

const read = (alarmType: ScheduledAlarmType) =>
  renderHook(() => useAlarmPrayer(ALARM_ID, alarmType));

describe("useAlarmPrayer", () => {
  beforeEach(() => {
    usePrayerTimesStore.setState({ todayTimings: TODAY, tomorrowTimings: TOMORROW });
    useAlarmStore.setState({ scheduledAlarms: {} });
  });

  // Each ring takes the stored occurrence of its prayer nearest to it.
  it.each([
    ["late at night, before Fajr", ScheduledAlarmType.FAJR, "2026-09-25T23:50:00.000Z", TOMORROW],
    ["just before Fajr", ScheduledAlarmType.FAJR, "2026-09-25T04:20:00.000Z", TODAY],
    ["after Fajr, in the morning", ScheduledAlarmType.FAJR, "2026-09-25T06:00:00.000Z", TODAY],
    ["before Jumuah, at midday", ScheduledAlarmType.JUMMAH, "2026-09-25T11:50:00.000Z", TODAY],
    ["after Jumuah, at night", ScheduledAlarmType.JUMMAH, "2026-09-26T01:00:00.000Z", TOMORROW],
  ])("a ring %s picks the nearest day's prayer", async (_when, alarmType, trigger, expected) => {
    useAlarmStore.setState({ scheduledAlarms: { [ALARM_ID]: ring(alarmType, trigger) } });
    const timing = alarmType === ScheduledAlarmType.FAJR ? PRAYER_ID.FAJR : PRAYER_ID.DHUHR;

    const { result } = await read(alarmType);

    expect(result.current.moment?.time.toISOString()).toBe(expected.timings[timing]);
    expect(result.current.moment?.timezone).toBe(expected.timezone);
  });

  it("reads the clock when the alarm has no record", async () => {
    mockNow = new Date("2026-09-25T22:00:00.000Z");

    const { result } = await read(ScheduledAlarmType.FAJR);

    expect(result.current.moment?.time.toISOString()).toBe(TOMORROW.timings[PRAYER_ID.FAJR]);
  });

  it("gives no moment with no times stored, and keeps the prayer", async () => {
    usePrayerTimesStore.setState({ todayTimings: null, tomorrowTimings: null });

    const { result } = await read(ScheduledAlarmType.FAJR);

    expect(result.current.moment).toBeNull();
    expect(result.current.prayer).not.toBeNull();
  });

  it("gives a custom alarm no prayer and no moment", async () => {
    const { result } = await read(ScheduledAlarmType.CUSTOM);

    expect(result.current.prayer).toBeNull();
    expect(result.current.moment).toBeNull();
  });
});
