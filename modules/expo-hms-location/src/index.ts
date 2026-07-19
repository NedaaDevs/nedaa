import {
  EventEmitter,
  requireOptionalNativeModule,
  type EventEmitter as EventEmitterType,
} from "expo-modules-core";

import type {
  ExpoHmsLocationNativeModule,
  HmsGeocodedAddress,
  HmsLocationCallback,
  HmsLocationErrorCallback,
  HmsLocationErrorEvent,
  HmsLocationObject,
  HmsLocationOptions,
  HmsLocationPermissionResponse,
  HmsLocationSubscription,
  HmsLocationUpdateEvent,
  HmsReverseGeocodeInput,
} from "./ExpoHmsLocation.types";

type HmsLocationEvents = {
  onLocationUpdate: (event: HmsLocationUpdateEvent) => void;
  onLocationError: (event: HmsLocationErrorEvent) => void;
};

type UntypedEventEmitter = InstanceType<EventEmitterType>;
type HmsLocationEventEmitter = InstanceType<EventEmitterType<HmsLocationEvents>>;
type HmsLocationNativeModule = ExpoHmsLocationNativeModule & HmsLocationEventEmitter;

export type {
  HmsGeocodedAddress,
  HmsLocationCoordinates,
  HmsLocationObject,
  HmsLocationOptions,
  HmsLocationPermissionResponse,
  HmsLocationSubscription,
  HmsReverseGeocodeInput,
} from "./ExpoHmsLocation.types";

const NativeModule = requireOptionalNativeModule<HmsLocationNativeModule>("ExpoHmsLocation");
const emitter = NativeModule
  ? (new EventEmitter(
      NativeModule as unknown as UntypedEventEmitter
    ) as unknown as HmsLocationEventEmitter)
  : null;

let nextWatchId = 0;

const requireHmsLocation = (): ExpoHmsLocationNativeModule => {
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
    if (!emitter) {
      throw new Error("Huawei Location Kit event emitter is unavailable");
    }

    const watchId = ++nextWatchId;
    const locationSubscription = emitter.addListener(
      "onLocationUpdate",
      (event: HmsLocationUpdateEvent) => {
        if (event.watchId === watchId) callback(event.location);
      }
    );
    const errorSubscription = emitter.addListener(
      "onLocationError",
      (event: HmsLocationErrorEvent) => {
        if (event.watchId === watchId) errorCallback?.(event.reason);
      }
    );

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
