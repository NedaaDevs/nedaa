import { useTranslation } from "react-i18next";

import { ALARM_TYPE } from "@/constants/Alarm";
import { useAlarmOn } from "@/hooks/useAlarmOn";

/** The alarms that are on, by name, or that none is. */
export const useAlarmStatus = (): string => {
  const { t } = useTranslation();
  const fajrOn = useAlarmOn(ALARM_TYPE.FAJR);
  const fridayOn = useAlarmOn(ALARM_TYPE.FRIDAY);

  // Only two alarm types exist, so naming them is more useful than a count.
  const names = [
    fajrOn ? t("prayerTimes.fajr") : null,
    fridayOn ? t("prayerTimes.jumuah") : null,
  ].filter(Boolean);
  return names.length ? names.join(" · ") : t("tools.alarm.statusOff");
};
