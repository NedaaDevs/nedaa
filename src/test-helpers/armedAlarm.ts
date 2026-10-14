import { ScheduledAlarmType } from "@/enums/alarm";
import { useAlarmStore, type ScheduledAlarm } from "@/stores/alarm";

const HOUR_MS = 60 * 60 * 1000;

/** A Fajr alarm record as the store holds it once armed. */
export const fajrRecord = (
  alarmId: string,
  triggerTime = Date.now() + HOUR_MS,
  isPreview = false
): ScheduledAlarm => ({
  alarmId,
  alarmType: ScheduledAlarmType.FAJR,
  title: "Fajr",
  triggerTime,
  liveActivityId: null,
  snoozeCount: 0,
  ...(isPreview && { isPreview }),
});

/** The store holds one Fajr alarm an hour out; a rehearsal when `isPreview`. */
export const armFajr = (isPreview = false) => {
  const record = fajrRecord("fajr-armed", undefined, isPreview);
  useAlarmStore.setState({ scheduledAlarms: { [record.alarmId]: record } });
};
