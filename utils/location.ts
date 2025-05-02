import {
  PermissionStatus,
  getForegroundPermissionsAsync,
  requestForegroundPermissionsAsync,
} from "expo-location";

// Enums
import { LocalPermissionStatus } from "@/enums/location";

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
