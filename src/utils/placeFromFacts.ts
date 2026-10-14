import { TIMES_PLACE, type TimesPlace } from "@/constants/Location";

/** The two facts, as the prayer-times and location stores hold them. */
export type PlaceFacts = { usingDefaultLocation: boolean; hasCoords: boolean };

/** Whose place the times are for, from facts both stores have loaded. */
export const placeFromFacts = ({ usingDefaultLocation, hasCoords }: PlaceFacts): TimesPlace => {
  if (!usingDefaultLocation) return TIMES_PLACE.VERIFIED;
  return hasCoords ? TIMES_PLACE.AWAITING_TIMES : TIMES_PLACE.DEFAULT;
};
