import { AppLogger } from "@/utils/appLogger";

// Types
import type { PrayerTimesStore } from "@/stores/prayerTimes";
import type { NotificationStore } from "@/stores/notification";

// Stores
import { useLocationStore } from "@/stores/location";
import { useQadaStore } from "@/stores/qada";
import { useUmrahGuideStore } from "@/stores/umrahGuide";

// Utils
import { ensureAlarmsScheduled, waitForAlarmStores } from "@/utils/alarmScheduler";
import { reloadPrayerWidgets } from "../../modules/expo-widget/src";
import { refreshAllWidgets } from "../../modules/expo-widgets/src";
import { syncWidgetPayloads } from "@/services/widgetPayloads";

// Background task
import { registerBackgroundRefresh } from "@/tasks/backgroundRefresh";
import { BackgroundTaskLog } from "@/services/background-task-log";

// DB cleanup
import { UmrahDB } from "@/services/umrah-db";
import { cleanupManager } from "@/services/cleanup";

import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";

export const appSetup = async (
  prayerStore: PrayerTimesStore,
  notificationStore: NotificationStore
) => {
  try {
    const { loadPrayerTimes } = prayerStore;

    await loadPrayerTimes();
    // Gate scheduling on alarm-store rehydration; reading defaults here silently
    // skips scheduling for the launch. Bounded so setup can never hang.
    await waitForAlarmStores();
    await ensureAlarmsScheduled();

    // Check for city changes (if auto-update is enabled). Skipped in screenshot
    // mode: location is seeded, and the GMS settings check pops a native dialog.
    const locationStore = useLocationStore.getState();
    if (!IS_SCREENSHOT_MODE && locationStore.autoUpdateLocation) {
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

    reloadPrayerWidgets();
    refreshAllWidgets();
    void syncWidgetPayloads();
  } catch (error) {
    console.error("App setup failed:", error);
    AppLogger.create("crash").e(
      "appSetup",
      "setup failed",
      error instanceof Error ? error : undefined
    );
  }
};
