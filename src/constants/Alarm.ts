import type { Href } from "expo-router";
import { Bell, Sun, Building2 } from "lucide-react-native";
import { ScheduledAlarmType } from "@/enums/alarm";
import { PRAYER_ID } from "@/constants/Prayer";
import type { AlarmTimingChoices, AlarmType, TimingConfig, TimingMode } from "@/types/alarm";

/** Persisted store keys; renaming one orphans a user's alarm settings. */
export const ALARM_TYPE = {
  FAJR: PRAYER_ID.FAJR,
  FRIDAY: "friday",
} as const;

/** Persisted timing modes. */
export const ALARM_TIMING_MODE = {
  AT_PRAYER_TIME: "atPrayerTime",
  BEFORE_PRAYER_TIME: "beforePrayerTime",
} as const;

/** What each alarm offers; Friday rings only before Jumuah. */
export const ALARM_TIMING_CHOICES: Record<AlarmType, AlarmTimingChoices> = {
  [ALARM_TYPE.FAJR]: {
    modes: [ALARM_TIMING_MODE.AT_PRAYER_TIME, ALARM_TIMING_MODE.BEFORE_PRAYER_TIME],
    minuteSteps: [0, 5, 10, 15, 20, 30, 45, 60, 90],
    defaultMinutesBefore: 15,
  },
  [ALARM_TYPE.FRIDAY]: {
    modes: [ALARM_TIMING_MODE.BEFORE_PRAYER_TIME],
    minuteSteps: [15, 30, 45, 60, 90, 120],
    defaultMinutesBefore: 30,
  },
};

/** The timing a switch to `mode` stores, on every surface that offers it. */
export const timingForMode = (type: AlarmType, mode: TimingMode): TimingConfig => ({
  mode,
  minutesBefore:
    mode === ALARM_TIMING_MODE.AT_PRAYER_TIME ? 0 : ALARM_TIMING_CHOICES[type].defaultMinutesBefore,
});

/** The steps of the alarm permission gate. */
export const ALARM_PERMISSION = {
  ALARMKIT: "alarmkit",
  LIVE_ACTIVITIES: "liveActivities",
  NOTIFICATIONS: "notifications",
  EXACT_ALARM: "exactAlarm",
  FULL_SCREEN: "fullScreen",
  OVERLAY: "overlay",
  BATTERY: "battery",
} as const;

export type AlarmPermissionId = (typeof ALARM_PERMISSION)[keyof typeof ALARM_PERMISSION];

/** Whether an alarm cannot ring without a permission, or only rings worse. */
export const ALARM_PERMISSION_KIND = { NEEDED: "needed", IMPROVES: "improves" } as const;
export type AlarmPermissionKind =
  (typeof ALARM_PERMISSION_KIND)[keyof typeof ALARM_PERMISSION_KIND];

export const ALARM_PERMISSION_KINDS: Record<AlarmPermissionId, AlarmPermissionKind> = {
  [ALARM_PERMISSION.ALARMKIT]: ALARM_PERMISSION_KIND.NEEDED,
  [ALARM_PERMISSION.LIVE_ACTIVITIES]: ALARM_PERMISSION_KIND.NEEDED,
  [ALARM_PERMISSION.NOTIFICATIONS]: ALARM_PERMISSION_KIND.NEEDED,
  [ALARM_PERMISSION.EXACT_ALARM]: ALARM_PERMISSION_KIND.NEEDED,
  [ALARM_PERMISSION.FULL_SCREEN]: ALARM_PERMISSION_KIND.IMPROVES,
  [ALARM_PERMISSION.OVERLAY]: ALARM_PERMISSION_KIND.IMPROVES,
  [ALARM_PERMISSION.BATTERY]: ALARM_PERMISSION_KIND.IMPROVES,
};

/** True when an alarm cannot ring without the permission. */
export const isNeededPermission = (id: AlarmPermissionId) =>
  ALARM_PERMISSION_KINDS[id] === ALARM_PERMISSION_KIND.NEEDED;

/** Each permission's one name, the title Settings › Alarms gives it. */
export const ALARM_PERMISSION_TITLE_KEY: Record<AlarmPermissionId, string> = {
  [ALARM_PERMISSION.ALARMKIT]: "alarm.permission.ios.alarmkit.title",
  [ALARM_PERMISSION.LIVE_ACTIVITIES]: "alarm.permission.ios.liveActivities.title",
  [ALARM_PERMISSION.NOTIFICATIONS]: "alarm.permission.android.notifications.title",
  [ALARM_PERMISSION.EXACT_ALARM]: "alarm.permission.android.exactAlarm.title",
  [ALARM_PERMISSION.FULL_SCREEN]: "alarm.permission.android.fullScreen.title",
  [ALARM_PERMISSION.OVERLAY]: "alarm.permission.android.overlay.title",
  [ALARM_PERMISSION.BATTERY]: "alarm.permission.android.battery.title",
};

/** The preview button: ready, counting down, or just failed. */
export const ALARM_PREVIEW_STATE = { IDLE: "idle", PENDING: "pending", FAILED: "failed" } as const;
export type AlarmPreviewState = (typeof ALARM_PREVIEW_STATE)[keyof typeof ALARM_PREVIEW_STATE];

/** The route file of one alarm type's full settings, under src/app. */
export const ALARM_SETTINGS_ROUTE = "settings/alarm/[type]";

/** One alarm type's full settings screen. */
export const alarmSettingsHref = (type: AlarmType): Href => ({
  pathname: `/${ALARM_SETTINGS_ROUTE}`,
  params: { type },
});

export const ALARM_DEFAULTS = {
  TAPS_REQUIRED: 5,
  SNOOZE_MINUTES: 5,
  MAX_SNOOZES: 3,
  BACKUP_DELAY_SECONDS: 15,
  STALE_ALARM_THRESHOLD_MS: 2 * 60 * 60 * 1000, // 2 hours
  // Clock skew allowed when the alarm screen opens just before the trigger.
  EARLY_OPEN_GRACE_MS: 60 * 1000,
} as const;

export const ALARM_TYPE_META = {
  [ScheduledAlarmType.FAJR]: { icon: Sun, title: "Fajr Alarm", colorClass: "text-warning" },
  [ScheduledAlarmType.JUMMAH]: {
    icon: Building2,
    title: "Jummah Alarm",
    colorClass: "text-success",
  },
  [ScheduledAlarmType.CUSTOM]: { icon: Bell, title: "Alarm", colorClass: "text-info" },
} as const;
