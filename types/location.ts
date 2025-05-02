import { LocationObjectCoords, LocationGeocodedAddress } from "expo-location";

// Enum
import { LocalPermissionStatus } from "@/enums/location";

export type LocationPermissionsState = {
  status: LocalPermissionStatus;
  canRequestAgain: boolean;
};

export type LocationDetails = {
  coords: LocationObjectCoords;
  address: LocationGeocodedAddress | null;
  timezone: string;
  error: string | null;
  isLoading: boolean;
};

const MECCA_COORDS = {
  latitude: 21.422487,
  longitude: 39.826206,
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
