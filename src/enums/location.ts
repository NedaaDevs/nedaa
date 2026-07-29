export enum LocalPermissionStatus {
  UNDETERMINED = "undetermined",
  DENIED = "denied",
  GRANTED = "granted",
}

export const LocationAccuracy = {
  LOW: 2,
  HIGH: 4,
} as const;

export type LocationAccuracyValue = (typeof LocationAccuracy)[keyof typeof LocationAccuracy];

/** Whether coordinates come from the device or from a city the user picked. */
export const LocationMode = {
  DEVICE: "device",
  MANUAL: "manual",
} as const;

export type LocationModeValue = (typeof LocationMode)[keyof typeof LocationMode];
