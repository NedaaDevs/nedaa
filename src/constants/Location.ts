/** What the location store writes for a city or country it could not name. */
export const PLACE_UNKNOWN = "N/A";

/** Whose place the stored prayer times are for, from both persisted stores. */
export const TIMES_PLACE = {
  /** A store has not loaded from disk, so its fact is not known. */
  UNKNOWN: "unknown",
  /** Times loaded for the user's coordinates, kept if the fix is cleared. */
  VERIFIED: "verified",
  /** No coordinates, and the default place's times. */
  DEFAULT: "default",
  /** Saved coordinates whose times have not replaced the default place's. */
  AWAITING_TIMES: "awaitingTimes",
} as const;
export type TimesPlace = (typeof TIMES_PLACE)[keyof typeof TIMES_PLACE];
