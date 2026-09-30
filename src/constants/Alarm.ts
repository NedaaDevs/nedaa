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
  NOTIFICATIONS: "notifications",
  EXACT_ALARM: "exactAlarm",
  FULL_SCREEN: "fullScreen",
  OVERLAY: "overlay",
  BATTERY: "battery",
} as const;

export type AlarmPermissionId = (typeof ALARM_PERMISSION)[keyof typeof ALARM_PERMISSION];

/** One alarm type's full settings screen. */
export const alarmSettingsHref = (type: AlarmType): Href => ({
  pathname: "/settings/alarm/[type]",
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
