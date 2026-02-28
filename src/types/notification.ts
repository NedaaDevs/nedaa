// Constants
import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { IqamaSoundKey, PrayerSoundKey, PreAthanSoundKey, QadaSoundKey } from "@/constants/sounds";

// Enums
import { LocalPermissionStatus } from "@/enums/notifications";

// Types
import type { NotificationSoundKey } from "@/types/sound";
import type { AthkarType } from "@/types/athkar";

export type PrayerNotificationConfig = NotificationConfig & {
  sound: PrayerSoundKey;
};

export type IqamaNotificationConfig = NotificationWithTiming & {
  sound: IqamaSoundKey;
};

export type PreAthanNotificationConfig = NotificationWithTiming & {
  sound: PreAthanSoundKey;
};

export type QadaNotificationConfig = {
  enabled: boolean;
  sound: QadaSoundKey | "default";
  vibration: boolean;
};

export type NotificationPermissionsState = {
  status: LocalPermissionStatus;
  canRequestAgain: boolean;
};

export type AthkarNotificationSettings = {
  type: Exclude<AthkarType, "all">;
  enabled: boolean;
  hour: number;
  minute: number;
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
  migrationVersion: number;
  morningNotification: AthkarNotificationSettings;
  eveningNotification: AthkarNotificationSettings;
  fullAthanPlayback: boolean;
};

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

export type PrayerNotificationType = Exclude<NotificationType, "athkar" | "qada">;

export type NotificationAction = {
  openNotificationSettings: () => Promise<void>;
  updateAllNotificationToggle: (enabled: boolean) => Promise<void>;
  updateFullAthanPlayback: (enabled: boolean) => Promise<void>;
  updateQuickSetup: (sound: PrayerSoundKey, vibration: boolean) => Promise<void>;
  updateDefault: <T extends Exclude<NotificationType, "athkar">>(
    type: T,
    field: keyof ConfigForType<T>,
    value: ConfigForType<T>[keyof ConfigForType<T>]
  ) => Promise<void>;
  updateOverride: <T extends PrayerNotificationType>(
    prayerId: string,
    type: T,
    config: Partial<ConfigForType<T>>
  ) => Promise<void>;
  resetOverride: (prayerId: string, type: PrayerNotificationType) => Promise<void>;
  resetAllOverrides: () => Promise<void>;
  getEffectiveConfigForPrayer: <T extends PrayerNotificationType>(
    prayerId: string,
    type: T
  ) => ConfigForType<T>;
  scheduleAllNotifications: () => Promise<void>;
  rescheduleIfNeeded: (force: boolean) => Promise<void>;
  updateAthkarNotificationSetting: (option: AthkarNotificationSettings) => Promise<void>;
  updateSettings: (newSettings: NotificationSettings) => Promise<void>;
  getUsedCustomSounds: () => Set<string>;
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
  qada: QadaNotificationConfig;
};

export type NotificationOverride = {
  [T in NotificationType]?: Partial<ConfigForType<T>>;
};

export type NotificationSettings = {
  enabled: boolean; // All notifications toggle
  defaults: NotificationDefaults;
  overrides: Record<string, NotificationOverride>; // keyed by prayer ID
};

export function getEffectiveConfig<T extends Exclude<NotificationType, "athkar">>(
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
      : T extends "qada"
        ? QadaNotificationConfig
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
      : T extends typeof NOTIFICATION_TYPE.QADA
        ? QadaNotificationConfig
        : never;
