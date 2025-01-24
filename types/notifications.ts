import { LocalPermissionStatus } from "@/enums/notifications";

export type NotificationState = {
  permissions: NotificationPermissionsState;
  checkPermissions: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
  openSystemSettings: () => Promise<void>;
};

export type NotificationPermissionsState = {
  status: LocalPermissionStatus;
  canRequestAgain: boolean;
};
