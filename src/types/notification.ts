import { LocalPermissionStatus } from "@/enums/notifications";

import type { NotificationRequest } from "expo-notifications";

export type NotificationPermissionsState = {
  status: LocalPermissionStatus;
  canRequestAgain: boolean;
};

export type NotificationOptions = {
  sound?: string;
  vibrate?: boolean;
  categoryId?: string;
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

export type NotificationConfig = {
  enabled: boolean;
  sound: string;
  vibration: boolean;
};

export type NotificationWithTiming = NotificationConfig & {
  timing: number; // minutes before/after
};

export type NotificationDefaults = {
  prayer: NotificationConfig;
  iqama: NotificationWithTiming;
  preAthan: NotificationWithTiming;
};

export type NotificationOverride = {
  prayer?: Partial<NotificationConfig>;
  iqama?: Partial<NotificationWithTiming>;
  preAthan?: Partial<NotificationWithTiming>;
};

export type NotificationSettings = {
  enabled: boolean; // All notifications toggle
  defaults: NotificationDefaults;
  overrides: Record<string, NotificationOverride>; // keyed by prayer ID
};

export const getEffectiveConfig = <T extends NotificationConfig>(
  prayerId: string,
  type: NotificationType,
  defaults: NotificationDefaults,
  overrides: Record<string, NotificationOverride>
): T => {
  const defaultConfig = defaults[type];
  const override = overrides[prayerId]?.[type];

  return {
    ...defaultConfig,
    ...override,
  } as T;
};
