import { addDays, format, startOfDay } from "date-fns";

import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { deviceTimeZone } from "@/utils/date";
import type { StoredDays } from "@/utils/phase";

const HOUR = 60;

/** One plain day on the device clock, each time in minutes after midnight. */
const SAMPLE_MINUTES = {
  [PRAYER_ID.FAJR]: 4 * HOUR + 50,
  [PRAYER_ID.DHUHR]: 12 * HOUR + 5,
  [PRAYER_ID.ASR]: 15 * HOUR + 25,
  [PRAYER_ID.MAGHRIB]: 18 * HOUR,
  [PRAYER_ID.ISHA]: 19 * HOUR + 20,
  [OTHER_TIMING.SUNRISE]: 6 * HOUR + 10,
  [OTHER_TIMING.SUNSET]: 18 * HOUR,
  [OTHER_TIMING.IMSAK]: 4 * HOUR + 40,
  [OTHER_TIMING.FIRST_THIRD]: 21 * HOUR,
  [OTHER_TIMING.MIDNIGHT]: 23 * HOUR + 25,
  // After the next midnight, as a provider dates it.
  [OTHER_TIMING.LAST_THIRD]: 25 * HOUR + 50,
} as const;

const DATE_KEY = "yyyyMMdd";

/** The sample day starting at a local midnight. */
const sampleDay = (midnight: Date, timezone: string): DayPrayerTimes => {
  const at = (id: keyof typeof SAMPLE_MINUTES) =>
    new Date(
      midnight.getFullYear(),
      midnight.getMonth(),
      midnight.getDate(),
      0,
      SAMPLE_MINUTES[id]
    ).toISOString();

  return {
    date: Number(format(midnight, DATE_KEY)),
    timezone,
    timings: {
      [PRAYER_ID.FAJR]: at(PRAYER_ID.FAJR),
      [PRAYER_ID.DHUHR]: at(PRAYER_ID.DHUHR),
      [PRAYER_ID.ASR]: at(PRAYER_ID.ASR),
      [PRAYER_ID.MAGHRIB]: at(PRAYER_ID.MAGHRIB),
      [PRAYER_ID.ISHA]: at(PRAYER_ID.ISHA),
    },
    otherTimings: {
      [OTHER_TIMING.SUNRISE]: at(OTHER_TIMING.SUNRISE),
      [OTHER_TIMING.SUNSET]: at(OTHER_TIMING.SUNSET),
      [OTHER_TIMING.IMSAK]: at(OTHER_TIMING.IMSAK),
      [OTHER_TIMING.MIDNIGHT]: at(OTHER_TIMING.MIDNIGHT),
      [OTHER_TIMING.FIRST_THIRD]: at(OTHER_TIMING.FIRST_THIRD),
      [OTHER_TIMING.LAST_THIRD]: at(OTHER_TIMING.LAST_THIRD),
    },
  };
};

/** Yesterday, today and tomorrow as sample days, on the device's clock. */
export const sampleDays = (now: Date, timezone = deviceTimeZone()): StoredDays => {
  const today = startOfDay(now);
  return {
    yesterday: sampleDay(addDays(today, -1), timezone),
    today: sampleDay(today, timezone),
    tomorrow: sampleDay(addDays(today, 1), timezone),
  };
};
