import { PermissionStatus } from "expo-location";
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
