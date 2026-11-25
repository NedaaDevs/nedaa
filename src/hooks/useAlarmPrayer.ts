import { useTranslation } from "react-i18next";

import { ScheduledAlarmType } from "@/enums/alarm";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { useAlarmStore } from "@/stores/alarm";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { alarmNameKeyOf, alarmPrayerOf, nearestPrayerMoment } from "@/utils/alarmRinging";

/** The alarm's name, its prayer, and that prayer's moment nearest the ring. */
export const useAlarmPrayer = (alarmId: string, alarmType: ScheduledAlarmType) => {
  const { t } = useTranslation();
  const now = useMinuteClock();
  const triggerTime = useAlarmStore((state) => state.getAlarm(alarmId)?.triggerTime);
  const todayTimings = usePrayerTimesStore((state) => state.todayTimings);
  const tomorrowTimings = usePrayerTimesStore((state) => state.tomorrowTimings);

  const prayer = alarmPrayerOf(alarmType);

  return {
    alarm: t(alarmNameKeyOf(alarmType)),
    prayer: prayer ? t(prayer.nameKey) : null,
    // Null with no times stored, so a wrong time is never shown.
    moment: nearestPrayerMoment(alarmType, triggerTime ?? now.getTime(), [
      todayTimings,
      tomorrowTimings,
    ]),
  };
};
