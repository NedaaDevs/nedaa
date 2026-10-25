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

/** The unit a device fix's age is named in. */
export const FIX_AGE_UNIT = {
  NOW: "now",
  MINUTES: "minutes",
  HOURS: "hours",
  DAYS: "days",
} as const;
export type FixAgeUnit = (typeof FIX_AGE_UNIT)[keyof typeof FIX_AGE_UNIT];

/** A location update's steps in order, and DONE once every one has run. */
export const UPDATE_STEP = {
  LOCATION: "location",
  PRAYER_TIMES: "prayerTimes",
  NOTIFICATIONS: "notifications",
  ALARMS: "alarms",
  DONE: "done",
} as const;
export type UpdateStep = (typeof UPDATE_STEP)[keyof typeof UPDATE_STEP];

/** The Android settings page that turns location services on. */
export const ANDROID_LOCATION_SETTINGS = "android.settings.LOCATION_SOURCE_SETTINGS";

/** What a city picker shows: the city list, or coordinate entry. */
export const CITY_PICKER_VIEW = { LIST: "list", COORDINATES: "coordinates" } as const;
export type CityPickerView = (typeof CITY_PICKER_VIEW)[keyof typeof CITY_PICKER_VIEW];

/** The city picker's route, and the search param naming its first view. */
export const LOCATION_PICKER = { href: "/settings/location-picker", viewParam: "view" } as const;

/** What the Location screen shows below its hero. */
export const LOCATION_ROOT_STATE = {
  /** The first permission check has not answered. */
  CHECKING: "checking",
  DEVICE: "device",
  MANUAL: "manual",
  /** No access yet, and the system can still ask. */
  PERMISSION: "permission",
  /** Access refused; only Settings can give it. */
  DENIED: "denied",
  FAILURE: "failure",
} as const;
export type LocationRootState = (typeof LOCATION_ROOT_STATE)[keyof typeof LOCATION_ROOT_STATE];
