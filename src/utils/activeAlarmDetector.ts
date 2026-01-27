import * as ExpoAlarm from "expo-alarm";
import type { ScheduledAlarm } from "@/stores/alarm";

export interface ActiveAlarmInfo {
  alarmId: string;
  alarmType: string;
  title: string;
  source: "pending-challenge" | "past-due";
}

export async function detectActiveAlarm(
  scheduledAlarms: Record<string, ScheduledAlarm>
): Promise<ActiveAlarmInfo | null> {
  try {
    const pending = await ExpoAlarm.getPendingChallenge();
    if (pending) {
      return {
        alarmId: pending.alarmId,
        alarmType: pending.alarmType,
        title: pending.title,
        source: "pending-challenge",
      };
    }
  } catch {
    // native module may not be available
  }

  const now = Date.now();
  const pastDue = Object.values(scheduledAlarms).find((a) => a.triggerTime <= now);
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
