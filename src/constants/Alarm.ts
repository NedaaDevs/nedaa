import { Bell, Sun, Building2 } from "lucide-react-native";
import { ScheduledAlarmType } from "@/enums/alarm";

export const ALARM_DEFAULTS = {
  TAPS_REQUIRED: 5,
  SNOOZE_MINUTES: 5,
  MAX_SNOOZES: 3,
  BACKUP_DELAY_SECONDS: 15,
  STALE_ALARM_THRESHOLD_MS: 2 * 60 * 60 * 1000, // 2 hours
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
