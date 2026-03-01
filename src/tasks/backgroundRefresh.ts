import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

// Services
import { PrayerTimesDB } from "@/services/db";
import { BackgroundTaskLog } from "@/services/background-task-log";

// Stores
import { useNotificationStore } from "@/stores/notification";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import locationStore from "@/stores/location";

// Utils
import { timeZonedNow, dateToInt } from "@/utils/date";
import { addDays } from "date-fns";

export const BACKGROUND_REFRESH_TASK = "dev.nedaa.app.background-refresh";
const MINIMUM_INTERVAL = 60 * 24; // 24 hours (in minutes)
const MIN_FUTURE_DAYS = 3; // Fetch if less than 3 days of data remain

// Define the task in global scope (required by expo-task-manager)
TaskManager.defineTask(BACKGROUND_REFRESH_TASK, async () => {
  const startTime = Date.now();

  try {
    await BackgroundTaskLog.log(
      BACKGROUND_REFRESH_TASK,
      "task_started",
      "success",
      `Started at ${new Date().toISOString()}`
    );

    const timezone = locationStore.getState().locationDetails.timezone;
    if (!timezone) {
      await BackgroundTaskLog.log(
        BACKGROUND_REFRESH_TASK,
        "no_timezone",
        "skipped",
        "No timezone available, skipping"
      );
      return BackgroundTask.BackgroundTaskResult.Failed;
    }

    const now = timeZonedNow(timezone);
    const todayInt = dateToInt(now);
    const futureDate = dateToInt(addDays(now, MIN_FUTURE_DAYS));

    // Check if we have enough prayer data
    const futureData = await PrayerTimesDB.getPrayerTimesByDateRange(todayInt, futureDate);
    const hasSufficientData = futureData.length >= MIN_FUTURE_DAYS;

    let fetchedNewData = false;
    if (!hasSufficientData) {
      await BackgroundTaskLog.log(
        BACKGROUND_REFRESH_TASK,
        "fetching_prayer_times",
        "success",
        `Only ${futureData.length} days of data, fetching more`
      );

      try {
        const prayerTimesStore = usePrayerTimesStore.getState();
        const success = await prayerTimesStore.getAndStorePrayerTimes();

        if (success) {
          fetchedNewData = true;
          await BackgroundTaskLog.log(BACKGROUND_REFRESH_TASK, "prayer_times_fetched", "success");
        } else {
          await BackgroundTaskLog.log(
            BACKGROUND_REFRESH_TASK,
            "prayer_times_fetch_failed",
            "failed",
            "getAndStorePrayerTimes returned false"
          );
        }
      } catch (fetchError) {
        const msg = fetchError instanceof Error ? fetchError.message : String(fetchError);
        await BackgroundTaskLog.log(
          BACKGROUND_REFRESH_TASK,
          "prayer_times_fetch_error",
          "failed",
          msg
        );
      }
    } else {
      await BackgroundTaskLog.log(
        BACKGROUND_REFRESH_TASK,
        "data_sufficient",
        "skipped",
        `${futureData.length} days available, no fetch needed`
      );
    }

    // Reschedule notifications
    try {
      const notificationStore = useNotificationStore.getState();
      await notificationStore.scheduleAllNotifications();

      const durationMs = Date.now() - startTime;
      await BackgroundTaskLog.log(
        BACKGROUND_REFRESH_TASK,
        "task_completed",
        "success",
        `Fetched: ${fetchedNewData}, duration: ${durationMs}ms`,
        durationMs
      );
    } catch (scheduleError) {
      const msg = scheduleError instanceof Error ? scheduleError.message : String(scheduleError);
      await BackgroundTaskLog.log(BACKGROUND_REFRESH_TASK, "schedule_failed", "failed", msg);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - startTime;
    await BackgroundTaskLog.log(BACKGROUND_REFRESH_TASK, "task_error", "failed", msg, durationMs);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundRefresh(): Promise<boolean> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
      console.warn("[BackgroundRefresh] Background tasks are restricted on this device");
      await BackgroundTaskLog.log(
        BACKGROUND_REFRESH_TASK,
        "registration",
        "failed",
        "Background tasks restricted"
      );
      return false;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_REFRESH_TASK);
    if (isRegistered) {
      console.log("[BackgroundRefresh] Task already registered");
      return true;
    }

    await BackgroundTask.registerTaskAsync(BACKGROUND_REFRESH_TASK, {
      minimumInterval: MINIMUM_INTERVAL,
    });

    console.log("[BackgroundRefresh] Task registered successfully");
    await BackgroundTaskLog.log(BACKGROUND_REFRESH_TASK, "registered", "success");
    return true;
  } catch (error) {
    console.error("[BackgroundRefresh] Registration failed:", error);
    const msg = error instanceof Error ? error.message : String(error);
    await BackgroundTaskLog.log(BACKGROUND_REFRESH_TASK, "registration_error", "failed", msg);
    return false;
  }
}

export async function unregisterBackgroundRefresh(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_REFRESH_TASK);
    if (isRegistered) {
      await BackgroundTask.unregisterTaskAsync(BACKGROUND_REFRESH_TASK);
      console.log("[BackgroundRefresh] Task unregistered");
    }
  } catch (error) {
    console.error("[BackgroundRefresh] Unregistration failed:", error);
  }
}
