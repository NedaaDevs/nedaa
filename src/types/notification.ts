import { LocalPermissionStatus } from "@/enums/notifications";

import type { NotificationRequest } from "expo-notifications";

export type NotificationPermissionsState = {
  status: LocalPermissionStatus;
  canRequestAgain: boolean;
};

export type NotificationState = {
  isScheduling: boolean;
};

export type NotificationType = "prayer" | "iqama" | "preAthan";

export type NotificationAction = {
  scheduleTestNotification: () => Promise<void>;
  getScheduledNotifications: () => Promise<NotificationRequest[]>;
  clearNotifications: () => Promise<void>;
  openNotificationSettings: () => Promise<void>;
};
