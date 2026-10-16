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
import { withDeadline } from "@/utils/withTimeout";

const log = AppLogger.create("location");

// Constants
export const CITY_CHANGE_THRESHOLD = 10; // km - minimum distance to consider city change
// Bounds a position read that blocks the launch fetch: Today shows its loading state
// until it settles, so it stays short even though a cold fix can take longer.
export const LOCATION_REQUEST_TIMEOUT = 10000; // 10 seconds
// For a read behind a spinner; the permission check and the fix share it.
export const LOCATION_REQUEST_TIMEOUT_EXTENDED = 35000; // 35 seconds

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

const TIMED_OUT = "Location request timed out";

// One gate for every read: an unpermitted native read logs as a failure.
const readPosition = async (inTime: () => boolean): Promise<LocationObject> => {
  const { granted } = await checkLocationPermission();
  if (!granted) {
    log.w("Position", "location request skipped; permission not granted");
    throw new LocationPermissionError();
  }
  // A check that answers after the deadline starts no fix; nobody waits for it.
  if (!inTime()) throw new Error(TIMED_OUT);
  return getCurrentPositionAsync({ accuracy: LocationAccuracy.LOW });
};

// One deadline covers the permission check and the fix; either can stall.
export const getLocationWithTimeout = async (
  timeoutMs: number = LOCATION_REQUEST_TIMEOUT
): Promise<LocationObject> => {
  try {
    return await withDeadline(readPosition, timeoutMs, TIMED_OUT);
  } catch (error) {
    if (!(error instanceof LocationPermissionError)) {
      log.e("Position", "location request failed", error instanceof Error ? error : undefined);
    }
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
