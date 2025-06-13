import * as Sentry from "@sentry/react-native";

// Types
import type { AppState } from "@/types/app";
import type { PrayerTimesStore } from "@/stores/prayerTimes";
import type { NotificationStore } from "@/stores/notification";

// Utils
import { requestNotificationPermission, configureNotifications } from "@/utils/notifications";
import { requestLocationPermission } from "@/utils/location";

export const firstRunSetup = async (appStore: AppState) => {
  try {
    // Only request if first run and permissions aren't determined
    if (appStore.isFirstRun) {
      // Request notification permission
      await requestNotificationPermission();

      // Request Location permission
      await requestLocationPermission();

      // Mark first run as complete
      appStore.setIsFirstRun(false);
    }
  } catch (error) {
    console.error("First run setup failed:", error);
    Sentry.captureException(error);
  }
};

export const appSetup = async (
  prayerStore: PrayerTimesStore,
  notificationStore: NotificationStore
) => {
  // Configure notifications (includes handler, listeners, and channels)
  configureNotifications();
  try {
    const { loadPrayerTimes } = prayerStore;

    await loadPrayerTimes();

    // notification scheduling
    await notificationStore.scheduleAllNotifications();
  } catch (error) {
    console.error("App setup failed:", error);
    Sentry.captureException(error);
  }
};
