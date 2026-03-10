import { LocationObjectCoords } from "expo-location";

// Enum
import { LocalPermissionStatus } from "@/enums/location";
import { KAABA_COORDINATES } from "@/utils/compass";

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
