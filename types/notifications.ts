import { LocalPermissionStatus } from "@/enums/notifications";

export type NotificationPermissionsState = {
  status: LocalPermissionStatus;
  canRequestAgain: boolean;
};
