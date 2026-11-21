import { ALARM_DEFAULTS } from "@/constants/Alarm";
import type { ScheduledAlarm } from "@/stores/alarm";
import { runningQuietEnd } from "@/utils/emergencyQuiet";

interface AlarmDueInput {
  alarmId: string;
  // Undefined when the store holds no record of the alarm.
  record: ScheduledAlarm | undefined;
  pendingAlarmId: string | null;
  now: number;
}

// The alarm screen silences an alarm, so it opens only for one that is ringing:
// its trigger has come, the native challenge names it, or its quiet runs.
export const isAlarmDue = ({ alarmId, record, pendingAlarmId, now }: AlarmDueInput): boolean =>
  pendingAlarmId === alarmId ||
  (record !== undefined &&
    (record.triggerTime <= now + ALARM_DEFAULTS.EARLY_OPEN_GRACE_MS ||
      runningQuietEnd(record, now) !== null));
