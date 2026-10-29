/** How a step the background task logged ended. */
export const TASK_RESULT = {
  SUCCESS: "success",
  FAILED: "failed",
  SKIPPED: "skipped",
} as const;
export type TaskResult = (typeof TASK_RESULT)[keyof typeof TASK_RESULT];

/** The steps the background refresh writes to the task log. */
export const BACKGROUND_EVENT = {
  TASK_STARTED: "task_started",
  HYDRATION_TIMEOUT: "hydration_timeout",
  HYDRATION_INCOMPLETE: "hydration_incomplete",
  NO_TIMEZONE: "no_timezone",
  FETCHING_PRAYER_TIMES: "fetching_prayer_times",
  PRAYER_TIMES_SUPERSEDED: "prayer_times_superseded",
  PRAYER_TIMES_FETCHED: "prayer_times_fetched",
  PRAYER_TIMES_FETCH_FAILED: "prayer_times_fetch_failed",
  PRAYER_TIMES_FETCH_ERROR: "prayer_times_fetch_error",
  DATA_SUFFICIENT: "data_sufficient",
  ALARMS_MOVED: "alarms_moved",
  TASK_COMPLETED: "task_completed",
  SCHEDULE_FAILED: "schedule_failed",
  TASK_ERROR: "task_error",
  RUN_COALESCED: "run_coalesced",
  TASK_EXPIRED: "task_expired",
  REGISTRATION: "registration",
  REGISTERED: "registered",
  REGISTRATION_ERROR: "registration_error",
  UNREGISTRATION_ERROR: "unregistration_error",
} as const;
export type BackgroundEvent = (typeof BACKGROUND_EVENT)[keyof typeof BACKGROUND_EVENT];
