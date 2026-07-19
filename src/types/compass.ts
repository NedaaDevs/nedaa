export type CompassLocationFix = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  altitude: number | null;
  timestamp: number;
};
