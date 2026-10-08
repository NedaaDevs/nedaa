/** testIDs the Maestro flows in .maestro/ci match by exact string. */
export const E2E_ID = {
  ONBOARDING_GET_STARTED: "onboarding-get-started",
  ALARM_ENABLE_SWITCH: "alarm-enable-switch",
} as const;

/** Delays the alarm-debug screen offers for a test alarm. */
export const ALARM_DEBUG_TEST_SECONDS = [10, 30, 60, 180] as const;

export type AlarmDebugTestSeconds = (typeof ALARM_DEBUG_TEST_SECONDS)[number];

/** The alarm-debug button that schedules a test alarm `seconds` from now. */
export const alarmDebugScheduleId = (seconds: AlarmDebugTestSeconds) =>
  `alarm-debug-schedule-${seconds}s`;
