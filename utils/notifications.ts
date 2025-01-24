import { PermissionStatus } from "expo-notifications";

import { LocalPermissionStatus } from "@/enums/notifications";

export const mapToLocalStatus = (
  expoStatus: PermissionStatus,
): LocalPermissionStatus => {
  switch (expoStatus) {
    case PermissionStatus.GRANTED:
      return LocalPermissionStatus.GRANTED;
    case PermissionStatus.DENIED:
      return LocalPermissionStatus.DENIED;
    default:
      return LocalPermissionStatus.UNDETERMINED;
  }
};
