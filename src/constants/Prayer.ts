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
