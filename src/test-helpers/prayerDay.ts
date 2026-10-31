import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import type { DayPrayerTimes } from "@/types/prayerTimes";

/** The zone of the test day's place. */
export const RIYADH_ZONE = "Asia/Riyadh";

/** The saved coordinates of the test day's place. */
export const RIYADH_COORDS = { latitude: 24.7136, longitude: 46.6753 };

/** An instant on the test day, as Riyadh's clock reads `time` (HH:mm). */
export const riyadhAt = (time: string) => `2026-10-13T${time}:00+03:00`;

/** One stored day of times for Riyadh, 2026-10-13, with every other timing. */
export const RIYADH_DAY: DayPrayerTimes = {
  date: 20261013,
  timezone: RIYADH_ZONE,
  timings: {
    [PRAYER_ID.FAJR]: riyadhAt("04:33"),
    [PRAYER_ID.DHUHR]: riyadhAt("11:53"),
    [PRAYER_ID.ASR]: riyadhAt("15:12"),
    [PRAYER_ID.MAGHRIB]: riyadhAt("17:40"),
    [PRAYER_ID.ISHA]: riyadhAt("19:10"),
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: riyadhAt("05:50"),
    [OTHER_TIMING.SUNSET]: riyadhAt("17:40"),
    [OTHER_TIMING.IMSAK]: riyadhAt("04:23"),
    [OTHER_TIMING.MIDNIGHT]: riyadhAt("23:45"),
    [OTHER_TIMING.FIRST_THIRD]: riyadhAt("21:43"),
    [OTHER_TIMING.LAST_THIRD]: riyadhAt("01:47"),
  },
};

/** One stored day in UTC, 2026-09-23: Fajr 04:30, sunrise 05:50, Isha 19:25. */
export const UTC_DAY: DayPrayerTimes = {
  date: 20260923,
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: "2026-09-23T04:30:00.000Z",
    [PRAYER_ID.DHUHR]: "2026-09-23T12:00:00.000Z",
    [PRAYER_ID.ASR]: "2026-09-23T15:20:00.000Z",
    [PRAYER_ID.MAGHRIB]: "2026-09-23T18:05:00.000Z",
    [PRAYER_ID.ISHA]: "2026-09-23T19:25:00.000Z",
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: "2026-09-23T05:50:00.000Z",
    [OTHER_TIMING.SUNSET]: "2026-09-23T18:05:00.000Z",
    [OTHER_TIMING.IMSAK]: "2026-09-23T04:20:00.000Z",
    [OTHER_TIMING.MIDNIGHT]: "2026-09-23T23:57:00.000Z",
    [OTHER_TIMING.FIRST_THIRD]: "2026-09-23T22:00:00.000Z",
    [OTHER_TIMING.LAST_THIRD]: "2026-09-24T01:55:00.000Z",
  },
};
