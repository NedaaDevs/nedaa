import { useEffect, useRef } from "react";
import { Linking, AppState, Platform } from "react-native";
import { router } from "expo-router";
import * as ExpoAlarm from "expo-alarm";
import { getSnoozeQueue, clearSnoozeQueue } from "expo-alarm";
import { ScheduledAlarmType } from "@/enums/alarm";
import { ALARM_SCREEN_PATH, LIVE_ACTIVITY_STATE } from "@/constants/Alarm";
import { isAlarmLink, linkPath } from "@/utils/alarmLink";
import { useAlarmStore } from "@/stores/alarm";
import { completeAndRescheduleAlarm, waitForAlarmStores } from "@/utils/alarmScheduler";
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
    // Snoozes first: a snooze alarm completed before this drain must already
    // be in the store, or its completion cannot resolve the type.
    await processSnoozeQueue();
    await processCompletedQueue();
    pruneHandledAlarmIds();
  } finally {
    isProcessingQueues = false;
  }
}

// Process alarms completed via Android overlay
async function processCompletedQueue() {
  if (Platform.OS !== "android") return;

  try {
    // Draining clears the native queue; without hydrated alarms the type can't
    // resolve, so recurrence is lost while the evidence is consumed.
    await waitForAlarmStores();
    const queue = await ExpoAlarm.getCompletedQueue();
    if (queue.length === 0) return;

    // Clear by processed row id so a native overlay insert during these awaits
    // survives to the next drain instead of being wiped unprocessed.
    const processedIds: number[] = [];
    for (const item of queue) {
      handledAlarmIds.set(item.alarmId, Date.now());
      await completeAndRescheduleAlarm(item.alarmId, {
        alarmType: item.alarmType as ScheduledAlarmType,
        outcome: item.outcome,
      });
      processedIds.push(item.id);
    }

    await ExpoAlarm.clearCompletedQueue(processedIds);
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
    await waitForAlarmStores();
    const queue = await getSnoozeQueue();
    if (queue.length === 0) return;
    const completedIds = new Set(await ExpoAlarm.getCompletedAlarmIds());

    // Clear by processed row id so a native overlay insert during these awaits
    // survives to the next drain instead of being wiped unprocessed.
    const processedIds: number[] = [];
    for (const item of queue) {
      // Mark original alarm as handled
      handledAlarmIds.set(item.originalAlarmId, Date.now());
      // Read before the delete: the snooze is the same alarm. A replayed row
      // finds only the snooze it already wrote.
      const { scheduledAlarms } = useAlarmStore.getState();
      const original = scheduledAlarms[item.originalAlarmId] ?? scheduledAlarms[item.snoozeAlarmId];

      // Remove old alarm from store
      useAlarmStore.setState((state) => {
        const newAlarms = { ...state.scheduledAlarms };
        delete newAlarms[item.originalAlarmId];
        return { scheduledAlarms: newAlarms };
      });

      // A snooze already solved natively must not come back as scheduled.
      if (completedIds.has(item.snoozeAlarmId)) {
        processedIds.push(item.id);
        continue;
      }

      // Add new snooze alarm to store
      useAlarmStore.setState((state) => ({
        scheduledAlarms: {
          ...state.scheduledAlarms,
          [item.snoozeAlarmId]: {
            alarmId: item.snoozeAlarmId,
            alarmType: item.alarmType as ScheduledAlarmType,
            title: item.title,
            triggerTime: item.snoozeEndTime,
            liveActivityId: null,
            snoozeCount: item.snoozeCount,
            ...(original?.isPreview && { isPreview: true }),
            ...(original?.quietUsed && { quietUsed: true }),
            ...(original && {
              firstTriggerTime: original.firstTriggerTime ?? original.triggerTime,
            }),
          },
        },
      }));

      // Update Live Activity
      await ExpoAlarm.endAllLiveActivities();
      await ExpoAlarm.startLiveActivity({
        alarmId: item.snoozeAlarmId,
        alarmType: item.alarmType as ScheduledAlarmType,
        title: item.title,
        triggerDate: new Date(item.snoozeEndTime),
        state: LIVE_ACTIVITY_STATE.SNOOZED,
      });

      processedIds.push(item.id);
    }

    await clearSnoozeQueue(processedIds);
  } catch (error) {
    alarmLog.e(
      "DeepLink",
      "Failed to process snooze queue",
      error instanceof Error ? error : undefined
    );
  }
}

// Opens the alarm screen unless one is open, opened just now, or handled. The
// mounted screen sets activeAlarmId; lastNavTime blocks a second replace.
const openAlarmScreen = (alarmId: string, alarmType: string): boolean => {
  const now = Date.now();

  if (navGuard.activeAlarmId) return false;
  if (now - navGuard.lastNavTime < NAVIGATION_DEBOUNCE_MS) return false;
  if (handledAlarmIds.has(alarmId)) return false;

  navGuard.lastNavTime = now;

  router.replace({
    pathname: ALARM_SCREEN_PATH.RING,
    params: { alarmId, alarmType },
  });

  return true;
};

/** Launch, foreground and deep link: stands down where the overlay may draw. */
export const navigateToAlarm = (alarmId: string, alarmType: string, _source: string): boolean => {
  // With the overlay permission, the overlay may appear at any moment.
  if (ExpoAlarm.usesNativeOverlay()) return false;
  return openAlarmScreen(alarmId, alarmType);
};

/** A person asked for the alarm screen; stands down while the overlay runs. */
export const openAlarmOnRequest = (alarmId: string, alarmType: string): boolean => {
  if (ExpoAlarm.isOverlayShowing()) return false;
  return openAlarmScreen(alarmId, alarmType);
};

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

      Linking.getInitialURL()
        .then((url) => {
          if (url) {
            processAlarmUrl(url);
          } else {
            detectActiveAlarm(scheduledAlarms, handledAlarmIds).then((active) => {
              if (active) {
                navigateToAlarm(active.alarmId, active.alarmType, active.source);
              }
            });
          }
        })
        .catch((e) => {
          // A missed launch URL / failed detection can leave a ringing alarm undismissable.
          alarmLog.e(
            "DeepLink",
            "initial URL / active-alarm detection failed",
            e instanceof Error ? e : undefined
          );
        });
    }

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        processQueues();
        detectActiveAlarm(scheduledAlarms, handledAlarmIds)
          .then((active) => {
            if (active) {
              navigateToAlarm(active.alarmId, active.alarmType, active.source);
            }
          })
          .catch((e) => {
            alarmLog.e(
              "DeepLink",
              "active-alarm detection on foreground failed",
              e instanceof Error ? e : undefined
            );
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
    if (!isAlarmLink(url)) return;

    // alarm-complete URL: Expo Router already navigated to /alarm-complete,
    // just process the completed queue to sync JS state
    if (linkPath(url) === ALARM_SCREEN_PATH.COMPLETE) {
      await processQueues();
      return;
    }

    const urlObj = new URL(url);
    const alarmId = urlObj.searchParams.get("alarmId");
    const alarmType = urlObj.searchParams.get("alarmType") ?? ScheduledAlarmType.CUSTOM;

    if (!alarmId) return;
    // A link can outlive its alarm: a stale notification or shade clock tap.
    // A failed read opens the screen: a ringing alarm needs a way out.
    const completedIds = await ExpoAlarm.getCompletedAlarmIds().catch((e): string[] => {
      alarmLog.w("DeepLink", `getCompletedAlarmIds failed: ${e?.message ?? e}`);
      return [];
    });
    if (completedIds.includes(alarmId)) return;

    navigateToAlarm(alarmId, alarmType, "deep-link");
  } catch (error) {
    alarmLog.e(
      "DeepLink",
      "Failed to handle deep link",
      error instanceof Error ? error : undefined
    );
  }
}
