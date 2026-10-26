import { ExpoHmsLocationModule } from "expo-hms-location";

import type {
  LocationGeocodedAddress,
  LocationObject,
  LocationOptions,
  LocationPermissionResponse,
  LocationSubscription,
} from "@/types/location";
import { withDeadline } from "@/utils/withTimeout";

export { LocationAccuracy } from "@/enums/location";
export type {
  LocationGeocodedAddress,
  LocationObject,
  LocationObjectCoords,
  LocationOptions,
  LocationPermissionResponse,
  LocationSubscription,
} from "@/types/location";

type LocationCallback = (location: LocationObject) => void;
type LocationErrorCallback = (reason: string) => void;
type ReverseGeocodeInput = Pick<LocationObject["coords"], "latitude" | "longitude">;
type LastKnownOptions = { maxAge?: number };

type LocationProvider = {
  getForegroundPermissionsAsync(): Promise<LocationPermissionResponse>;
  requestForegroundPermissionsAsync(): Promise<LocationPermissionResponse>;
  hasServicesEnabledAsync(): Promise<boolean>;
  getCurrentPositionAsync(options?: LocationOptions): Promise<LocationObject>;
  getLastKnownPositionAsync(options?: LastKnownOptions): Promise<LocationObject | null>;
  watchPositionAsync(
    options: LocationOptions,
    callback: LocationCallback,
    errorCallback?: LocationErrorCallback
  ): Promise<LocationSubscription>;
  reverseGeocodeAsync(location: ReverseGeocodeInput): Promise<LocationGeocodedAddress[]>;
};

const getExpoLocation = (): LocationProvider => {
  // Expo Location's JS entry requires its native module immediately. Keep this lazy so an HMS
  // build, where that native module is deliberately excluded, never evaluates the package.
  // The module loader already caches this require; local mutable caching would make test/build
  // provider selection unnecessarily stateful.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-location") as LocationProvider;
};

const getLocationProvider = (): LocationProvider =>
  ExpoHmsLocationModule.isAvailable
    ? (ExpoHmsLocationModule as unknown as LocationProvider)
    : getExpoLocation();

/** Whether Huawei Location Kit reads the position. */
export const usesHmsLocation = (): boolean => ExpoHmsLocationModule.isAvailable;

export const getForegroundPermissionsAsync = (): Promise<LocationPermissionResponse> =>
  getLocationProvider().getForegroundPermissionsAsync();

export const requestForegroundPermissionsAsync = (): Promise<LocationPermissionResponse> =>
  getLocationProvider().requestForegroundPermissionsAsync();

export const hasServicesEnabledAsync = (): Promise<boolean> =>
  getLocationProvider().hasServicesEnabledAsync();

export const getCurrentPositionAsync = (options: LocationOptions = {}): Promise<LocationObject> =>
  getLocationProvider().getCurrentPositionAsync(options);

/** The cached fix no older than `maxAgeMs`, or null. */
export const getLastKnownPositionAsync = async (
  maxAgeMs: number
): Promise<LocationObject | null> => {
  if (!ExpoHmsLocationModule.isAvailable) {
    return getExpoLocation().getLastKnownPositionAsync({ maxAge: maxAgeMs });
  }
  // Location Kit takes no age limit, so the age is checked here.
  const fix = await getLocationProvider().getLastKnownPositionAsync();
  return fix && Date.now() - fix.timestamp <= maxAgeMs ? fix : null;
};

export const watchPositionAsync = (
  options: LocationOptions,
  callback: LocationCallback,
  errorCallback?: LocationErrorCallback
): Promise<LocationSubscription> =>
  getLocationProvider().watchPositionAsync(options, callback, errorCallback);

/** The same limit as Location Kit's own geocoder. */
export const REVERSE_GEOCODE_TIMEOUT_MS = 10_000;

// Android 13+ can drop a geocoder error, so an unanswered call times out.
export const reverseGeocodeAsync = (
  location: ReverseGeocodeInput
): Promise<LocationGeocodedAddress[]> =>
  withDeadline(
    () => getLocationProvider().reverseGeocodeAsync(location),
    REVERSE_GEOCODE_TIMEOUT_MS,
    "reverse geocode timed out"
  );
