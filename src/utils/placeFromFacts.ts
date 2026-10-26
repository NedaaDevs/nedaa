import { TIMES_PLACE, type TimesPlace } from "@/constants/Location";
import type { Coords } from "@/types/location";

/** The two facts, as the prayer-times and location stores hold them. */
export type PlaceFacts = { usingDefaultLocation: boolean; hasCoords: boolean };

/** Whose place the times are for, from facts both stores have loaded. */
export const placeFromFacts = ({ usingDefaultLocation, hasCoords }: PlaceFacts): TimesPlace => {
  if (!usingDefaultLocation) return TIMES_PLACE.VERIFIED;
  return hasCoords ? TIMES_PLACE.AWAITING_TIMES : TIMES_PLACE.DEFAULT;
};

/** Drift still counted as the same place; 0.01° of longitude is 2.4 s. */
const TIMES_DRIFT_DEGREES = 0.01;

/** The stored days were fetched for another place than `place`. */
export const timesMoved = (timesCoords: Coords | null, place: Coords): boolean =>
  timesCoords !== null &&
  (Math.abs(timesCoords.latitude - place.latitude) > TIMES_DRIFT_DEGREES ||
    Math.abs(timesCoords.longitude - place.longitude) > TIMES_DRIFT_DEGREES);
