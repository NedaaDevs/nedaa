import { useCallback } from "react";

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

  // Handle the complete update flow when user confirms city change
  const handleCityChangeUpdate = useCallback(async () => {
    try {
      console.log("[CityChangeHandler] Starting location update flow...");

      const locationUpdateSuccess = await locationStore.handleCityChangeUpdate();

      if (!locationUpdateSuccess) {
        console.error("[CityChangeHandler] Location update failed");
        return;
      }

      console.log("[CityChangeHandler] Location updated, refreshing prayer times...");

      await prayerTimesStore.loadPrayerTimes(true);

      console.log("[CityChangeHandler] Prayer times updated, rescheduling notifications...");

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
