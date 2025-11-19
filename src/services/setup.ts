import * as Sentry from "@sentry/react-native";

// Types
import type { AppState } from "@/types/app";
import type { PrayerTimesStore } from "@/stores/prayerTimes";
import type { NotificationStore } from "@/stores/notification";

// Stores
import { useLocationStore } from "@/stores/location";
import { useQadaStore } from "@/stores/qada";

// Utils
import { requestNotificationPermission } from "@/utils/notifications";
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
  try {
    const { loadPrayerTimes } = prayerStore;

    await loadPrayerTimes();

    // Check for city changes (if auto-update is enabled)
    const locationStore = useLocationStore.getState();
    if (locationStore.autoUpdateLocation) {
      await locationStore.checkAndPromptCityChange();
    }

    // Load qada data (needed for notification scheduling)
    const qadaStore = useQadaStore.getState();
    await qadaStore.loadData();

    await notificationStore.scheduleAllNotifications();
  } catch (error) {
    console.error("App setup failed:", error);
    Sentry.captureException(error);
  }
};

/**
 * Cleanup function to be called when app is terminating
 * Should be called from app lifecycle handlers
 */
export const appCleanup = async (reason: string = "app-termination") => {
  try {
    const { cleanupManager } = await import("@/services/cleanup");
    await cleanupManager.executeAll(reason);
    console.log("[Setup] App cleanup completed");
  } catch (error) {
    console.error("[Setup] App cleanup failed:", error);
    Sentry.captureException(error);
  }
};
