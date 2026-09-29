import { ScheduledAlarmType } from "@/enums/alarm";
import type { AlarmType } from "@/types/alarm";
import { ALARM_TYPE } from "@/constants/Alarm";

// Native storage and fire paths key by scheduled type, not by settings key.
export const toScheduledAlarmType = (
  alarmType: AlarmType
): ScheduledAlarmType.FAJR | ScheduledAlarmType.JUMMAH =>
  alarmType === ALARM_TYPE.FAJR ? ScheduledAlarmType.FAJR : ScheduledAlarmType.JUMMAH;

// Inverse of toScheduledAlarmType; CUSTOM has no per-type settings, so null.
export const toSettingsAlarmType = (scheduledType: ScheduledAlarmType): AlarmType | null => {
  if (scheduledType === ScheduledAlarmType.FAJR) return ALARM_TYPE.FAJR;
  if (scheduledType === ScheduledAlarmType.JUMMAH) return ALARM_TYPE.FRIDAY;
  return null;
};
