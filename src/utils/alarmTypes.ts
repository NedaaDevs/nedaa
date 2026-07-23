import { ScheduledAlarmType } from "@/enums/alarm";
import type { AlarmType } from "@/types/alarm";

// The settings store is keyed by AlarmType ("friday") while scheduled alarms and the
// native settings storage are keyed by ScheduledAlarmType ("jummah"). Everything that
// crosses the native boundary must use the scheduled type — fire paths look up by it.
export const toScheduledAlarmType = (
  alarmType: AlarmType
): ScheduledAlarmType.FAJR | ScheduledAlarmType.JUMMAH =>
  alarmType === "fajr" ? ScheduledAlarmType.FAJR : ScheduledAlarmType.JUMMAH;

// Inverse of toScheduledAlarmType: resolve a scheduled alarm back to its settings
// key so store-side logic (snooze caps, titles) reads the user's per-type config.
// CUSTOM has no per-type user settings, so it maps to null.
export const toSettingsAlarmType = (scheduledType: ScheduledAlarmType): AlarmType | null => {
  if (scheduledType === ScheduledAlarmType.FAJR) return "fajr";
  if (scheduledType === ScheduledAlarmType.JUMMAH) return "friday";
  return null;
};
