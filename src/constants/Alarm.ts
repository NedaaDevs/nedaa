import { Bell, Sun, Building2 } from "lucide-react-native";

export const ALARM_DEFAULTS = {
  TAPS_REQUIRED: 5,
  SNOOZE_MINUTES: 5,
  MAX_SNOOZES: 3,
  BACKUP_DELAY_SECONDS: 15,
  STALE_ALARM_THRESHOLD_MS: 2 * 60 * 60 * 1000, // 2 hours
} as const;

// Vibration pattern: 800ms on, 200ms off (repeated)
export const VIBRATION_PATTERN = [0, 800, 200, 800, 200, 800, 200, 800] as const;

export const ALARM_TYPE_META = {
  fajr: { icon: Sun, title: "Fajr Alarm", colorClass: "text-warning" },
  jummah: { icon: Building2, title: "Jummah Alarm", colorClass: "text-success" },
  custom: { icon: Bell, title: "Alarm", colorClass: "text-info" },
} as const;
