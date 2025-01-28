import { LocalPermissionStatus } from "@/enums/notifications";

import { NotificationRequest } from "expo-notifications";

export type NotificationState = {
  permissions: NotificationPermissionsState;
  refreshPermissions: () => Promise<void>;
  requestNotificationPermission: () => Promise<boolean>;
  scheduleTestNotification: () => Promise<void>;
  getScheduledNotifications: () => Promise<NotificationRequest[]>;
  clearNotifications: () => Promise<void>;
  openNotificationSettings: () => Promise<void>;
};

export type NotificationPermissionsState = {
  status: LocalPermissionStatus;
  canRequestAgain: boolean;
};
