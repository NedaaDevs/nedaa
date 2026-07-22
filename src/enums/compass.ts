export const CompassLocationSource = {
  FRESH: "fresh",
  SAVED: "saved",
  NONE: "none",
} as const;

export type CompassLocationSourceValue =
  (typeof CompassLocationSource)[keyof typeof CompassLocationSource];

export const CompassLocationPermissionAccuracy = {
  UNKNOWN: "unknown",
  PRECISE: "precise",
  REDUCED: "reduced",
} as const;

export type CompassLocationPermissionAccuracyValue =
  (typeof CompassLocationPermissionAccuracy)[keyof typeof CompassLocationPermissionAccuracy];

export const CompassNorthReference = {
  TRUE: "true",
  MAGNETIC: "magnetic",
  UNKNOWN: "unknown",
} as const;

export type CompassNorthReferenceValue =
  (typeof CompassNorthReference)[keyof typeof CompassNorthReference];

export const CompassSensorReliability = {
  GOOD: "good",
  FAIR: "fair",
  NEEDS_CALIBRATION: "needsCalibration",
  UNKNOWN: "unknown",
} as const;

export type CompassSensorReliabilityValue =
  (typeof CompassSensorReliability)[keyof typeof CompassSensorReliability];

export const CompassReliabilityIssue = {
  LOCATION_REQUIRED: "location_required",
  LOCATION_PERMISSION_DENIED: "location_permission_denied",
  LOCATION_PERMISSION_BLOCKED: "location_permission_blocked",
  LOCATION_SERVICES_DISABLED: "location_services_disabled",
  LOCATION_TIMEOUT: "location_timeout",
  LOCATION_REDUCED_ACCURACY: "location_reduced_accuracy",
  LOCATION_TOO_INACCURATE: "location_too_inaccurate",
  LOCATION_STALE: "location_stale",
  SENSOR_UNAVAILABLE: "sensor_unavailable",
  SENSOR_ACCURACY_UNAVAILABLE: "sensor_accuracy_unavailable",
  SENSOR_STARTING: "sensor_starting",
  SENSOR_STALE: "sensor_stale",
  SENSOR_INVALID: "sensor_invalid",
  SENSOR_UNCALIBRATED: "sensor_uncalibrated",
  TRUE_NORTH_UNAVAILABLE: "true_north_unavailable",
} as const;

export type CompassReliabilityIssueValue =
  (typeof CompassReliabilityIssue)[keyof typeof CompassReliabilityIssue];
