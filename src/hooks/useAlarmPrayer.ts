import { parseISO } from "date-fns";
import { useTranslation } from "react-i18next";

import { ScheduledAlarmType } from "@/enums/alarm";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { useAlarmStore } from "@/stores/alarm";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { alarmNameKeyOf, alarmPrayerOf } from "@/utils/alarmRinging";

/** A prayer's moment and the zone its clock is read in. */
export type PrayerMoment = { time: Date; timezone: string };

/** The alarm's name, its prayer, and that prayer's moment nearest the ring. */
export const useAlarmPrayer = (alarmId: string, alarmType: ScheduledAlarmType) => {
  const { t } = useTranslation();
  const now = useMinuteClock();
  const triggerTime = useAlarmStore((state) => state.getAlarm(alarmId)?.triggerTime);
  const todayTimings = usePrayerTimesStore((state) => state.todayTimings);
  const tomorrowTimings = usePrayerTimesStore((state) => state.tomorrowTimings);

  const prayer = alarmPrayerOf(alarmType);

  // Null with no times stored, so a wrong time is never shown.
  const nearest = (): PrayerMoment | null => {
    if (!prayer) return null;
    const reference = triggerTime ?? now.getTime();
    const moments = [todayTimings, tomorrowTimings]
      .filter((day): day is DayPrayerTimes => !!day)
      .filter((day) => !!day.timings[prayer.timing])
      .map((day) => ({ time: parseISO(day.timings[prayer.timing]), timezone: day.timezone }));
    if (moments.length === 0) return null;
    return moments.reduce((closest, moment) =>
      Math.abs(moment.time.getTime() - reference) < Math.abs(closest.time.getTime() - reference)
        ? moment
        : closest
    );
  };

  return {
    alarm: t(alarmNameKeyOf(alarmType)),
    prayer: prayer ? t(prayer.nameKey) : null,
    moment: nearest(),
  };
};
