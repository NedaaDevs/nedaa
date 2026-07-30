export enum LocalPermissionStatus {
  GRANTED = "granted",
  DENIED = "denied",
  UNDETERMINED = "undetermined",
}

// Expected conditions under which a scheduling run is a no-op rather than a failure.
export const SchedulingSkipReason = {
  PERMISSION_NOT_GRANTED: "permissionNotGranted",
  NO_PRAYER_TIMES: "noPrayerTimes",
} as const;

export type SchedulingSkipReasonValue =
  (typeof SchedulingSkipReason)[keyof typeof SchedulingSkipReason];
