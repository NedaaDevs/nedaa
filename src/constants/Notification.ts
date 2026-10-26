import type { NotificationWithTiming } from "@/types/notification";
import { ATHKAR_TYPE } from "@/constants/Athkar";

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

/** Android channels with one fixed id; per-prayer channel ids are built. */
export const NOTIFICATION_CHANNEL_ID = {
  OPEN_APP_REMINDER: "open_app_reminder",
  QURAN_REMINDER: "quran_reminder",
  ATHKAR_MORNING: `${NOTIFICATION_TYPE.ATHKAR}_${ATHKAR_TYPE.MORNING}`,
  ATHKAR_EVENING: `${NOTIFICATION_TYPE.ATHKAR}_${ATHKAR_TYPE.EVENING}`,
} as const;

/** Fixed channel ids nothing posts on; each channel run deletes them. */
export const RETIRED_CHANNEL_ID = {
  PRAYER_REMINDERS: "reminder",
} as const;

/** expo-notifications' name for the device's own notification sound. */
export const SYSTEM_SOUND = "default";

/** The id and category of the "open the app" reminder. */
export const OPEN_APP_REMINDER_ID = "reminder";

/** Every qada channel id starts with this; the rest names its sound. */
export const QADA_CHANNEL_PREFIX = "qada_reminder";

/** The fields of a notification config, checked against the config type. */
export const NOTIFICATION_FIELD = {
  ENABLED: "enabled",
  SOUND: "sound",
  VIBRATION: "vibration",
  TIMING: "timing",
} as const satisfies Record<string, keyof NotificationWithTiming>;

/** Minutes from the Athan: after it for Iqama, before it for pre-Athan. */
export const NOTIFICATION_TIMING_CHOICES = [5, 10, 15, 20, 30] as const;
