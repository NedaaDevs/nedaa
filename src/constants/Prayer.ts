/** Storage keys, not display copy — renaming one orphans a user's saved settings. */
export const PRAYER_ID = {
  FAJR: "fajr",
  DHUHR: "dhuhr",
  ASR: "asr",
  MAGHRIB: "maghrib",
  ISHA: "isha",
} as const;

export type PrayerId = (typeof PRAYER_ID)[keyof typeof PRAYER_ID];

/** Chronological. Derived, so there is one list to keep correct. */
export const PRAYER_IDS: readonly PrayerId[] = Object.values(PRAYER_ID);

/** Whether a timing name is one of the five prayers. */
export const isPrayerId = (value: string): value is PrayerId =>
  PRAYER_IDS.some((prayer) => prayer === value);

/**
 * Timings around the five prayers. Storage keys, same contract as PRAYER_ID.
 *
 * Two overlapping sets draw from these: the times a provider returns, and the ones a
 * user can be notified about. Sunrise and sunset are computed but never notified;
 * ishraq and duha are derived moments the provider does not send.
 */
export const OTHER_TIMING = {
  SUNRISE: "sunrise",
  SUNSET: "sunset",
  IMSAK: "imsak",
  MIDNIGHT: "midnight",
  FIRST_THIRD: "firstthird",
  LAST_THIRD: "lastthird",
  ISHRAQ: "ishraq",
  DUHA: "duha",
} as const;

/** What a provider returns alongside the prayer times. */
export const OTHER_TIMING_NAMES = [
  OTHER_TIMING.SUNRISE,
  OTHER_TIMING.SUNSET,
  OTHER_TIMING.IMSAK,
  OTHER_TIMING.MIDNIGHT,
  OTHER_TIMING.FIRST_THIRD,
  OTHER_TIMING.LAST_THIRD,
] as const;

export type OtherTimingName = (typeof OTHER_TIMING_NAMES)[number];

/** The other times Today lists; sunrise has its own cell among the prayers. */
export const TODAY_OTHER_TIMES = OTHER_TIMING_NAMES.filter((name) => name !== OTHER_TIMING.SUNRISE);

/** Each other time's name; two of the keys spell their id in camel case. */
export const OTHER_TIME_LABEL_KEY: Record<OtherTimingName, string> = {
  [OTHER_TIMING.SUNRISE]: "otherTimings.sunrise",
  [OTHER_TIMING.SUNSET]: "otherTimings.sunset",
  [OTHER_TIMING.IMSAK]: "otherTimings.imsak",
  [OTHER_TIMING.MIDNIGHT]: "otherTimings.midnight",
  [OTHER_TIMING.FIRST_THIRD]: "otherTimings.firstThird",
  [OTHER_TIMING.LAST_THIRD]: "otherTimings.lastThird",
};

/** What a user can switch a notification on for. */
export const OTHER_TIMING_IDS = [
  OTHER_TIMING.ISHRAQ,
  OTHER_TIMING.DUHA,
  OTHER_TIMING.MIDNIGHT,
  OTHER_TIMING.FIRST_THIRD,
  OTHER_TIMING.LAST_THIRD,
  OTHER_TIMING.IMSAK,
] as const;

export type OtherTimingId = (typeof OTHER_TIMING_IDS)[number];
