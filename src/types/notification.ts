import type { OtherTimingId } from "@/constants/Prayer";
// Constants
import type { NOTIFICATION_TYPE, PRAYER_NOTIFICATION_TYPES } from "@/constants/Notification";
import { IqamaSoundKey, PrayerSoundKey, PreAthanSoundKey, QadaSoundKey } from "@/constants/sounds";

// Enums
import { LocalPermissionStatus, type SchedulingSkipReasonValue } from "@/enums/notifications";

// Types
import type { NotificationSoundKey } from "@/types/sound";
import type { CustomSoundKey } from "@/types/customSound";
import type { AthkarType } from "@/types/athkar";

export type PrayerNotificationConfig = NotificationConfig & {
  sound: PrayerSoundKey | CustomSoundKey;
};

export type IqamaNotificationConfig = NotificationWithTiming & {
  sound: IqamaSoundKey | CustomSoundKey;
};

export type PreAthanNotificationConfig = NotificationWithTiming & {
  sound: PreAthanSoundKey | CustomSoundKey;
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

// `skipReason` marks an expected no-op (nothing to schedule); `error` marks a
// genuine failure. Callers log the two at different levels.
export type SchedulingResult = {
  success: boolean;
  scheduledCount: number;
  failedCount?: number;
  error?: Error;
  skipReason?: SchedulingSkipReasonValue;
  // ISO time of the latest scheduled item — the end of the notification horizon.
  lastScheduledAt?: string;
};

export type AthkarNotificationSettings = {
  type: Exclude<AthkarType, "all">;
  enabled: boolean;
  hour: number;
  minute: number;
};

export type { OtherTimingId };

export type OtherTimingNotifications = Record<OtherTimingId, boolean>;

export type DuhaTimePreference = {
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
  // Open batches. Writes hold their reschedule while this is above zero.
  batchDepth: number;
  // A reschedule the app owes but has not run. Survives a crash so the next launch pays it.
  pendingReschedule: boolean;
  settings: NotificationSettings;
  lastScheduledDate: string | null;
  migrationVersion: number;
  morningNotification: AthkarNotificationSettings;
  eveningNotification: AthkarNotificationSettings;
  fullAthanPlayback: boolean;
  athanAudioStream: "media" | "ringer";
  fullIqamaPlayback: boolean;
  iqamaAudioStream: "media" | "ringer";
  otherTimingNotifications: OtherTimingNotifications;
  duhaTime: DuhaTimePreference;
};

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

/** The types whose config the store holds. */
export type ConfiguredNotificationType = keyof NotificationDefaults;

export type PrayerNotificationType = (typeof PRAYER_NOTIFICATION_TYPES)[number];

export type NotificationAction = {
  openNotificationSettings: () => Promise<void>;
  updateAllNotificationToggle: (enabled: boolean) => Promise<void>;
  updateFullAthanPlayback: (enabled: boolean) => Promise<void>;
  updateAthanAudioStream: (stream: "media" | "ringer") => Promise<void>;
  updateFullIqamaPlayback: (enabled: boolean) => Promise<void>;
  updateIqamaAudioStream: (stream: "media" | "ringer") => Promise<void>;
  updateQuickSetup: (sound: PrayerNotificationConfig["sound"], vibration: boolean) => Promise<void>;
  updateDefault: <T extends ConfiguredNotificationType>(
    type: T,
    field: keyof ConfigForType<T>,
    value: ConfigForType<T>[keyof ConfigForType<T>]
  ) => Promise<void>;
  // Sets one field and keeps the rest; a value equal to the default drops the field.
  updateOverride: <T extends PrayerNotificationType, K extends keyof ConfigForType<T>>(
    prayerId: string,
    type: T,
    field: K,
    value: ConfigForType<T>[K]
  ) => Promise<void>;
  // Replaces the stored config for the type; a field it omits falls back to the default.
  replaceOverride: <T extends PrayerNotificationType>(
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
  // Runs `run` as one batch, so a run of related writes costs one reschedule rather
  // than one each. The batch closes even if `run` throws, and the throw propagates.
  withBatch: <T>(run: () => Promise<T>) => Promise<T>;
  // Reschedules now, or records that one is owed when a batch is open.
  requestReschedule: () => Promise<void>;
  scheduleAllNotifications: () => Promise<SchedulingResult>;
  rescheduleIfNeeded: (force: boolean) => Promise<void>;
  updateAthkarNotificationSetting: (option: AthkarNotificationSettings) => Promise<void>;
  updateOtherTimingNotification: (id: OtherTimingId, enabled: boolean) => Promise<void>;
  updateDuhaTime: (hour: number, minute: number) => Promise<void>;
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
  [T in PrayerNotificationType]?: Partial<ConfigForType<T>>;
};

export type NotificationSettings = {
  enabled: boolean; // All notifications toggle
  defaults: NotificationDefaults;
  overrides: Record<string, NotificationOverride>; // keyed by prayer ID
};

/** The defaults for a type with this prayer's override on top. */
export const getEffectiveConfig = <T extends PrayerNotificationType>(
  prayerId: string,
  type: T,
  defaults: NotificationDefaults,
  overrides: Record<string, NotificationOverride>
): ConfigForType<T> => ({
  ...defaults[type],
  ...overrides[prayerId]?.[type],
});

export type ConfigForType<T extends ConfiguredNotificationType> = NotificationDefaults[T];
