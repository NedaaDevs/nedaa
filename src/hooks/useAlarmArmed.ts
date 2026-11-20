import { useAlarmStore, type ScheduledAlarm } from "@/stores/alarm";
import type { AlarmType } from "@/types/alarm";
import { toScheduledAlarmType } from "@/utils/alarmTypes";

/** The next armed alarm of this type, if any; a rehearsal does not count. */
export const useAlarmArmed = (type: AlarmType): ScheduledAlarm | undefined => {
  const scheduledType = toScheduledAlarmType(type);
  return useAlarmStore((state) =>
    Object.values(state.scheduledAlarms)
      .filter((alarm) => alarm.alarmType === scheduledType && !alarm.isPreview)
      .reduce<ScheduledAlarm | undefined>(
        (next, alarm) => (next && next.triggerTime <= alarm.triggerTime ? next : alarm),
        undefined
      )
  );
};
