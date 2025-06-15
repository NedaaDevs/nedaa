// Constants
import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { IqamaSoundKey, PrayerSoundKey, PreAthanSoundKey } from "@/constants/sounds";

// Enums
import { LocalPermissionStatus } from "@/enums/notifications";

// Types
import type { NotificationSoundKey } from "@/types/sound";

export type PrayerNotificationConfig = NotificationConfig & {
  sound: PrayerSoundKey;
};

export type IqamaNotificationConfig = NotificationWithTiming & {
  sound: IqamaSoundKey;
};

export type PreAthanNotificationConfig = NotificationWithTiming & {
  sound: PreAthanSoundKey;
};

export type NotificationPermissionsState = {
  status: LocalPermissionStatus;
  canRequestAgain: boolean;
};

export type NotificationOptions = {
  vibrate?: boolean;
  categoryId?: string;
  channelId?: string;
};

export type NotificationState = {
  isScheduling: boolean;
  settings: NotificationSettings;
  lastScheduledDate: string | null;
};

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

export type NotificationAction = {
  openNotificationSettings: () => Promise<void>;
  updateAllNotificationToggle: (enabled: boolean) => void;
  updateQuickSetup: (sound: PrayerSoundKey, vibration: boolean) => void;
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
  scheduleAllNotifications: () => Promise<void>;
  rescheduleIfNeeded: (force: boolean) => Promise<void>;
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
