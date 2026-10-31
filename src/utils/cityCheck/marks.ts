import {
  KEPT_MAX_AGE_MS,
  MARK_ROUND_DEGREES,
  MOVE_MIN_KM,
  SAVED_ACCURACY_FALLBACK_KM,
  SHIFT_GATE_MINUTES,
} from "@/constants/CityCheck";
import { FIX_SOURCE } from "@/constants/Location";
import type { CityCheckFix, PlaceMark, ShiftCalc } from "@/types/cityCheck";
import type { Coords } from "@/types/location";
import { maxYearlyShiftMinutes } from "@/utils/cityCheck/shift";
import { distanceBetween } from "@/utils/location";

const STEPS_PER_DEGREE = 1 / MARK_ROUND_DEGREES;

const roundDegrees = (degrees: number) => Math.round(degrees * STEPS_PER_DEGREE) / STEPS_PER_DEGREE;

/** An ISO country code as stored: upper case, or null when there is none. */
export const countryCodeOf = (code: string | null | undefined): string | null =>
  code ? code.toUpperCase() : null;

export const toPlaceMark = (coords: Coords, at: number, countryCode?: string | null): PlaceMark => {
  const code = countryCodeOf(countryCode);
  return {
    lat: roundDegrees(coords.latitude),
    lng: roundDegrees(coords.longitude),
    at,
    ...(code ? { countryCode: code } : {}),
  };
};

export const sameCountry = (a: string, b: string): boolean => a.toUpperCase() === b.toUpperCase();

export const markPoint = (mark: PlaceMark): Coords => ({ latitude: mark.lat, longitude: mark.lng });

// The shortest distance both accuracies allow. An unknown fix accuracy is 0,
// the long side; an unknown place accuracy is the saved-place fallback.
export const conservativeKm = (
  fix: Coords,
  fixAccuracyKm: number | null,
  place: Coords,
  placeAccuracyKm: number | null
): number =>
  distanceBetween(fix, place) -
  (fixAccuracyKm ?? 0) -
  (placeAccuracyKm ?? SAVED_ACCURACY_FALLBACK_KM);

export const matchesMark = (coords: Coords, accuracyKm: number | null, mark: PlaceMark): boolean =>
  conservativeKm(coords, accuracyKm, markPoint(mark), null) <= MOVE_MIN_KM;

// A long distance ends a trip, so only a fresh fix with a known accuracy may.
// The trip ends on the evidence that makes an offer: a shift at the gate or a country change.
const endsTrip = (
  fix: CityCheckFix,
  fixCountry: string | null,
  entry: PlaceMark,
  zone: string,
  calc: ShiftCalc,
  now: number
) =>
  fix.source === FIX_SOURCE.FRESH &&
  fix.accuracyKm !== null &&
  conservativeKm(fix.point, fix.accuracyKm, markPoint(entry), null) > MOVE_MIN_KM &&
  (maxYearlyShiftMinutes(markPoint(entry), fix.point, zone, calc, now) >= SHIFT_GATE_MINUTES ||
    (!!entry.countryCode && fixCountry !== null && !sameCountry(entry.countryCode, fixCountry)));

// A kept entry lasts `KEPT_MAX_AGE_MS` from when it was made; one dated
// after now means the clock moved back, and counts as ended.
export const isLiveKept = (entry: PlaceMark, now: number): boolean =>
  now >= entry.at && now - entry.at <= KEPT_MAX_AGE_MS;

/** The kept entries still live after a confirmed fix. */
export const keptAfterFix = (
  kept: PlaceMark[],
  fix: CityCheckFix,
  zone: string,
  calc: ShiftCalc,
  now: number,
  fixCountry: string | null
): PlaceMark[] =>
  kept.filter(
    (entry) => isLiveKept(entry, now) && !endsTrip(fix, fixCountry, entry, zone, calc, now)
  );

/** The mark first, in place of any entry it matches, capped at `max`. */
export const withMark = (list: PlaceMark[], mark: PlaceMark, max: number): PlaceMark[] => [
  mark,
  ...list.filter((entry) => !matchesMark(markPoint(mark), null, entry)).slice(0, max - 1),
];
