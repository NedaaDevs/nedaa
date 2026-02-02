import * as ExpoAlarm from "expo-alarm";
import type { ScheduledAlarm } from "@/stores/alarm";

export interface ActiveAlarmInfo {
  alarmId: string;
  alarmType: string;
  title: string;
  source: "pending-challenge" | "past-due";
}

export async function detectActiveAlarm(
  scheduledAlarms: Record<string, ScheduledAlarm>,
  handledIds?: Set<string>,
  retryCount = 0
): Promise<ActiveAlarmInfo | null> {
  // Check completed queue first to avoid showing challenge for already-completed alarms
  const completedQueue = await ExpoAlarm.getCompletedQueue().catch(() => []);
  const completedIds = new Set(completedQueue.map((item) => item.alarmId));

  try {
    const pending = await ExpoAlarm.getPendingChallenge();

    if (pending && !completedIds.has(pending.alarmId) && !handledIds?.has(pending.alarmId)) {
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

  const now = Date.now();
  const pastDue = Object.values(scheduledAlarms).find(
    (a) => a.triggerTime <= now && !completedIds.has(a.alarmId) && !handledIds?.has(a.alarmId)
  );
  if (pastDue) {
    return {
      alarmId: pastDue.alarmId,
      alarmType: pastDue.alarmType,
      title: pastDue.title,
      source: "past-due",
    };
  }

  return null;
}
