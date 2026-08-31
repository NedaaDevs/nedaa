import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

// Enums
import { PlatformType } from "@/enums/app";

// Services
import { PrayerTimesDB } from "@/services/db";
import { BackgroundTaskLog } from "@/services/background-task-log";

// Stores
import { useNotificationStore } from "@/stores/notification";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import locationStore from "@/stores/location";
import { useProviderSettingsStore, awaitPendingReapply } from "@/stores/providerSettings";
import { useCustomSoundsStore } from "@/stores/customSounds";
import { useQuranRemindersStore } from "@/stores/quranReminders";

// Utils
import { timeZonedNow, dateToInt, getTimezoneMonth, getTimezoneYear } from "@/utils/date";
import { summarizeSchedulingResult } from "@/utils/notificationReschedule";
import { AppLogger } from "@/utils/appLogger";
import { waitForHydration } from "@/utils/storeHydration";
import { addDays } from "date-fns";

export const BACKGROUND_REFRESH_TASK = "dev.nedaa.app.background-refresh";
const MINIMUM_INTERVAL = 60 * 24; // 24 hours (in minutes)
const MIN_FUTURE_DAYS = 3; // Fetch if less than 3 days of data remain

const BG_HYDRATION_TIMEOUT_MS = 5000;

// A headless launch starts a fresh JS process; the persisted stores rehydrate
// asynchronously. Reading them early yields defaults — the Riyadh fallback
// timezone, default sounds — so a reschedule from defaults replaces the user's
// queue with wrong times. The wait is bounded so a stalled rehydration cannot
// eat the OS window, and the names of the stores that hit that bound come back
// to the caller: the run is skipped instead, which keeps the previous schedule.
const waitForBackgroundStores = async (): Promise<string[]> => {
  const timedOut: string[] = [];
  const gated = [
    ["location", locationStore.persist],
    ["prayerTimes", usePrayerTimesStore.persist],
    ["notification", useNotificationStore.persist],
    ["providerSettings", useProviderSettingsStore.persist],
    ["customSounds", useCustomSoundsStore.persist],
    ["quranReminders", useQuranRemindersStore.persist],
  ] as const;
  await Promise.all(
    gated.map(([name, persist]) =>
      waitForHydration(persist, {
        timeoutMs: BG_HYDRATION_TIMEOUT_MS,
        onTimeout: () => {
          timedOut.push(name);
          void BackgroundTaskLog.log(
            BACKGROUND_REFRESH_TASK,
            "hydration_timeout",
            "skipped",
            `${name} store not hydrated after ${BG_HYDRATION_TIMEOUT_MS}ms`
          );
        },
      })
    )
  );
  return timedOut;
};

// The task body, exported so the debug screen can run it on demand. The OS
// trigger and the manual run share one code path and one log trail.
const runBackgroundRefresh = async (): Promise<BackgroundTask.BackgroundTaskResult> => {
  const startTime = Date.now();

  try {
    await BackgroundTaskLog.log(
      BACKGROUND_REFRESH_TASK,
      "task_started",
      "success",
      `Started at ${new Date().toISOString()}`
    );

    const notHydrated = await waitForBackgroundStores();
    if (notHydrated.length > 0) {
      await BackgroundTaskLog.log(
        BACKGROUND_REFRESH_TASK,
        "hydration_incomplete",
        "failed",
        `run skipped: ${notHydrated.join(", ")} not hydrated`
      );
      return BackgroundTask.BackgroundTaskResult.Failed;
    }

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

    // A pending reapply means the stored rows were computed with old provider
    // settings; row count alone cannot see that, so it forces the fetch.
    const pendingReapply = await awaitPendingReapply();

    const futureData = await PrayerTimesDB.getPrayerTimesByDateRange(todayInt, futureDate);
    const hasSufficientData = futureData.length >= MIN_FUTURE_DAYS;

    let fetchedNewData = false;
    if (!hasSufficientData || pendingReapply) {
      await BackgroundTaskLog.log(
        BACKGROUND_REFRESH_TASK,
        "fetching_prayer_times",
        "success",
        pendingReapply
          ? "Provider reapply pending, refetching"
          : `Only ${futureData.length} days of data, fetching more`
      );

      try {
        const prayerTimesStore = usePrayerTimesStore.getState();
        const success = await prayerTimesStore.getAndStorePrayerTimes();

        if (success) {
          // A late-December window crosses into January and the current-year
          // fetch cannot cover it; best-effort, the next run retries.
          if (getTimezoneMonth(timezone) === 12) {
            await prayerTimesStore.getAndStorePrayerTimes(getTimezoneYear(timezone) + 1);
          }
          if (pendingReapply) {
            useProviderSettingsStore.getState().clearPendingReapply();
          }
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

    // The scheduler reads the store's two-week projection; without this the
    // input is the window persisted at the last foreground launch, which ends
    // 13 days after that launch even when the database holds fresh rows.
    await usePrayerTimesStore.getState().refreshTimingsFromDb();

    // Reschedule notifications
    try {
      const notificationStore = useNotificationStore.getState();
      const scheduleResult = await notificationStore.scheduleAllNotifications();
      const summary = summarizeSchedulingResult(scheduleResult);

      const durationMs = Date.now() - startTime;
      await BackgroundTaskLog.log(
        BACKGROUND_REFRESH_TASK,
        "task_completed",
        summary.result,
        `${summary.details}; fetched=${fetchedNewData}`,
        durationMs
      );
      // A skip (permission revoked, notifications off) is a user state, not a
      // system failure — a retry cannot resolve it, so the task reports Success.
      if (summary.result === "failed") {
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
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
  } finally {
    // A headless process can die right after the task returns. The file logger
    // buffers lines, so an explicit flush keeps the run's trace on disk.
    AppLogger.flushAll();
  }
};

let inFlightRun: Promise<BackgroundTask.BackgroundTaskResult> | null = null;

/**
 * Runs the refresh, or joins the run already in progress.
 *
 * One OS job can invoke the task many times at once, and every run rebuilds the whole
 * notification set — N overlapping runs request N × ~70 alarms against Android's
 * 500-concurrent-alarm-per-uid ceiling, and most of them fail. The `run_coalesced`
 * entries also count the overlap, which the task log cannot otherwise show.
 */
export const executeBackgroundRefresh = async (): Promise<BackgroundTask.BackgroundTaskResult> => {
  const current = inFlightRun;
  if (current) {
    await BackgroundTaskLog.log(
      BACKGROUND_REFRESH_TASK,
      "run_coalesced",
      "skipped",
      "joined the run already in progress"
    );
    return current;
  }

  // Assigned before the first await so a caller arriving in the same tick sees it.
  const run = runBackgroundRefresh().finally(() => {
    if (inFlightRun === run) inFlightRun = null;
  });
  inFlightRun = run;
  return run;
};

// Define the task in global scope (required by expo-task-manager)
TaskManager.defineTask(BACKGROUND_REFRESH_TASK, executeBackgroundRefresh);

// iOS can stop a processing task at any point. The scheduler orders items
// soonest-first, so an interrupted run keeps the nearest days; this records
// the interruption and lands the buffered log lines before the process dies.
if (Platform.OS === PlatformType.IOS) {
  BackgroundTask.addExpirationListener(() => {
    void BackgroundTaskLog.log(
      BACKGROUND_REFRESH_TASK,
      "task_expired",
      "failed",
      "iOS stopped the background run before completion"
    );
    AppLogger.flushAll();
  });
}

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
    const msg = error instanceof Error ? error.message : String(error);
    await BackgroundTaskLog.log(BACKGROUND_REFRESH_TASK, "unregistration_error", "failed", msg);
  }
}
