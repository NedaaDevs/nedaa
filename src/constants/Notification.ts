import type { NotificationWithTiming } from "@/types/notification";

export const NOTIFICATION_TYPE = {
  PRAYER: "prayer",
  IQAMA: "iqama",
  PRE_ATHAN: "preAthan",
  ATHKAR: "athkar",
  QADA: "qada",
  OTHER_TIMING: "otherTiming",
  QURAN_REMINDER: "quranReminder",
} as const;

/** The types a single prayer can override; qada has defaults only. */
export const PRAYER_NOTIFICATION_TYPES = [
  NOTIFICATION_TYPE.PRAYER,
  NOTIFICATION_TYPE.IQAMA,
  NOTIFICATION_TYPE.PRE_ATHAN,
] as const;

/** The fields of a notification config, checked against the config type. */
export const NOTIFICATION_FIELD = {
  ENABLED: "enabled",
  SOUND: "sound",
  VIBRATION: "vibration",
  TIMING: "timing",
} as const satisfies Record<string, keyof NotificationWithTiming>;

/** Minutes from the Athan: after it for Iqama, before it for pre-Athan. */
export const NOTIFICATION_TIMING_CHOICES = [5, 10, 15, 20, 30] as const;
