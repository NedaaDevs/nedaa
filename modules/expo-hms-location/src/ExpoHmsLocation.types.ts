export type HmsLocationOptions = {
  accuracy?: number;
  distanceInterval?: number;
  mayShowUserSettingsDialog?: boolean;
  timeInterval?: number;
};

export type HmsLocationCoordinates = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
};

export type HmsLocationObject = {
  coords: HmsLocationCoordinates;
  timestamp: number;
  mocked?: boolean;
};

export type HmsLocationPermissionResponse = {
  status: "granted" | "denied" | "undetermined";
  granted: boolean;
  canAskAgain: boolean;
  expires: "never";
  android: {
    accuracy: "fine" | "coarse" | "none";
  };
};

export type HmsReverseGeocodeInput = {
  latitude: number;
  longitude: number;
};

export type HmsGeocodedAddress = {
  city: string | null;
  district: string | null;
  streetNumber: string | null;
  street: string | null;
  region: string | null;
  subregion: string | null;
  country: string | null;
  postalCode: string | null;
  name: string | null;
  isoCountryCode: string | null;
  timezone: string | null;
  formattedAddress: string | null;
};

export type HmsLocationSubscription = {
  remove: () => void;
};

export type HmsLocationCallback = (location: HmsLocationObject) => void;
export type HmsLocationErrorCallback = (reason: string) => void;

export type HmsLocationUpdateEvent = {
  watchId: number;
  location: HmsLocationObject;
};

export type HmsLocationErrorEvent = {
  watchId: number;
  reason: string;
};

export type ExpoHmsLocationNativeModule = {
  getForegroundPermissionsAsync(): Promise<HmsLocationPermissionResponse>;
  requestForegroundPermissionsAsync(): Promise<HmsLocationPermissionResponse>;
  hasServicesEnabledAsync(): Promise<boolean>;
  getCurrentPositionAsync(options: HmsLocationOptions): Promise<HmsLocationObject>;
  reverseGeocodeAsync(location: HmsReverseGeocodeInput): Promise<HmsGeocodedAddress[]>;
  startWatchingAsync(watchId: number, options: HmsLocationOptions): Promise<void>;
  stopWatchingAsync(watchId: number): Promise<void>;
};
