import { usePrayerTimesStore } from "@/stores/prayerTimes";

/** Clears a load failure and fetches the prayer times again from the source. */
export const useRetryPrayerTimes = () => {
  const clearError = usePrayerTimesStore((state) => state.clearError);
  const loadPrayerTimes = usePrayerTimesStore((state) => state.loadPrayerTimes);
  return () => {
    clearError();
    // The store records a failure in hasError, which its readers show.
    loadPrayerTimes(true).catch(() => {});
  };
};
