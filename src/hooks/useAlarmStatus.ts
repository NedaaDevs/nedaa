import { useTranslation } from "react-i18next";

import { useAlarmSettingsStore } from "@/stores/alarmSettings";

/** The alarms that are on, by name, or that none is. */
export const useAlarmStatus = (): string => {
  const { t } = useTranslation();
  const fajrOn = useAlarmSettingsStore((state) => state.fajr.enabled);
  const fridayOn = useAlarmSettingsStore((state) => state.friday.enabled);

  // Only two alarm types exist, so naming them is more useful than a count.
  const names = [
    fajrOn ? t("prayerTimes.fajr") : null,
    fridayOn ? t("prayerTimes.jumuah") : null,
  ].filter(Boolean);
  return names.length ? names.join(" · ") : t("tools.alarm.statusOff");
};
