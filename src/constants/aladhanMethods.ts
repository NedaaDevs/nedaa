import type { MethodId } from "@/types/providers/aladhan";

/** Sun depression below the horizon, in degrees. */
type Degrees = { degrees: number };
/** A fixed time after the timing before it, in minutes. */
type Minutes = { minutes: number };
/** Moonsighting Committee minutes, set by latitude and day of year. */
type Seasonal = { seasonal: true };

export type MethodAngles = {
  fajr: Degrees | Seasonal;
  /** Minutes count from Maghrib; seasonal minutes count from sunset. */
  isha: Degrees | Minutes | Seasonal;
  /** Null puts Maghrib at sunset; minutes count from sunset. */
  maghrib: Degrees | Minutes | null;
};

const SEASONAL: Seasonal = { seasonal: true };

const angles = (fajr: number, isha: number): MethodAngles => ({
  fajr: { degrees: fajr },
  isha: { degrees: isha },
  maghrib: null,
});

const ishaAfterMaghrib = (fajr: number, minutes: number): MethodAngles => ({
  fajr: { degrees: fajr },
  isha: { minutes },
  maghrib: null,
});

// AlAdhan's prayer-times library, src/PrayerTimes/Method.php at 8e1bff8a.
export const METHOD_ANGLES: Record<MethodId, MethodAngles> = {
  0: { fajr: { degrees: 16 }, isha: { degrees: 14 }, maghrib: { degrees: 4 } },
  1: angles(18, 18),
  2: angles(15, 15),
  3: angles(18, 17),
  4: ishaAfterMaghrib(18.5, 90),
  5: angles(19.5, 17.5),
  7: { fajr: { degrees: 17.7 }, isha: { degrees: 14 }, maghrib: { degrees: 4.5 } },
  8: ishaAfterMaghrib(19.5, 90),
  9: angles(18, 17.5),
  10: ishaAfterMaghrib(18, 90),
  11: angles(20, 18),
  12: angles(12, 12),
  13: angles(18, 17),
  14: angles(16, 15),
  15: { fajr: SEASONAL, isha: SEASONAL, maghrib: null },
  16: angles(18.2, 18.2),
  17: angles(20, 18),
  18: angles(18, 18),
  19: angles(18, 17),
  20: angles(20, 18),
  21: angles(19, 17),
  22: { fajr: { degrees: 18 }, isha: { minutes: 77 }, maghrib: { minutes: 3 } },
  23: { fajr: { degrees: 18 }, isha: { degrees: 18 }, maghrib: { minutes: 5 } },
};
