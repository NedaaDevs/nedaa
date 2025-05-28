import {
  PermissionStatus,
  getCurrentPositionAsync,
  getForegroundPermissionsAsync,
  requestForegroundPermissionsAsync,
  LocationObject,
  Accuracy,
} from "expo-location";

// Enums
import { LocalPermissionStatus } from "@/enums/location";

// Constants
export const CITY_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
export const CITY_CHANGE_THRESHOLD = 10; // km - minimum distance to consider city change
export const LOCATION_REQUEST_TIMEOUT = 10000; // 10 seconds

export const mapToLocalStatus = (status: PermissionStatus): LocalPermissionStatus => {
  switch (status) {
    case PermissionStatus.GRANTED:
      return LocalPermissionStatus.GRANTED;
    case PermissionStatus.DENIED:
      return LocalPermissionStatus.DENIED;
    default:
      return LocalPermissionStatus.UNDETERMINED;
  }
};

export const checkLocationPermission = async () => {
  try {
    const { status, canAskAgain } = await getForegroundPermissionsAsync();

    return {
      granted: status === PermissionStatus.GRANTED,
      canRequestAgain: canAskAgain,
    };
  } catch (error) {
    console.error("Location Permission check failed: ", error);
    return {
      granted: false,
      canRequestAgain: true,
    };
  }
};

export const requestLocationPermission = async () => {
  try {
    const { status } = await requestForegroundPermissionsAsync();
    return { granted: status === PermissionStatus.GRANTED };
  } catch (error) {
    console.error("Location permission request failed:", error);
    return { granted: false, error };
  }
};

// Get location with timeout protection(sometimes getting location get stuck)
export const getLocationWithTimeout = async (): Promise<LocationObject> => {
  try {
    const locationPromise = getCurrentPositionAsync({
      accuracy: Accuracy.Low,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Location request timed out")), LOCATION_REQUEST_TIMEOUT);
    });

    return await Promise.race([locationPromise, timeoutPromise]);
  } catch (error) {
    console.error("Location request failed:", error);
    throw error;
  }
};

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

export const getCurrentLocation = async () => {
  // First check permission
  const { granted, canRequestAgain } = await checkLocationPermission();

  if (!granted && canRequestAgain) {
    // Try to request permission
    const { granted: newPermission } = await requestLocationPermission();
    if (!newPermission) {
      return { error: "Location permission denied" };
    }
  }

  // Now get location with timeout protection
  try {
    const location = await getLocationWithTimeout();
    return { location };
  } catch (error: any) {
    return { error: error.message };
  }
};
