// Constants
import { NOTIFICATION_TYPE } from "@/constants/Notification";

// Enums
import { LocalPermissionStatus } from "@/enums/notifications";

// Types
import type { NotificationSoundKey } from "@/types/sound";

import type { NotificationRequest } from "expo-notifications";

export type PrayerNotificationConfig = NotificationConfig & {
  sound: NotificationSoundKey<typeof NOTIFICATION_TYPE.PRAYER>;
};

export type IqamaNotificationConfig = NotificationWithTiming & {
  sound: NotificationSoundKey<typeof NOTIFICATION_TYPE.IQAMA>;
};

export type PreAthanNotificationConfig = NotificationWithTiming & {
  sound: NotificationSoundKey<typeof NOTIFICATION_TYPE.PRE_ATHAN>;
};

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
  settings: NotificationSettings;
  lastScheduledDate: string | null;
};

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

export type NotificationAction = {
  scheduleTestNotification: () => Promise<void>;
  getScheduledNotifications: () => Promise<NotificationRequest[]>;
  clearNotifications: () => Promise<void>;
  openNotificationSettings: () => Promise<void>;
  updateAllNotificationToggle: (enabled: boolean) => void;
  updateQuickSetup: (
    sound: NotificationSoundKey<typeof NOTIFICATION_TYPE.PRAYER>,
    vibration: boolean
  ) => void;
  updateDefault: <T extends Partial<NotificationType>>(
    type: T,
    field: keyof ConfigForType<T>,
    value: ConfigForType<T>[keyof ConfigForType<T>]
  ) => void;
  updateOverride: <T extends NotificationType>(
    prayerId: string,
    type: T,
    config: Partial<ConfigForType<T>>
  ) => void;
  resetOverride: (prayerId: string, type: NotificationType) => void;
  resetAllOverrides: () => void;
  getEffectiveConfigForPrayer: <T extends NotificationType>(
    prayerId: string,
    type: T
  ) => ConfigForType<T>;
  clearAllNotifications: () => Promise<void>;
  scheduleAllNotifications: () => Promise<void>;
  schedulePrayerNotifications: (prayerId: string, prayerTime: Date) => Promise<void>;
  cancelPrayerNotifications: (prayerId: string) => Promise<void>;
};

export type NotificationConfig = {
  enabled: boolean;
  sound: NotificationSoundKey<NotificationType>;
  vibration: boolean;
};

export type NotificationWithTiming = NotificationConfig & {
  timing: number; // minutes before/after
};

export type NotificationDefaults = {
  prayer: PrayerNotificationConfig;
  iqama: IqamaNotificationConfig;
  preAthan: PreAthanNotificationConfig;
};

export type NotificationOverride = {
  [T in NotificationType]?: Partial<ConfigForType<T>>;
};

export type NotificationSettings = {
  enabled: boolean; // All notifications toggle
  defaults: NotificationDefaults;
  overrides: Record<string, NotificationOverride>; // keyed by prayer ID
};

export function getEffectiveConfig<T extends NotificationType>(
  prayerId: string,
  type: T,
  defaults: NotificationDefaults,
  overrides: Record<string, NotificationOverride>
): T extends "prayer"
  ? PrayerNotificationConfig
  : T extends "iqama"
    ? IqamaNotificationConfig
    : T extends "preAthan"
      ? PreAthanNotificationConfig
      : never {
  const defaultConfig = defaults[type];
  const override = overrides[prayerId]?.[type];

  return {
    ...defaultConfig,
    ...override,
  } as any;
}

// Helper type to extract config type from notification type
export type ConfigForType<T extends NotificationType> = T extends typeof NOTIFICATION_TYPE.PRAYER
  ? PrayerNotificationConfig
  : T extends typeof NOTIFICATION_TYPE.IQAMA
    ? IqamaNotificationConfig
    : T extends typeof NOTIFICATION_TYPE.PRE_ATHAN
      ? PreAthanNotificationConfig
      : never;
