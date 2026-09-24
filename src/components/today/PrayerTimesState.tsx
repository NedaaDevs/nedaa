import { useTranslation } from "react-i18next";

import { EmptyState } from "@/components/feedback/EmptyState";
import { TimelineSkeleton } from "@/components/ui/timeline";
import { usePrayerTimesStore } from "@/stores/prayerTimes";

/** Today before its times arrive: a placeholder, or a retry after a failure. */
export const PrayerTimesState = () => {
  const { t } = useTranslation();
  const today = usePrayerTimesStore((state) => state.todayTimings);
  const hasError = usePrayerTimesStore((state) => state.hasError);
  const isLoading = usePrayerTimesStore((state) => state.isLoading);
  const loadPrayerTimes = usePrayerTimesStore((state) => state.loadPrayerTimes);
  const clearError = usePrayerTimesStore((state) => state.clearError);

  if (today) return null;

  if (hasError) {
    const retry = () => {
      clearError();
      // The store records a failure in hasError, which this state reads back.
      loadPrayerTimes(true).catch(() => {});
    };
    return <EmptyState type="error" onRetry={retry} isRetrying={isLoading} />;
  }

  return isLoading ? <TimelineSkeleton label={t("common.loading")} /> : null;
};
