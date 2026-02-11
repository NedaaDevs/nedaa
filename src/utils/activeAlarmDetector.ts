import * as ExpoAlarm from "expo-alarm";
import type { ScheduledAlarm } from "@/stores/alarm";
import { useAlarmStore } from "@/stores/alarm";
import { ALARM_DEFAULTS } from "@/constants/Alarm";

export interface ActiveAlarmInfo {
  alarmId: string;
  alarmType: string;
  title: string;
  source: "pending-challenge" | "past-due";
}

function normalizeTimestampToMs(timestamp: number): number {
  // iOS stores timestamp in seconds (timeIntervalSince1970), JS uses milliseconds
  // If value is less than 1e12, it's in seconds and needs conversion
  return timestamp < 1e12 ? timestamp * 1000 : timestamp;
}

async function autoCompleteStaleAlarm(alarmId: string): Promise<void> {
  const { completeAlarm } = useAlarmStore.getState();
  await completeAlarm(alarmId);
  console.log(`[Alarm] Auto-completed stale alarm ${alarmId}`);
}

export async function detectActiveAlarm(
  scheduledAlarms: Record<string, ScheduledAlarm>,
  handledIds?: Set<string>,
  retryCount = 0
): Promise<ActiveAlarmInfo | null> {
  // Check completed queue first to avoid showing challenge for already-completed alarms
  const completedQueue = await ExpoAlarm.getCompletedQueue().catch(() => []);
  const completedIds = new Set(completedQueue.map((item) => item.alarmId));

  const now = Date.now();

  try {
    const pending = await ExpoAlarm.getPendingChallenge();

    if (pending && !completedIds.has(pending.alarmId) && !handledIds?.has(pending.alarmId)) {
      // Check if the pending challenge is stale (> 2 hours old)
      const pendingTimestampMs = normalizeTimestampToMs(pending.timestamp);
      const age = now - pendingTimestampMs;

      if (age > ALARM_DEFAULTS.STALE_ALARM_THRESHOLD_MS) {
        await autoCompleteStaleAlarm(pending.alarmId);
        return null;
      }

      return {
        alarmId: pending.alarmId,
        alarmType: pending.alarmType,
        title: pending.title,
        source: "pending-challenge",
      };
    }
  } catch {
    if (retryCount < 2) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return detectActiveAlarm(scheduledAlarms, handledIds, retryCount + 1);
    }
  }

  // Check past-due alarms
  for (const alarm of Object.values(scheduledAlarms)) {
    if (
      alarm.triggerTime <= now &&
      !completedIds.has(alarm.alarmId) &&
      !handledIds?.has(alarm.alarmId)
    ) {
      // Check if the past-due alarm is stale (> 2 hours old)
      const age = now - alarm.triggerTime;

      if (age > ALARM_DEFAULTS.STALE_ALARM_THRESHOLD_MS) {
        await autoCompleteStaleAlarm(alarm.alarmId);
        continue;
      }

      return {
        alarmId: alarm.alarmId,
        alarmType: alarm.alarmType,
        title: alarm.title,
        source: "past-due",
      };
    }
  }

  return null;
}
