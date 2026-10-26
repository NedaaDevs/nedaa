import {
  getCurrentPositionAsync,
  getForegroundPermissionsAsync,
  getLastKnownPositionAsync,
  hasServicesEnabledAsync,
  requestForegroundPermissionsAsync,
  LocationAccuracy,
  type LocationObject,
} from "@/adapters/location";
import {
  FIX_SOURCE,
  LOCATION_FAILURE,
  type FixSource,
  type LocationFailure,
} from "@/constants/Location";

// Enums
import { LocalPermissionStatus } from "@/enums/location";
import type { LocationPermission } from "@/types/location";

import { AppLogger } from "@/utils/appLogger";
import { errorText } from "@/utils/errorText";
import { withDeadline, withTimeout } from "@/utils/withTimeout";

const log = AppLogger.create("location");

// Constants
export const CITY_CHANGE_THRESHOLD = 10; // km - minimum distance to consider city change
// Bounds a position read that blocks the launch fetch: Today shows its loading state
// until it settles, so it stays short even though a cold fix can take longer.
export const LOCATION_REQUEST_TIMEOUT = 10000; // 10 seconds
// For a read behind a spinner; the permission check and the fix share it.
export const LOCATION_REQUEST_TIMEOUT_EXTENDED = 35000; // 35 seconds
// Prayer times need only the city, which a fix this old still names.
export const LAST_KNOWN_MAX_AGE_MS = 6 * 60 * 60 * 1000;
// The cached-fix read is local; one that stalls counts as no cached fix.
const LAST_KNOWN_REQUEST_TIMEOUT = 3000;

export const checkLocationPermission = async (): Promise<LocationPermission> => {
  try {
    const { status, canAskAgain } = await getForegroundPermissionsAsync();

    return { granted: status === LocalPermissionStatus.GRANTED, canAskAgain };
  } catch (error) {
    log.w("Permission", `check failed: ${errorText(error)}`);
    return {
      granted: false,
      canAskAgain: true,
    };
  }
};

export const requestLocationPermission = async () => {
  try {
    const { status } = await requestForegroundPermissionsAsync();
    return { granted: status === LocalPermissionStatus.GRANTED };
  } catch (error) {
    log.w("Permission", `request failed: ${errorText(error)}`);
    return { granted: false, error };
  }
};

const TIMED_OUT = "Location request timed out";

const FAILURE_MESSAGE: Record<LocationFailure, string> = {
  [LOCATION_FAILURE.DENIED]: "Location permission not granted",
  [LOCATION_FAILURE.SERVICES_OFF]: "Location services are off",
  [LOCATION_FAILURE.TIMEOUT]: TIMED_OUT,
  [LOCATION_FAILURE.UNAVAILABLE]: "No location available",
};

/** A device position read that ended with no position, and why. */
export class LocationFixError extends Error {
  readonly kind: LocationFailure;

  constructor(kind: LocationFailure, options?: { cause?: unknown }) {
    super(FAILURE_MESSAGE[kind], options);
    this.name = "LocationFixError";
    this.kind = kind;
  }
}

/** Thrown instead of calling the native provider when location permission is missing. */
export class LocationPermissionError extends LocationFixError {
  constructor() {
    super(LOCATION_FAILURE.DENIED);
    this.name = "LocationPermissionError";
  }
}

/** The failure kind of any error a location read or apply produced. */
export const locationFailureOf = (error: unknown): LocationFailure =>
  error instanceof LocationFixError ? error.kind : LOCATION_FAILURE.UNAVAILABLE;

export type LocationFix = { location: LocationObject; source: FixSource };

// A failed services check gives no verdict, so it counts as services on.
const servicesEnabled = (): Promise<boolean> =>
  hasServicesEnabledAsync().catch((error: unknown) => {
    log.w("Position", `services check failed: ${errorText(error)}`);
    return true;
  });

// One gate for every read: an unpermitted native read logs as a failure.
const readPosition = async (inTime: () => boolean): Promise<LocationObject> => {
  const { granted } = await checkLocationPermission();
  if (!granted) {
    log.w("Position", "location request skipped; permission not granted");
    throw new LocationPermissionError();
  }
  // A check that answers after the deadline starts no fix; nobody waits for it.
  if (!inTime()) throw new LocationFixError(LOCATION_FAILURE.TIMEOUT);
  try {
    return await getCurrentPositionAsync({ accuracy: LocationAccuracy.LOW });
  } catch (error) {
    const kind = (await servicesEnabled())
      ? LOCATION_FAILURE.UNAVAILABLE
      : LOCATION_FAILURE.SERVICES_OFF;
    throw new LocationFixError(kind, { cause: error });
  }
};

// Only a read that may still succeed later falls back to the cached fix.
const mayFallBack = (kind: LocationFailure): boolean => {
  switch (kind) {
    case LOCATION_FAILURE.TIMEOUT:
    case LOCATION_FAILURE.UNAVAILABLE:
      return true;
    case LOCATION_FAILURE.DENIED:
    case LOCATION_FAILURE.SERVICES_OFF:
      return false;
    default: {
      const unhandled: never = kind;
      return unhandled;
    }
  }
};

const readLastKnown = (): Promise<LocationObject | null> =>
  withTimeout(
    getLastKnownPositionAsync(LAST_KNOWN_MAX_AGE_MS).catch((error: unknown) => {
      log.w("Position", `cached fix read failed: ${errorText(error)}`);
      return null;
    }),
    LAST_KNOWN_REQUEST_TIMEOUT,
    null
  );

/**
 * A device position and its source. A timed-out or unavailable read falls back
 * to a recent cached fix; with none, it rejects with a `LocationFixError`.
 */
export const readLocation = async (
  timeoutMs: number = LOCATION_REQUEST_TIMEOUT
): Promise<LocationFix> => {
  let failure: LocationFixError;
  try {
    // One deadline covers the permission check and the fix; either can stall.
    const location = await withDeadline(readPosition, timeoutMs, TIMED_OUT);
    return { location, source: FIX_SOURCE.FRESH };
  } catch (error) {
    // The deadline's own rejection is the only error that is not a LocationFixError.
    failure =
      error instanceof LocationFixError
        ? error
        : new LocationFixError(LOCATION_FAILURE.TIMEOUT, { cause: error });
  }

  if (mayFallBack(failure.kind)) {
    const lastKnown = await readLastKnown();
    if (lastKnown) {
      log.i("Position", `fresh fix failed (${failure.kind}); using the cached fix`);
      return { location: lastKnown, source: FIX_SOURCE.LAST_KNOWN };
    }
  }
  if (failure.kind !== LOCATION_FAILURE.DENIED) {
    // The cause carries the native message and the HMS diagnostics.
    const cause = failure.cause instanceof Error ? failure.cause : failure;
    log.e("Position", `location request failed (${failure.kind})`, cause);
  }
  throw failure;
};

/** The device position alone, for a caller that does not record its source. */
export const getLocationWithTimeout = async (
  timeoutMs: number = LOCATION_REQUEST_TIMEOUT
): Promise<LocationObject> => (await readLocation(timeoutMs)).location;

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
