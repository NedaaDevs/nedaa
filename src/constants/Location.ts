import { BACK_DESTINATION } from "@/constants/BackDestinations";

/** What the location store writes for a city or country it could not name. */
export const PLACE_UNKNOWN = "N/A";

/** A city or country name, unless it is missing or the unnamed mark. */
export const knownPlaceName = (name: string | null | undefined): string | undefined =>
  name && name !== PLACE_UNKNOWN ? name : undefined;

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

/** A location update's steps, in the order they run. */
export const UPDATE_STEP = {
  LOCATION: "location",
  PRAYER_TIMES: "prayerTimes",
  NOTIFICATIONS: "notifications",
  ALARMS: "alarms",
} as const;
export type UpdateStep = (typeof UPDATE_STEP)[keyof typeof UPDATE_STEP];

/** What one update step did. */
export const STEP_OUTCOME = {
  DONE: "done",
  /** The step had nothing to do: off, or not allowed. */
  SKIPPED: "skipped",
  /** Some of the step's work landed. */
  PARTIAL: "partial",
  FAILED: "failed",
} as const;
export type StepOutcome = (typeof STEP_OUTCOME)[keyof typeof STEP_OUTCOME];

/** How a location update ended. */
export const RUN_END = {
  /** Every step ran and none stopped the run. */
  LANDED: "landed",
  /** A step's outcome stopped the run. */
  STOPPED: "stopped",
  /** Another update was in flight, so this one never started. */
  REFUSED: "refused",
} as const;

/** Where a location update takes its place from. */
export const UPDATE_START = {
  /** A fresh device read, in device mode. */
  DEVICE: "device",
  /** A device read that replaces a chosen city once it lands. */
  ADOPT_DEVICE: "adoptDevice",
  /** A city the user chose. */
  CITY: "city",
} as const;

/** The rows an update's progress shows; the later two steps share the last. */
export const PROGRESS_ROW = {
  PLACE: "place",
  TIMES: "times",
  ALERTS: "alerts",
} as const;
export type ProgressRow = (typeof PROGRESS_ROW)[keyof typeof PROGRESS_ROW];

/** The Android settings page that turns location services on. */
export const ANDROID_LOCATION_SETTINGS = "android.settings.LOCATION_SOURCE_SETTINGS";

/** What a city picker shows: the city list, or coordinate entry. */
export const CITY_PICKER_VIEW = { LIST: "list", COORDINATES: "coordinates" } as const;
export type CityPickerView = (typeof CITY_PICKER_VIEW)[keyof typeof CITY_PICKER_VIEW];

/** What the city-change sheet shows under the two cities. */
export const CITY_CHANGE_VIEW = {
  /** Update, or keep the saved city. */
  OFFER: "offer",
  /** The sheet's update, step by step. */
  RUNNING: "running",
  /** Where that update stopped. */
  STOPPED: "stopped",
} as const;
export type CityChangeView = (typeof CITY_CHANGE_VIEW)[keyof typeof CITY_CHANGE_VIEW];

/** The search param naming the city picker's view. */
export const LOCATION_PICKER = { viewParam: "view" } as const;

/** The route that opens the city picker on one view. */
export const locationPickerRoute = (view: CityPickerView) => ({
  pathname: BACK_DESTINATION.SETTINGS_LOCATION_PICKER.href,
  params: { [LOCATION_PICKER.viewParam]: view },
});

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
  /** An update runs; the screen shows its steps. */
  UPDATING: "updating",
} as const;
export type LocationRootState = (typeof LOCATION_ROOT_STATE)[keyof typeof LOCATION_ROOT_STATE];
