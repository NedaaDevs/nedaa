export type OrientationSource =
  "fop" | "rotation_vector" | "accelerometer_magnetometer" | "cl_location" | "unknown";

export type OrientationNorthReference = "true" | "magnetic" | "unknown";

export type OrientationStartOptions = {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  locationTimestamp?: number;
};

export type OrientationData = {
  heading: number;
  accuracyDegrees: number | null;
  northReference: OrientationNorthReference;
  isValid: boolean;
  timestamp: number;
  source: OrientationSource;
  error?: string;
};
