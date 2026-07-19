import { ExpoHmsLocationModule } from "expo-hms-location";

import type {
  LocationGeocodedAddress,
  LocationObject,
  LocationOptions,
  LocationPermissionResponse,
  LocationSubscription,
} from "@/types/location";

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

type LocationProvider = {
  getForegroundPermissionsAsync(): Promise<LocationPermissionResponse>;
  requestForegroundPermissionsAsync(): Promise<LocationPermissionResponse>;
  hasServicesEnabledAsync(): Promise<boolean>;
  getCurrentPositionAsync(options?: LocationOptions): Promise<LocationObject>;
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

export const getForegroundPermissionsAsync = (): Promise<LocationPermissionResponse> =>
  getLocationProvider().getForegroundPermissionsAsync();

export const requestForegroundPermissionsAsync = (): Promise<LocationPermissionResponse> =>
  getLocationProvider().requestForegroundPermissionsAsync();

export const hasServicesEnabledAsync = (): Promise<boolean> =>
  getLocationProvider().hasServicesEnabledAsync();

export const getCurrentPositionAsync = (options: LocationOptions = {}): Promise<LocationObject> =>
  getLocationProvider().getCurrentPositionAsync(options);

export const watchPositionAsync = (
  options: LocationOptions,
  callback: LocationCallback,
  errorCallback?: LocationErrorCallback
): Promise<LocationSubscription> =>
  getLocationProvider().watchPositionAsync(options, callback, errorCallback);

export const reverseGeocodeAsync = (
  location: ReverseGeocodeInput
): Promise<LocationGeocodedAddress[]> => getLocationProvider().reverseGeocodeAsync(location);
