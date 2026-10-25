import { TIMES_PLACE, type TimesPlace } from "@/constants/Location";

/** The two facts, as the prayer-times and location stores hold them. */
export type PlaceFacts = { usingDefaultLocation: boolean; hasCoords: boolean };

/** Whose place the times are for, from facts both stores have loaded. */
export const placeFromFacts = ({ usingDefaultLocation, hasCoords }: PlaceFacts): TimesPlace => {
  if (!usingDefaultLocation) return TIMES_PLACE.VERIFIED;
  return hasCoords ? TIMES_PLACE.AWAITING_TIMES : TIMES_PLACE.DEFAULT;
};

/** A point on the map, without a fix's other readings. */
export type Coords = { latitude: number; longitude: number };

export const sameCoords = (a: Coords, b: Coords): boolean =>
  a.latitude === b.latitude && a.longitude === b.longitude;

/** The stored days were fetched for other coordinates than the place's. */
export const timesMoved = (timesCoords: Coords | null, place: Coords): boolean =>
  timesCoords !== null && !sameCoords(timesCoords, place);
