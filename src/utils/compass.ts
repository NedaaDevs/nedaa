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

export type QiblaProximityState = "searching" | "approaching" | "aligned";

const ALIGNED_THRESHOLD = 5;
const APPROACHING_THRESHOLD = 15;

export const getQiblaProximityState = (
  heading: number,
  qiblaDirection: number
): QiblaProximityState => {
  const diff = Math.abs(angleDifference(heading, qiblaDirection));
  if (diff <= ALIGNED_THRESHOLD) return "aligned";
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
