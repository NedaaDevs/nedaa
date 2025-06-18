import { useCallback, useRef } from "react";

// Stores
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useNotificationStore } from "@/stores/notification";

/**
 * Hook to handle city change detection and coordinate updates across stores

 */
export const useCityChangeHandler = () => {
  const locationStore = useLocationStore();
  const prayerTimesStore = usePrayerTimesStore();
  const notificationStore = useNotificationStore();

  // Throttling refs to prevent excessive API calls
  const lastPrayerTimesUpdateRef = useRef<number>(0);

  // Throttle periods in milliseconds
  const PRAYER_TIMES_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

  // Handle the complete update flow when user confirms city change
  const handleCityChangeUpdate = useCallback(async () => {
    try {
      console.log("[CityChangeHandler] Starting location update flow...");

      const locationUpdateSuccess = await locationStore.handleCityChangeUpdate();

      if (!locationUpdateSuccess) {
        console.error("[CityChangeHandler] Location update failed");
        return;
      }

      const now = Date.now();

      // Throttle prayer times updates
      const shouldUpdatePrayerTimes =
        now - lastPrayerTimesUpdateRef.current > PRAYER_TIMES_THROTTLE_MS;
      if (shouldUpdatePrayerTimes) {
        console.log("[CityChangeHandler] Location updated, refreshing prayer times...");
        lastPrayerTimesUpdateRef.current = now;
        await prayerTimesStore.loadPrayerTimes(true);
      } else {
        const remainingTime = Math.ceil(
          (PRAYER_TIMES_THROTTLE_MS - (now - lastPrayerTimesUpdateRef.current)) / 1000
        );
        console.log(
          `[CityChangeHandler] Prayer times update throttled. Next update in ${remainingTime}s`
        );
      }

      await notificationStore.scheduleAllNotifications();

      console.log("[CityChangeHandler] All updates completed successfully");

      locationStore.dismissCityChangeModal();
    } catch (error) {
      console.error("[CityChangeHandler] Update flow failed:", error);
      // Keep modal open so user can retry
      locationStore.dismissCityChangeModal();
    }
  }, [locationStore, prayerTimesStore, notificationStore]);

  // Check for city change periodically or on app foreground
  const checkForCityChange = useCallback(async () => {
    await locationStore.checkAndPromptCityChange();
  }, [locationStore]);

  return {
    //  state
    showCityChangeModal: locationStore.showCityChangeModal,
    pendingCityChange: locationStore.pendingCityChange,
    isUpdatingLocation: locationStore.isUpdatingLocation,

    // Actions
    handleCityChangeUpdate,
    dismissCityChangeModal: locationStore.dismissCityChangeModal,
    checkForCityChange,
  };
};

export default useCityChangeHandler;
