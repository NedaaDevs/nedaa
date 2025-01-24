import { LocationObjectCoords, LocationGeocodedAddress } from "expo-location";

// Enum
import { LocalPermissionStatus } from "@/enums/location";

export type LocationPermissionsState = {
  status: LocalPermissionStatus;
  canRequestAgain: boolean;
};

export type LocationDetails = {
  coords: LocationObjectCoords | null;
  address: LocationGeocodedAddress | null;
  error: string | null;
  isLoading: boolean;
};

export type LocationStore = {
  permissions: LocationPermissionsState;
  locationDetails: LocationDetails;
  checkPermissions: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
  getCurrentLocation: () => Promise<void>;
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
  error: null,
  isLoading: false,
};
