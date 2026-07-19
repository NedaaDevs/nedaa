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
