import {
  CompassNorthReference,
  CompassReliabilityIssue,
  CompassSensorReliability,
  type CompassReliabilityIssueValue,
  type CompassSensorReliabilityValue,
} from "@/enums/compass";
import type { CompassLocationFix } from "@/types/compass";

export const KAABA_COORDINATES = {
  latitude: 21.422487,
  longitude: 39.826206,
};

/**
 * Calculate the Qibla direction (bearing to Mecca) from a given location
 * @param fromLatitude - Current location latitude
 * @param fromLongitude - Current location longitude
 * @returns Bearing in degrees (0-360) where 0 is North
 */
export const calculateQiblaDirection = (fromLatitude: number, fromLongitude: number): number => {
  const lat1 = toRadians(fromLatitude);
  const lat2 = toRadians(KAABA_COORDINATES.latitude);
  const deltaLon = toRadians(KAABA_COORDINATES.longitude - fromLongitude);

  const x = Math.sin(deltaLon) * Math.cos(lat2);
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

  let bearing = Math.atan2(x, y);

  // Convert from radians to degrees
  bearing = toDegrees(bearing);

  // Normalize to 0-360 degrees
  return (bearing + 360) % 360;
};

/**
 * Calculate the distance to Mecca from a given location
 * @param fromLatitude - Current location latitude
 * @param fromLongitude - Current location longitude
 * @returns Distance in kilometers
 */
export const calculateDistanceToMecca = (fromLatitude: number, fromLongitude: number): number => {
  const lat1 = toRadians(fromLatitude);
  const lat2 = toRadians(KAABA_COORDINATES.latitude);
  const deltaLat = toRadians(KAABA_COORDINATES.latitude - fromLatitude);
  const deltaLon = toRadians(KAABA_COORDINATES.longitude - fromLongitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const earthRadius = 6371; // Earth's radius in kilometers

  return earthRadius * c;
};

/**
 * Get translated compass direction name from degrees
 * @param degrees - Heading in degrees (0-360)
 * @param t - Translation function
 * @returns Translated direction name
 */
export const getTranslatedCompassDirection = (
  degrees: number,
  t: (key: string) => string
): string => {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(degrees / 45) % 8;
  const direction = directions[index];
  return t(`compass.directions.${direction}`);
};

/**
 * Calculate the difference between two angles
 * @param angle1 - First angle in degrees
 * @param angle2 - Second angle in degrees
 * @returns Difference in degrees (-180 to 180)
 */
export const angleDifference = (angle1: number, angle2: number): number => {
  let diff = angle2 - angle1;

  // Normalize to -180 to 180
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;

  return diff;
};

export const MAX_HEADING_ERROR_DEGREES = 30;
export const MAX_BEARING_ERROR_DEGREES = 5;
export const MAX_ALIGNMENT_COMBINED_ERROR_DEGREES = 15;
export const MAX_HEADING_AGE_MS = 3_000;
export const MAX_HEADING_FUTURE_SKEW_MS = 1_000;
export const MAX_FRESH_LOCATION_AGE_MS = 2 * 60 * 1_000;
export const MAX_SAVED_LOCATION_AGE_MS = 24 * 60 * 60 * 1_000;

export type CompassLocationAge = {
  unit: "now" | "minutes" | "hours";
  value: number;
};

export const getCompassLocationAge = (timestamp: number, now = Date.now()): CompassLocationAge => {
  const ageMs = Math.max(0, now - timestamp);
  if (ageMs < 60_000) return { unit: "now", value: 0 };
  if (ageMs < 60 * 60_000) {
    return { unit: "minutes", value: Math.floor(ageMs / 60_000) };
  }
  return { unit: "hours", value: Math.floor(ageMs / (60 * 60_000)) };
};

export const getCompassSensorReliability = (
  accuracyDegrees: number | null
): CompassSensorReliabilityValue => {
  if (accuracyDegrees === null || !Number.isFinite(accuracyDegrees) || accuracyDegrees < 0) {
    return CompassSensorReliability.UNKNOWN;
  }
  if (accuracyDegrees > MAX_HEADING_ERROR_DEGREES) {
    return CompassSensorReliability.NEEDS_CALIBRATION;
  }
  if (accuracyDegrees > MAX_ALIGNMENT_COMBINED_ERROR_DEGREES) {
    return CompassSensorReliability.FAIR;
  }
  return CompassSensorReliability.GOOD;
};

const nativeCompassErrorIssues: Record<string, CompassReliabilityIssueValue> = {
  module_unavailable: CompassReliabilityIssue.SENSOR_UNAVAILABLE,
  sensor_unavailable: CompassReliabilityIssue.SENSOR_UNAVAILABLE,
  sensor_registration_failed: CompassReliabilityIssue.SENSOR_UNAVAILABLE,
  startup_failed: CompassReliabilityIssue.SENSOR_UNAVAILABLE,
  startup_timeout: CompassReliabilityIssue.SENSOR_UNAVAILABLE,
  stale_heading: CompassReliabilityIssue.SENSOR_STALE,
  sensor_unreliable: CompassReliabilityIssue.SENSOR_UNCALIBRATED,
  heading_accuracy_unavailable: CompassReliabilityIssue.SENSOR_ACCURACY_UNAVAILABLE,
  invalid_accuracy: CompassReliabilityIssue.SENSOR_UNCALIBRATED,
  invalid_heading: CompassReliabilityIssue.SENSOR_INVALID,
  invalid_timestamp: CompassReliabilityIssue.SENSOR_INVALID,
};

export const getNativeCompassReliabilityIssue = (
  error: string | null
): CompassReliabilityIssueValue | null =>
  error ? (nativeCompassErrorIssues[error] ?? null) : null;

export const getCompassSensorIssueAction = (
  issue: CompassReliabilityIssueValue | null
): "retry" | "calibrate" | null => {
  if (issue === null) return null;
  if (issue === CompassReliabilityIssue.SENSOR_ACCURACY_UNAVAILABLE) return null;
  if (issue === CompassReliabilityIssue.SENSOR_UNCALIBRATED) return "calibrate";
  return "retry";
};

type HeadingReliabilitySample = {
  heading: number;
  accuracyDegrees: number | null;
  northReference: (typeof CompassNorthReference)[keyof typeof CompassNorthReference];
  isValid: boolean;
  timestamp: number;
};

type HeadingReliabilityOptions = {
  now?: number;
  requiresTrueNorth: boolean;
};

/**
 * Returns the reason a heading must be withheld, or null when it is safe to display.
 */
export const getHeadingReliabilityIssue = (
  sample: HeadingReliabilitySample,
  { now = Date.now(), requiresTrueNorth }: HeadingReliabilityOptions
): (typeof CompassReliabilityIssue)[keyof typeof CompassReliabilityIssue] | null => {
  if (
    !sample.isValid ||
    !Number.isFinite(sample.heading) ||
    sample.heading < 0 ||
    sample.heading >= 360 ||
    !Number.isFinite(sample.timestamp) ||
    sample.timestamp > now + MAX_HEADING_FUTURE_SKEW_MS
  ) {
    return CompassReliabilityIssue.SENSOR_INVALID;
  }

  if (now - sample.timestamp > MAX_HEADING_AGE_MS) {
    return CompassReliabilityIssue.SENSOR_STALE;
  }

  if (
    sample.accuracyDegrees === null ||
    !Number.isFinite(sample.accuracyDegrees) ||
    sample.accuracyDegrees < 0
  ) {
    return CompassReliabilityIssue.SENSOR_INVALID;
  }

  if (sample.accuracyDegrees > MAX_HEADING_ERROR_DEGREES) {
    return CompassReliabilityIssue.SENSOR_UNCALIBRATED;
  }

  if (sample.northReference === CompassNorthReference.UNKNOWN) {
    return requiresTrueNorth
      ? CompassReliabilityIssue.TRUE_NORTH_UNAVAILABLE
      : CompassReliabilityIssue.SENSOR_INVALID;
  }

  if (requiresTrueNorth && sample.northReference !== CompassNorthReference.TRUE) {
    return CompassReliabilityIssue.TRUE_NORTH_UNAVAILABLE;
  }

  return null;
};

/**
 * Converts horizontal coordinate uncertainty into its worst-case bearing error.
 */
export const calculateBearingUncertaintyDegrees = (
  accuracyMeters: number,
  distanceMeters: number
): number => {
  if (!Number.isFinite(accuracyMeters) || accuracyMeters < 0 || !Number.isFinite(distanceMeters)) {
    return Number.POSITIVE_INFINITY;
  }

  if (distanceMeters <= 0) return 90;
  return toDegrees(Math.atan2(accuracyMeters, distanceMeters));
};

/**
 * Alignment claims and haptics use a stricter combined uncertainty than the dial display.
 */
export const canProvideAlignmentFeedback = (
  headingErrorDegrees: number | null,
  bearingErrorDegrees: number
): boolean =>
  headingErrorDegrees !== null &&
  Number.isFinite(headingErrorDegrees) &&
  headingErrorDegrees >= 0 &&
  Number.isFinite(bearingErrorDegrees) &&
  bearingErrorDegrees >= 0 &&
  headingErrorDegrees + bearingErrorDegrees <= MAX_ALIGNMENT_COMBINED_ERROR_DEGREES;

type LocationReliabilityOptions = {
  now?: number;
  isSaved: boolean;
};

/**
 * Validates both a fix and its angular usefulness for the Qibla bearing.
 */
export const getLocationReliabilityIssue = (
  fix: CompassLocationFix,
  { now = Date.now(), isSaved }: LocationReliabilityOptions
): (typeof CompassReliabilityIssue)[keyof typeof CompassReliabilityIssue] | null => {
  if (
    !Number.isFinite(fix.latitude) ||
    !Number.isFinite(fix.longitude) ||
    fix.latitude < -90 ||
    fix.latitude > 90 ||
    fix.longitude < -180 ||
    fix.longitude > 180 ||
    !Number.isFinite(fix.accuracyMeters) ||
    fix.accuracyMeters <= 0 ||
    !Number.isFinite(fix.timestamp) ||
    fix.timestamp > now + MAX_FRESH_LOCATION_AGE_MS
  ) {
    return CompassReliabilityIssue.LOCATION_TOO_INACCURATE;
  }

  const maxAge = isSaved ? MAX_SAVED_LOCATION_AGE_MS : MAX_FRESH_LOCATION_AGE_MS;
  if (now - fix.timestamp > maxAge) {
    return CompassReliabilityIssue.LOCATION_STALE;
  }

  const distanceMeters = calculateDistanceToMecca(fix.latitude, fix.longitude) * 1_000;
  const bearingError = calculateBearingUncertaintyDegrees(fix.accuracyMeters, distanceMeters);

  if (bearingError > MAX_BEARING_ERROR_DEGREES) {
    return CompassReliabilityIssue.LOCATION_TOO_INACCURATE;
  }

  return null;
};

/**
 * Extends normalized headings into a continuous value for shortest-arc animation.
 */
export const unwrapHeading = (previousUnwrapped: number, nextHeading: number): number => {
  const previousNormalized = ((previousUnwrapped % 360) + 360) % 360;
  const nextNormalized = ((nextHeading % 360) + 360) % 360;
  return previousUnwrapped + angleDifference(previousNormalized, nextNormalized);
};

export type QiblaProximityState = "searching" | "approaching" | "aligned";

const ALIGNED_ENTER_THRESHOLD = 5;
const ALIGNED_EXIT_THRESHOLD = 8;
const APPROACHING_THRESHOLD = 15;

export const getQiblaProximityState = (
  heading: number,
  qiblaDirection: number,
  previousState: QiblaProximityState = "searching"
): QiblaProximityState => {
  const diff = Math.abs(angleDifference(heading, qiblaDirection));
  if (
    diff <= ALIGNED_ENTER_THRESHOLD ||
    (previousState === "aligned" && diff <= ALIGNED_EXIT_THRESHOLD)
  ) {
    return "aligned";
  }
  if (diff <= APPROACHING_THRESHOLD) return "approaching";
  return "searching";
};

export const formatDistanceToMecca = (
  latitude: number,
  longitude: number,
  unit: string
): string => {
  const distance = calculateDistanceToMecca(latitude, longitude);
  const rounded = Math.round(distance);
  return `${rounded.toLocaleString()} ${unit}`;
};

// Helper functions
const toRadians = (degrees: number): number => degrees * (Math.PI / 180);
const toDegrees = (radians: number): number => radians * (180 / Math.PI);
