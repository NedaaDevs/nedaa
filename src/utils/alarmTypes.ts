import { ScheduledAlarmType } from "@/enums/alarm";
import type { AlarmType } from "@/types/alarm";

// The settings store is keyed by AlarmType ("friday") while scheduled alarms and the
// native settings storage are keyed by ScheduledAlarmType ("jummah"). Everything that
// crosses the native boundary must use the scheduled type — fire paths look up by it.
export const toScheduledAlarmType = (
  alarmType: AlarmType
): ScheduledAlarmType.FAJR | ScheduledAlarmType.JUMMAH =>
  alarmType === "fajr" ? ScheduledAlarmType.FAJR : ScheduledAlarmType.JUMMAH;
