import { ALARM_TYPE } from "@/constants/Alarm";
import { OTHER_TIMING, PRAYER_ID, PRAYER_IDS } from "@/constants/Prayer";
import { ScheduledAlarmType } from "@/enums/alarm";
import { useAlarmStore } from "@/stores/alarm";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { scheduleFridayAlarm } from "@/utils/alarmScheduler";
import { alarmTypeForPrayer, toScheduledAlarmType, toSettingsAlarmType } from "@/utils/alarmTypes";

/** A stored day whose every time is `at`; only Dhuhr's weekday matters here. */
const dayAt = (timezone: string, at: string): DayPrayerTimes => ({
  date: 0,
  timezone,
  timings: {
    [PRAYER_ID.FAJR]: at,
    [PRAYER_ID.DHUHR]: at,
    [PRAYER_ID.ASR]: at,
    [PRAYER_ID.MAGHRIB]: at,
    [PRAYER_ID.ISHA]: at,
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: at,
    [OTHER_TIMING.SUNSET]: at,
    [OTHER_TIMING.IMSAK]: at,
    [OTHER_TIMING.MIDNIGHT]: at,
    [OTHER_TIMING.FIRST_THIRD]: at,
    [OTHER_TIMING.LAST_THIRD]: at,
  },
});

// Friday noon at UTC+14 is still Thursday in UTC.
const KIRITIMATI_FRIDAY_NOON = "2026-07-23T22:00:00.000Z";
const RIYADH_FRIDAY_DHUHR = "2026-07-24T09:10:00.000Z";
const RIYADH_SATURDAY_DHUHR = "2026-07-25T09:10:00.000Z";
// Friday 12:40 in Honolulu is already Saturday in UTC.
const HONOLULU_FRIDAY_DHUHR = "2026-07-24T22:40:00.000Z";

describe("toScheduledAlarmType", () => {
  it("maps the friday settings key to the jummah scheduled type", () => {
    // Native fire paths read settings by the scheduled type; the settings key
    // would leave every Jummah customization on its defaults at fire time.
    expect(toScheduledAlarmType(ALARM_TYPE.FRIDAY)).toBe(ScheduledAlarmType.JUMMAH);
  });

  it("maps fajr to fajr", () => {
    expect(toScheduledAlarmType(ALARM_TYPE.FAJR)).toBe(ScheduledAlarmType.FAJR);
  });
});

describe("toSettingsAlarmType", () => {
  it("maps the jummah scheduled type back to the friday settings key", () => {
    expect(toSettingsAlarmType(ScheduledAlarmType.JUMMAH)).toBe(ALARM_TYPE.FRIDAY);
  });

  it("maps fajr to fajr", () => {
    expect(toSettingsAlarmType(ScheduledAlarmType.FAJR)).toBe(ALARM_TYPE.FAJR);
  });

  it("returns null for custom (no per-type user settings)", () => {
    expect(toSettingsAlarmType(ScheduledAlarmType.CUSTOM)).toBeNull();
  });
});

describe("alarmTypeForPrayer", () => {
  const riyadhFriday = dayAt("Asia/Riyadh", RIYADH_FRIDAY_DHUHR);
  const riyadhSaturday = dayAt("Asia/Riyadh", RIYADH_SATURDAY_DHUHR);

  it("offers the Fajr alarm on every day", () => {
    expect(alarmTypeForPrayer(PRAYER_ID.FAJR, riyadhFriday)).toBe(ALARM_TYPE.FAJR);
    expect(alarmTypeForPrayer(PRAYER_ID.FAJR, riyadhSaturday)).toBe(ALARM_TYPE.FAJR);
  });

  it("offers the Friday alarm for Dhuhr on a Friday only", () => {
    expect(alarmTypeForPrayer(PRAYER_ID.DHUHR, riyadhFriday)).toBe(ALARM_TYPE.FRIDAY);
    expect(alarmTypeForPrayer(PRAYER_ID.DHUHR, riyadhSaturday)).toBeNull();
  });

  it("reads Friday in the day's own time zone", () => {
    const instant = KIRITIMATI_FRIDAY_NOON;
    expect(alarmTypeForPrayer(PRAYER_ID.DHUHR, dayAt("Pacific/Kiritimati", instant))).toBe(
      ALARM_TYPE.FRIDAY
    );
    expect(alarmTypeForPrayer(PRAYER_ID.DHUHR, dayAt("UTC", instant))).toBeNull();
  });

  it("offers no alarm for the other prayers, Friday included", () => {
    const others = PRAYER_IDS.filter((id) => id !== PRAYER_ID.FAJR && id !== PRAYER_ID.DHUHR);
    for (const id of others) {
      expect(alarmTypeForPrayer(id, riyadhFriday)).toBeNull();
    }
  });
});

// The sheet shows the Friday row on the days the scheduler would ring.
describe("the Friday alarm row and the Jummah scheduler", () => {
  const INITIAL_SETTINGS = useAlarmSettingsStore.getState();
  const INITIAL_ALARMS = useAlarmStore.getState();

  afterEach(() => {
    jest.useRealTimers();
    useAlarmSettingsStore.setState(INITIAL_SETTINGS, true);
    useAlarmStore.setState(INITIAL_ALARMS, true);
  });

  it.each([
    ["Pacific/Kiritimati", KIRITIMATI_FRIDAY_NOON, true],
    ["UTC", KIRITIMATI_FRIDAY_NOON, false],
    ["Asia/Riyadh", RIYADH_FRIDAY_DHUHR, true],
    ["Asia/Riyadh", RIYADH_SATURDAY_DHUHR, false],
    ["Pacific/Honolulu", HONOLULU_FRIDAY_DHUHR, true],
  ])("agree for Dhuhr in %s at %s", async (timezone, dhuhr, friday) => {
    jest.useFakeTimers({ now: new Date("2026-07-20T00:00:00.000Z") });
    const day = dayAt(timezone, dhuhr);
    usePrayerTimesStore.setState({ todayTimings: day, tomorrowTimings: null, twoWeeksTimings: [] });
    useAlarmSettingsStore.setState({
      friday: { ...INITIAL_SETTINGS.friday, enabled: true },
    });
    useAlarmStore.setState({ scheduleAlarm: jest.fn().mockResolvedValue(true) });

    const rings = (await scheduleFridayAlarm()) !== null;
    const shows = alarmTypeForPrayer(PRAYER_ID.DHUHR, day) === ALARM_TYPE.FRIDAY;

    expect(rings).toBe(friday);
    expect(shows).toBe(friday);
  });
});
