import {
  requireOptionalNativeModule,
  type NativeModule as ExpoNativeModule,
} from "expo-modules-core";

import {
  HMS_LOCATION_EVENT,
  type ExpoHmsLocationNativeModule,
  type HmsGeocodedAddress,
  type HmsLocationCallback,
  type HmsLocationErrorCallback,
  type HmsLocationEvents,
  type HmsLocationObject,
  type HmsLocationOptions,
  type HmsLocationPermissionResponse,
  type HmsLocationSubscription,
  type HmsReverseGeocodeInput,
} from "./ExpoHmsLocation.types";

// The exported NativeModule type is the constructor and drops the events map.
type HmsLocationNativeModule = ExpoHmsLocationNativeModule &
  InstanceType<typeof ExpoNativeModule<HmsLocationEvents>>;

export type {
  HmsGeocodedAddress,
  HmsLocationCoordinates,
  HmsLocationEvents,
  HmsLocationObject,
  HmsLocationOptions,
  HmsLocationPermissionResponse,
  HmsLocationSubscription,
  HmsReverseGeocodeInput,
} from "./ExpoHmsLocation.types";
export { HMS_LOCATION_EVENT } from "./ExpoHmsLocation.types";

const NativeModule = requireOptionalNativeModule<HmsLocationNativeModule>("ExpoHmsLocation");

let nextWatchId = 0;

const requireHmsLocation = (): HmsLocationNativeModule => {
  if (!NativeModule) {
    throw new Error("Huawei Location Kit is unavailable in this build");
  }
  return NativeModule;
};

export const ExpoHmsLocationModule = {
  isAvailable: NativeModule !== null,

  getForegroundPermissionsAsync(): Promise<HmsLocationPermissionResponse> {
    return requireHmsLocation().getForegroundPermissionsAsync();
  },

  requestForegroundPermissionsAsync(): Promise<HmsLocationPermissionResponse> {
    return requireHmsLocation().requestForegroundPermissionsAsync();
  },

  hasServicesEnabledAsync(): Promise<boolean> {
    return requireHmsLocation().hasServicesEnabledAsync();
  },

  getCurrentPositionAsync(options: HmsLocationOptions = {}): Promise<HmsLocationObject> {
    return requireHmsLocation().getCurrentPositionAsync(options);
  },

  reverseGeocodeAsync(location: HmsReverseGeocodeInput): Promise<HmsGeocodedAddress[]> {
    return requireHmsLocation().reverseGeocodeAsync(location);
  },

  async watchPositionAsync(
    options: HmsLocationOptions,
    callback: HmsLocationCallback,
    errorCallback?: HmsLocationErrorCallback
  ): Promise<HmsLocationSubscription> {
    const nativeModule = requireHmsLocation();
    const watchId = ++nextWatchId;
    const locationSubscription = nativeModule.addListener(HMS_LOCATION_EVENT.UPDATE, (event) => {
      if (event.watchId === watchId) callback(event.location);
    });
    const errorSubscription = nativeModule.addListener(HMS_LOCATION_EVENT.ERROR, (event) => {
      if (event.watchId === watchId) errorCallback?.(event.reason);
    });

    try {
      await nativeModule.startWatchingAsync(watchId, options);
    } catch (error) {
      locationSubscription.remove();
      errorSubscription.remove();
      throw error;
    }

    let removed = false;
    return {
      remove: () => {
        if (removed) return;
        removed = true;
        locationSubscription.remove();
        errorSubscription.remove();
        void nativeModule.stopWatchingAsync(watchId).catch((error) => {
          console.warn("[ExpoHmsLocation] Failed to stop location watch", error);
        });
      },
    };
  },
};
