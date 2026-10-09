import { ALARM_DEFAULTS } from "@/constants/Alarm";

interface AlarmDueInput {
  alarmId: string;
  // Null when the store holds no record of the alarm.
  triggerTime: number | null;
  pendingAlarmId: string | null;
  now: number;
}

// The alarm screen silences an alarm, so it opens only for one that is ringing:
// its trigger has come, or the native challenge names it.
export const isAlarmDue = ({ alarmId, triggerTime, pendingAlarmId, now }: AlarmDueInput): boolean =>
  pendingAlarmId === alarmId ||
  (triggerTime !== null && triggerTime <= now + ALARM_DEFAULTS.EARLY_OPEN_GRACE_MS);
