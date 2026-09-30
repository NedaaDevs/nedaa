import { useTranslation } from "react-i18next";

import { StatePanel } from "@/components/ui/state-panel";
import { TimelineSkeleton } from "@/components/ui/timeline";
import { useRetryPrayerTimes } from "@/hooks/useRetryPrayerTimes";
import { usePrayerTimesStore } from "@/stores/prayerTimes";

/** Today before its times arrive: a placeholder, or a retry after a failure. */
export const PrayerTimesState = () => {
  const { t } = useTranslation();
  const today = usePrayerTimesStore((state) => state.todayTimings);
  const hasError = usePrayerTimesStore((state) => state.hasError);
  const isLoading = usePrayerTimesStore((state) => state.isLoading);
  const retry = useRetryPrayerTimes();

  if (today) return null;

  if (hasError) {
    return (
      <StatePanel
        title={t("today.failed.title")}
        body={t("today.failed.body")}
        action={{ label: t("common.retry"), onPress: retry }}
      />
    );
  }

  return isLoading ? <TimelineSkeleton label={t("common.loading")} /> : null;
};
