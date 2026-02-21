import { useEffect, useRef } from "react";
import { Linking, AppState, Platform } from "react-native";
import { router } from "expo-router";
import * as ExpoAlarm from "expo-alarm";
import { getSnoozeQueue, clearSnoozeQueue } from "expo-alarm";
import { useAlarmStore } from "@/stores/alarm";
import { detectActiveAlarm } from "@/utils/activeAlarmDetector";
import { alarmLog } from "@/utils/alarmReport";

const handledAlarmIds = new Map<string, number>();
const STALE_HANDLED_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
let isProcessingQueues = false;

function pruneHandledAlarmIds() {
  const cutoff = Date.now() - STALE_HANDLED_THRESHOLD_MS;
  for (const [id, timestamp] of handledAlarmIds) {
    if (timestamp < cutoff) {
      handledAlarmIds.delete(id);
    }
  }
}

const navGuard = {
  activeAlarmId: null as string | null,
  lastNavTime: 0,
};

const NAVIGATION_DEBOUNCE_MS = 5000;

export function setAlarmScreenActive(alarmId: string | null) {
  navGuard.activeAlarmId = alarmId;
  if (alarmId) {
    navGuard.lastNavTime = Date.now();
  }
}

export function markAlarmHandled(alarmId: string) {
  handledAlarmIds.set(alarmId, Date.now());
}

export function isAlarmHandled(alarmId: string): boolean {
  return handledAlarmIds.has(alarmId);
}

async function processQueues() {
  if (isProcessingQueues) return;
  isProcessingQueues = true;
  try {
    await processCompletedQueue();
    await processSnoozeQueue();
    pruneHandledAlarmIds();
  } finally {
    isProcessingQueues = false;
  }
}

// Process alarms completed via Android overlay
async function processCompletedQueue() {
  if (Platform.OS !== "android") return;

  try {
    const queue = await ExpoAlarm.getCompletedQueue();
    if (queue.length === 0) return;

    const { completeAlarm } = useAlarmStore.getState();

    for (const item of queue) {
      handledAlarmIds.set(item.alarmId, Date.now());
      await completeAlarm(item.alarmId);
    }

    await ExpoAlarm.clearCompletedQueue();
  } catch (error) {
    alarmLog.e(
      "DeepLink",
      "Failed to process completed queue",
      error instanceof Error ? error : undefined
    );
  }
}

// Process alarms snoozed via Android overlay - sync JS store with native state
async function processSnoozeQueue() {
  if (Platform.OS !== "android") return;

  try {
    const queue = await getSnoozeQueue();
    if (queue.length === 0) return;

    for (const item of queue) {
      // Mark original alarm as handled
      handledAlarmIds.set(item.originalAlarmId, Date.now());

      // Remove old alarm from store
      useAlarmStore.setState((state) => {
        const newAlarms = { ...state.scheduledAlarms };
        delete newAlarms[item.originalAlarmId];
        return { scheduledAlarms: newAlarms };
      });

      // Add new snooze alarm to store
      useAlarmStore.setState((state) => ({
        scheduledAlarms: {
          ...state.scheduledAlarms,
          [item.snoozeAlarmId]: {
            alarmId: item.snoozeAlarmId,
            alarmType: item.alarmType as "fajr" | "jummah" | "custom",
            title: item.title,
            triggerTime: item.snoozeEndTime,
            liveActivityId: null,
            snoozeCount: item.snoozeCount,
          },
        },
      }));

      // Update Live Activity
      await ExpoAlarm.endAllLiveActivities();
      await ExpoAlarm.startLiveActivity({
        alarmId: item.snoozeAlarmId,
        alarmType: item.alarmType as "fajr" | "jummah" | "custom",
        title: item.title,
        triggerDate: new Date(item.snoozeEndTime),
      });
    }

    await clearSnoozeQueue();
  } catch (error) {
    alarmLog.e(
      "DeepLink",
      "Failed to process snooze queue",
      error instanceof Error ? error : undefined
    );
  }
}

export function navigateToAlarm(alarmId: string, alarmType: string, _source: string) {
  // Android: Native overlay handles alarms, don't navigate to /alarm
  if (Platform.OS === "android") {
    return false;
  }

  const now = Date.now();

  if (navGuard.activeAlarmId) return false;
  if (now - navGuard.lastNavTime < NAVIGATION_DEBOUNCE_MS) return false;
  if (handledAlarmIds.has(alarmId)) return false;

  navGuard.activeAlarmId = alarmId;
  navGuard.lastNavTime = now;

  router.replace({
    pathname: "/alarm",
    params: { alarmId, alarmType },
  });

  return true;
}

export function useAlarmDeepLink() {
  const { scheduledAlarms } = useAlarmStore();
  const initialUrlProcessed = useRef(false);

  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      processAlarmUrl(event.url);
    };

    if (!initialUrlProcessed.current) {
      initialUrlProcessed.current = true;

      // Process any alarms completed/snoozed via Android overlay first
      processQueues();

      Linking.getInitialURL().then((url) => {
        if (url) {
          processAlarmUrl(url);
        } else {
          detectActiveAlarm(scheduledAlarms, handledAlarmIds).then((active) => {
            if (active) {
              navigateToAlarm(active.alarmId, active.alarmType, active.source);
            }
          });
        }
      });
    }

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        processQueues();
        detectActiveAlarm(scheduledAlarms, handledAlarmIds).then((active) => {
          if (active) {
            navigateToAlarm(active.alarmId, active.alarmType, active.source);
          }
        });
      }
    });

    const subscription = Linking.addEventListener("url", handleUrl);
    return () => {
      subscription.remove();
      appStateSubscription.remove();
    };
  }, [scheduledAlarms]);
}

async function processAlarmUrl(url: string) {
  try {
    if (!url.includes("alarm")) return;

    // alarm-complete URL: Expo Router already navigated to /alarm-complete,
    // just process the completed queue to sync JS state
    if (url.includes("alarm-complete")) {
      await processQueues();
      return;
    }

    const urlObj = new URL(url);
    const alarmId = urlObj.searchParams.get("alarmId");
    const alarmType = urlObj.searchParams.get("alarmType") ?? "custom";
    const action = urlObj.searchParams.get("action");

    if (!alarmId) return;

    // Default: navigate to alarm screen
    navigateToAlarm(alarmId, alarmType, "deep-link");
  } catch (error) {
    alarmLog.e(
      "DeepLink",
      "Failed to handle deep link",
      error instanceof Error ? error : undefined
    );
  }
}
