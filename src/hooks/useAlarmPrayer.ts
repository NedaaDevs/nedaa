import { useTranslation } from "react-i18next";

import { ScheduledAlarmType } from "@/enums/alarm";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { useAlarmStore } from "@/stores/alarm";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import {
  alarmNameKeyOf,
  alarmPrayerOf,
  nearestPrayerMoment,
  storedPrayerDays,
} from "@/utils/alarmRinging";

/** The alarm's name, its prayer, and that prayer's moment nearest the ring. */
export const useAlarmPrayer = (alarmId: string, alarmType: ScheduledAlarmType) => {
  const { t } = useTranslation();
  const now = useMinuteClock();
  const triggerTime = useAlarmStore((state) => state.getAlarm(alarmId)?.triggerTime);
  const sent = useAlarmStore((state) => state.getAlarm(alarmId)?.prayerMoment);
  const todayTimings = usePrayerTimesStore((state) => state.todayTimings);
  const tomorrowTimings = usePrayerTimesStore((state) => state.tomorrowTimings);
  const twoWeeksTimings = usePrayerTimesStore((state) => state.twoWeeksTimings);

  const prayer = alarmPrayerOf(alarmType);

  return {
    alarm: t(alarmNameKeyOf(alarmType)),
    prayer: prayer ? t(prayer.nameKey) : null,
    // The moment sent with the alarm, so both ringing screens show one time.
    moment:
      sent !== undefined
        ? sent && { time: new Date(sent.at), timezone: sent.timezone }
        : nearestPrayerMoment(
            alarmType,
            triggerTime ?? now.getTime(),
            storedPrayerDays({ todayTimings, tomorrowTimings, twoWeeksTimings })
          ),
  };
};
