const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Time in the background before a return to the app runs a check. */
export const CHECK_MIN_AWAY_MS = 5 * MINUTE_MS;
/** Least time between two finished checks, unless the phone zone changes. */
export const CHECK_THROTTLE_MS = 30 * MINUTE_MS;
/** Oldest cached fix that may end a check as "not moved". */
export const CACHED_FIX_MAX_AGE_MS = 15 * MINUTE_MS;
/** Longest wait for a fresh fix. */
export const FRESH_FIX_TIMEOUT_MS = 10_000;
/** Least conservative distance that counts as a move. */
export const MOVE_MIN_KM = 10;
/** Accuracy given to a saved place that has none. */
export const SAVED_ACCURACY_FALLBACK_KM = 2;
/** Least wait before the second fix that confirms a move. */
export const CONFIRM_FIX_DELAY_MS = 30_000;
/** Largest distance between two fixes that confirm the same move. */
export const CONFIRM_FIX_AGREE_KM = 5;
/** Largest distance from a fix to the city-list row that names it. */
export const CITY_ROW_TRUST_KM = 25;
/** Least yearly prayer-time shift that makes an offer. */
export const SHIFT_GATE_MINUTES = 1;
/** Days ahead that the yearly shift covers. */
export const SHIFT_HORIZON_DAYS = 365;
/** Most places kept for the trip. */
export const KEPT_MAX = 5;
/** Most places the user muted. */
export const NOT_ASKED_MAX = 10;
/** Age at which a kept place ends. */
export const KEPT_MAX_AGE_MS = 30 * DAY_MS;
/** Oldest confirming fix that an update may use again. */
export const REUSE_FIX_MAX_AGE_MS = 5 * MINUTE_MS;
/** Grid a remembered point is rounded to, about 1 km. */
export const MARK_ROUND_DEGREES = 0.01;
/** Longest wait for the city-check memory before a check ends. */
export const MEMORY_LOAD_TIMEOUT_MS = 5_000;

/** What starts a check. */
export const CITY_CHECK_TRIGGER = {
  LAUNCH: "launch",
  RETURN: "return",
} as const;
export type CityCheckTrigger = (typeof CITY_CHECK_TRIGGER)[keyof typeof CITY_CHECK_TRIGGER];

/** The travel setting. */
export const TRAVEL_MODE = {
  ASK: "ask",
  OFF: "off",
} as const;
export type TravelMode = (typeof TRAVEL_MODE)[keyof typeof TRAVEL_MODE];

/** Why a check does not start. */
export const CITY_CHECK_SKIP = {
  TRAVEL_OFF: "travelOff",
  MANUAL_MODE: "manualMode",
  FIRST_RUN: "firstRun",
  SCREENSHOT_MODE: "screenshotMode",
  APP_NOT_ACTIVE: "appNotActive",
  OFFER_SHOWING: "offerShowing",
  UPDATE_RUNNING: "updateRunning",
  NO_SAVED_PLACE: "noSavedPlace",
  THROTTLED: "throttled",
  AWAY_TOO_SHORT: "awayTooShort",
  MEMORY_NOT_LOADED: "memoryNotLoaded",
} as const;
export type CityCheckSkip = (typeof CITY_CHECK_SKIP)[keyof typeof CITY_CHECK_SKIP];

/** The next fact a check must get before it can judge. */
export const CITY_CHECK_NEED = {
  NEEDS_FRESH_FIX: "needsFreshFix",
  NEEDS_SECOND_FIX: "needsSecondFix",
  NEEDS_CANDIDATE: "needsCandidate",
  NEEDS_COUNTRY: "needsCountry",
} as const;
export type CityCheckNeed = (typeof CITY_CHECK_NEED)[keyof typeof CITY_CHECK_NEED];

/** Why a check ends with no offer. */
export const CITY_CHECK_END = {
  NO_PERMISSION: "noPermission",
  SERVICES_OFF: "servicesOff",
  FIX_FAILED: "fixFailed",
  FIX_NO_ACCURACY: "fixNoAccuracy",
  NOT_MOVED: "notMoved",
  FIXES_DISAGREE: "fixesDisagree",
  CONFIRM_DEFERRED: "confirmDeferred",
  PLACE_CHANGED: "placeChanged",
  KEPT: "kept",
  NOT_ASKED: "notAsked",
  SHIFT_BELOW_GATE: "shiftBelowGate",
  COUNTRY_UNKNOWN: "countryUnknown",
  CHECK_FAILED: "checkFailed",
} as const;
export type CityCheckEnd = (typeof CITY_CHECK_END)[keyof typeof CITY_CHECK_END];

/** Why a check makes an offer. */
export const CITY_CHECK_OFFER = {
  SHIFT: "shift",
  COUNTRY_CHANGES: "countryChanges",
  METHOD_CHANGES: "methodChanges",
} as const;
export type CityCheckOfferReason = (typeof CITY_CHECK_OFFER)[keyof typeof CITY_CHECK_OFFER];

/** Every reason a check logs; log lines carry this code only. */
export const CITY_CHECK_REASON = {
  ...CITY_CHECK_SKIP,
  ...CITY_CHECK_NEED,
  ...CITY_CHECK_END,
  ...CITY_CHECK_OFFER,
} as const;
export type CityCheckReason = (typeof CITY_CHECK_REASON)[keyof typeof CITY_CHECK_REASON];
