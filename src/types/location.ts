// Enum
import type { LocalPermissionStatus } from "@/enums/location";
import { KAABA_COORDINATES } from "@/utils/compass";
import type { CityCountry, CityRegion, LocalizedNames } from "@/types/cities";

export type LocationObjectCoords = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
};

export type LocationObject = {
  coords: LocationObjectCoords;
  timestamp: number;
  mocked?: boolean;
};

export type LocationOptions = {
  accuracy?: number;
  distanceInterval?: number;
  mayShowUserSettingsDialog?: boolean;
  timeInterval?: number;
};

export type LocationSubscription = {
  remove: () => void;
};

export type LocationPermissionResponse = {
  status: LocalPermissionStatus;
  granted: boolean;
  canAskAgain: boolean;
  expires: "never" | number;
  android?: {
    accuracy: "fine" | "coarse" | "none";
  };
  ios?: {
    accuracy: "full" | "reduced";
  };
};

export type LocationGeocodedAddress = {
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

export type LocationPermissionsState = {
  status: LocalPermissionStatus;
  canRequestAgain: boolean;
};

export type Address = {
  country: string;
  city: string;
};

export type LocationDetails = {
  coords: LocationObjectCoords;
  address: Address | null;
  timezone: string;
  error: string | null;
  isLoading: boolean;
};

const MECCA_COORDS = {
  latitude: KAABA_COORDINATES.latitude,
  longitude: KAABA_COORDINATES.longitude,
  altitude: null,
  accuracy: null,
  altitudeAccuracy: null,
  heading: null,
  speed: null,
};

export const initialLocationDetails: LocationDetails = {
  coords: MECCA_COORDS,
  address: null,
  timezone: "Asia/Riyadh",
  error: null,
  isLoading: false,
};

/**
 * A location the user chose rather than one read from the device. Carries its own
 * timezone because prayer times are computed against it, and every name part keeps
 * its localized variants so the label can be rendered in any app locale.
 */
export type ManualLocation = {
  /** GeoNames id, or null when the coordinates were typed or pinned directly. */
  cityId: number | null;
  name: string;
  names: LocalizedNames;
  region: CityRegion | null;
  countryCode: string;
  country: CityCountry;
  latitude: number;
  longitude: number;
  timezone: string;
};
