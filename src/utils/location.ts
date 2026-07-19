import {
  getCurrentPositionAsync,
  getForegroundPermissionsAsync,
  requestForegroundPermissionsAsync,
  LocationAccuracy,
  type LocationObject,
} from "@/adapters/location";

// Enums
import { LocalPermissionStatus } from "@/enums/location";

import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("location");

// Constants
export const CITY_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
export const CITY_CHANGE_THRESHOLD = 10; // km - minimum distance to consider city change
export const LOCATION_REQUEST_TIMEOUT = 10000; // 10 seconds

export const mapToLocalStatus = (status: LocalPermissionStatus): LocalPermissionStatus => {
  switch (status) {
    case LocalPermissionStatus.GRANTED:
      return LocalPermissionStatus.GRANTED;
    case LocalPermissionStatus.DENIED:
      return LocalPermissionStatus.DENIED;
    default:
      return LocalPermissionStatus.UNDETERMINED;
  }
};

export const checkLocationPermission = async () => {
  try {
    const { status, canAskAgain } = await getForegroundPermissionsAsync();

    return { granted: status === LocalPermissionStatus.GRANTED, canRequestAgain: canAskAgain };
  } catch (error) {
    log.w("Permission", `check failed: ${(error as Error)?.message ?? error}`);
    return {
      granted: false,
      canRequestAgain: true,
    };
  }
};

export const requestLocationPermission = async () => {
  try {
    const { status } = await requestForegroundPermissionsAsync();
    return { granted: status === LocalPermissionStatus.GRANTED };
  } catch (error) {
    log.w("Permission", `request failed: ${(error as Error)?.message ?? error}`);
    return { granted: false, error };
  }
};

/** Thrown instead of calling the native provider when location permission is missing. */
export class LocationPermissionError extends Error {
  constructor() {
    super("Location permission not granted");
    this.name = "LocationPermissionError";
  }
}

// Get location with timeout protection(sometimes getting location get stuck)
export const getLocationWithTimeout = async (): Promise<LocationObject> => {
  // Every position read funnels through here, so the permission gate lives here. Calling the
  // native provider unpermitted rejects with "Not authorized to use location services", which
  // reads as a hard failure in the logs even when the user simply declined.
  const { granted } = await checkLocationPermission();
  if (!granted) {
    log.w("Position", "location request skipped; permission not granted");
    throw new LocationPermissionError();
  }

  try {
    const locationPromise = getCurrentPositionAsync({
      accuracy: LocationAccuracy.LOW,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Location request timed out")), LOCATION_REQUEST_TIMEOUT);
    });

    return await Promise.race([locationPromise, timeoutPromise]);
  } catch (error) {
    log.e("Position", "location request failed", error instanceof Error ? error : undefined);
    throw error;
  }
};

// Calculate distance between coordinates
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const getCurrentLocation = async () => {
  // First check permission
  const { granted, canRequestAgain } = await checkLocationPermission();

  if (!granted) {
    // A blocked permission cannot be re-requested; only a trip to app settings clears it.
    if (!canRequestAgain) {
      return { error: "Location permission denied" };
    }

    const { granted: newPermission } = await requestLocationPermission();
    if (!newPermission) {
      return { error: "Location permission denied" };
    }
  }

  // Now get location with timeout protection
  try {
    const location = await getLocationWithTimeout();
    return { location };
  } catch (error: any) {
    return { error: error.message };
  }
};
