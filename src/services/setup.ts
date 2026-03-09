import * as Sentry from "@sentry/react-native";

// Types
import type { PrayerTimesStore } from "@/stores/prayerTimes";
import type { NotificationStore } from "@/stores/notification";

// Stores
import { useLocationStore } from "@/stores/location";
import { useQadaStore } from "@/stores/qada";
import { useUmrahGuideStore } from "@/stores/umrahGuide";

// Utils
import { ensureAlarmsScheduled } from "@/utils/alarmScheduler";
import { reloadPrayerWidgets } from "../../modules/expo-widget/src";

// Background task
import { registerBackgroundRefresh } from "@/tasks/backgroundRefresh";
import { BackgroundTaskLog } from "@/services/background-task-log";

// DB cleanup
import { closeDatabase } from "@/services/db";
import { AthkarDB } from "@/services/athkar-db";
import { UmrahDB } from "@/services/umrah-db";
import { cleanupManager } from "@/services/cleanup";

export const appSetup = async (
  prayerStore: PrayerTimesStore,
  notificationStore: NotificationStore
) => {
  try {
    const { loadPrayerTimes } = prayerStore;

    await loadPrayerTimes();
    await ensureAlarmsScheduled();

    // Check for city changes (if auto-update is enabled)
    const locationStore = useLocationStore.getState();
    if (locationStore.autoUpdateLocation) {
      await locationStore.checkAndPromptCityChange();
    }

    // Load qada data (needed for notification scheduling)
    const qadaStore = useQadaStore.getState();
    await qadaStore.loadData();

    const umrahStore = useUmrahGuideStore.getState();
    await umrahStore.initializeDb();

    await notificationStore.scheduleAllNotifications();

    await BackgroundTaskLog.initialize();
    await registerBackgroundRefresh();

    // Register DB cleanup tasks for graceful shutdown
    cleanupManager.register("umrah-db-flush", () => UmrahDB.flush(), 10);
    cleanupManager.register("close-prayer-db", closeDatabase, 5);
    cleanupManager.register("close-athkar-db", AthkarDB.close, 5);
    cleanupManager.register("close-bg-log-db", BackgroundTaskLog.close, 5);

    reloadPrayerWidgets();
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
