import { parseISO } from "date-fns";

import { ScheduledAlarmType } from "@/enums/alarm";
import type { AlarmType } from "@/types/alarm";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { ALARM_TYPE } from "@/constants/Alarm";
import { PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import { isFridayInTimeZone } from "@/utils/weekdayTimeZone";

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

// The alarm a prayer offers on a day: Fajr's always, Friday's for Dhuhr on a
// Friday in the day's own zone, the day the Jummah alarm rings.
export const alarmTypeForPrayer = (
  prayerId: PrayerId,
  day: Pick<DayPrayerTimes, "timings" | "timezone">
): AlarmType | null => {
  if (prayerId === PRAYER_ID.FAJR) return ALARM_TYPE.FAJR;
  if (prayerId !== PRAYER_ID.DHUHR) return null;
  const friday = isFridayInTimeZone(parseISO(day.timings[PRAYER_ID.DHUHR]), day.timezone);
  return friday ? ALARM_TYPE.FRIDAY : null;
};
