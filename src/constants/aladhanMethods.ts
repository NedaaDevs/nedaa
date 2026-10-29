import type { MethodId } from "@/types/providers/aladhan";
import type { Coords } from "@/types/location";

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

const point = (latitude: number, longitude: number): Coords => ({ latitude, longitude });

// Each method's authority, from the same Method.php; null is never a default.
export const METHOD_AUTHORITY: Record<MethodId, Coords | null> = {
  0: point(34.6415764, 50.8746035),
  1: point(24.8614622, 67.0099388),
  2: point(39.70421229999999, -86.39943869999999),
  3: point(51.5194682, -0.1360365),
  4: point(21.3890824, 39.8579118),
  5: point(30.0444196, 31.2357116),
  7: point(35.6891975, 51.3889736),
  8: point(24.1323638, 53.3199527),
  9: point(29.375859, 47.9774052),
  10: point(25.2854473, 51.5310398),
  11: point(1.352083, 103.819836),
  12: point(48.856614, 2.3522219),
  13: point(39.9333635, 32.8597419),
  14: point(54.73479099999999, 55.9578555),
  15: null,
  16: point(25.0762677, 55.087404),
  17: point(3.139003, 101.686855),
  18: point(36.8064948, 10.1815316),
  19: point(36.753768, 3.0587561),
  20: point(-6.2087634, 106.845599),
  21: point(33.9715904, -6.8498129),
  22: point(38.7222524, -9.1393366),
  23: point(31.9461222, 35.923844),
};

/** ISO 3166 codes, upper case, as the device geocoder gives them. */
export const COUNTRY_CODE = { SAUDI_ARABIA: "SA" } as const;
export type CountryCode = (typeof COUNTRY_CODE)[keyof typeof COUNTRY_CODE];

/** Countries where AlAdhan's default is one method, whatever is nearest. */
export const METHOD_BY_COUNTRY: Record<CountryCode, MethodId> = {
  [COUNTRY_CODE.SAUDI_ARABIA]: 4,
};
