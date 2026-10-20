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

/** Why a device position read ended with no position. */
export const LOCATION_FAILURE = {
  DENIED: "denied",
  SERVICES_OFF: "servicesOff",
  TIMEOUT: "timeout",
  UNAVAILABLE: "unavailable",
} as const;
export type LocationFailure = (typeof LOCATION_FAILURE)[keyof typeof LOCATION_FAILURE];

/** Where a device position came from. */
export const FIX_SOURCE = {
  FRESH: "fresh",
  LAST_KNOWN: "lastKnown",
} as const;
export type FixSource = (typeof FIX_SOURCE)[keyof typeof FIX_SOURCE];
