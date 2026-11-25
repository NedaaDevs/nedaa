import { renderHook } from "@testing-library/react-native";
import * as ExpoAlarm from "expo-alarm";

import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { ScheduledAlarmType } from "@/enums/alarm";
import { useAlarmPrayer } from "@/hooks/useAlarmPrayer";
import { useAlarmStore } from "@/stores/alarm";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import type { DayPrayerTimes } from "@/types/prayerTimes";

jest.mock("expo-alarm", () => ({
  ...jest.requireActual("expo-alarm"),
  scheduleAlarm: jest.fn(() => Promise.resolve(true)),
}));
jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock("@/utils/alarmReport", () => ({
  alarmLog: { i: jest.fn(), w: jest.fn(), e: jest.fn() },
}));

const ZONE = "Asia/Riyadh";

const day = (date: string, key: number): DayPrayerTimes => ({
  date: key,
  timezone: ZONE,
  timings: {
    [PRAYER_ID.FAJR]: `${date}T01:30:00.000Z`,
    [PRAYER_ID.DHUHR]: `${date}T09:10:00.000Z`,
    [PRAYER_ID.ASR]: `${date}T12:20:00.000Z`,
    [PRAYER_ID.MAGHRIB]: `${date}T15:05:00.000Z`,
    [PRAYER_ID.ISHA]: `${date}T16:25:00.000Z`,
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: `${date}T02:50:00.000Z`,
    [OTHER_TIMING.SUNSET]: `${date}T15:05:00.000Z`,
  } as DayPrayerTimes["otherTimings"],
});
const TODAY = day("2026-09-25", 20260925);
const TOMORROW = day("2026-09-26", 20260926);
const LATER = day("2026-09-27", 20260927);

const ALARM_ID = "alarm-1";

const arm = (alarmType: ScheduledAlarmType, at: string) =>
  useAlarmStore.getState().scheduleAlarm({
    id: ALARM_ID,
    triggerDate: new Date(at),
    title: "",
    alarmType,
  });

const sent = () => (ExpoAlarm.scheduleAlarm as jest.Mock).mock.lastCall[0].prayerMoment;

describe("scheduleAlarm's prayer moment", () => {
  beforeEach(() => {
    (ExpoAlarm.scheduleAlarm as jest.Mock).mockClear();
    useAlarmStore.setState({ scheduledAlarms: {} });
    usePrayerTimesStore.setState({
      todayTimings: TODAY,
      tomorrowTimings: TOMORROW,
      twoWeeksTimings: [TODAY, TOMORROW, LATER],
    });
  });

  // The native ring shows what the JS ring would, read from the same stored days.
  it.each([
    ["twenty minutes before Fajr", ScheduledAlarmType.FAJR, "2026-09-25T01:10:00.000Z"],
    ["at Fajr", ScheduledAlarmType.FAJR, "2026-09-25T01:30:00.000Z"],
    ["a snooze after Fajr", ScheduledAlarmType.FAJR, "2026-09-25T01:45:00.000Z"],
    ["an hour before Jumuah", ScheduledAlarmType.JUMMAH, "2026-09-26T08:10:00.000Z"],
    ["a custom alarm", ScheduledAlarmType.CUSTOM, "2026-09-25T01:10:00.000Z"],
  ])("for %s, matches the moment the ringing screen shows", async (_when, alarmType, at) => {
    await arm(alarmType, at);
    const { result } = await renderHook(() => useAlarmPrayer(ALARM_ID, alarmType));
    const shown = result.current.moment;
    expect(sent()).toEqual(shown ? { at: shown.time.getTime(), timezone: shown.timezone } : null);
  });

  it("sends the prayer's instant and its place's zone", async () => {
    await arm(ScheduledAlarmType.FAJR, "2026-09-25T01:10:00.000Z");
    expect(sent()).toEqual({ at: Date.parse(TODAY.timings[PRAYER_ID.FAJR]), timezone: ZONE });
  });

  // The occurrence after next is armed with it, two days ahead of today.
  it("takes a later stored day for an occurrence past tomorrow", async () => {
    await arm(ScheduledAlarmType.FAJR, "2026-09-27T01:10:00.000Z");
    expect(sent()).toEqual({ at: Date.parse(LATER.timings[PRAYER_ID.FAJR]), timezone: ZONE });
  });

  it("sends none for a custom alarm", async () => {
    await arm(ScheduledAlarmType.CUSTOM, "2026-09-25T01:10:00.000Z");
    expect(sent()).toBeNull();
  });

  it("sends none with no stored times", async () => {
    usePrayerTimesStore.setState({
      todayTimings: null,
      tomorrowTimings: null,
      twoWeeksTimings: null,
    });
    await arm(ScheduledAlarmType.FAJR, "2026-09-25T01:10:00.000Z");
    expect(sent()).toBeNull();
  });
});
