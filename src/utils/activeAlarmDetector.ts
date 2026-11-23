import * as ExpoAlarm from "expo-alarm";
import type { ScheduledAlarm } from "@/stores/alarm";
import { completeAndRescheduleAlarm } from "@/utils/alarmScheduler";
import { ACTIVE_ALARM_SOURCE, ALARM_DEFAULTS, type ActiveAlarmSource } from "@/constants/Alarm";
import { alarmLog } from "@/utils/alarmReport";
import { runningQuietEnd } from "@/utils/emergencyQuiet";

export interface ActiveAlarmInfo {
  alarmId: string;
  alarmType: string;
  title: string;
  source: ActiveAlarmSource;
}

async function autoCompleteStaleAlarm(alarmId: string): Promise<void> {
  await completeAndRescheduleAlarm(alarmId, { outcome: ExpoAlarm.ALARM_OUTCOME.ABANDONED });
  alarmLog.i("Detector", `auto-completed stale alarm ${alarmId}`);
}

// An alarm the Android service still rings never ends by age. Same rule as
// PendingChallengeRule; stale-rule.tsv pins both.
export const endsByAge = (alarmId: string, ageMs: number, ringingAlarmId: string | null) =>
  alarmId !== ringingAlarmId && ageMs > ALARM_DEFAULTS.STALE_ALARM_THRESHOLD_MS;

export async function detectActiveAlarm(
  scheduledAlarms: Record<string, ScheduledAlarm>,
  handledIds?: { has(id: string): boolean },
  retryCount = 0
): Promise<ActiveAlarmInfo | null> {
  // Check completed alarms first to avoid showing challenge for already-completed alarms
  const completedIds = new Set(
    await ExpoAlarm.getCompletedAlarmIds().catch((e) => {
      // Empty fallback risks re-showing a challenge for an already-completed alarm.
      alarmLog.w("Detector", `getCompletedAlarmIds failed: ${e?.message ?? e}`);
      return [];
    })
  );

  const now = Date.now();
  // Android only; iOS reads null and an empty list, so only age decides.
  const futureIds = new Set(await ExpoAlarm.getFutureAlarmIds());
  // The ringing id is read at each decision: a ring can start during any await,
  // and a ringing alarm is not waiting for later whatever the list said.
  const waitsForLater = (alarmId: string): boolean =>
    futureIds.has(alarmId) && ExpoAlarm.getRingingAlarmId() !== alarmId;
  // An alarm native re-armed for later keeps its first times, so its age says nothing.
  const endsNow = (alarmId: string, ageMs: number): boolean =>
    !waitsForLater(alarmId) && endsByAge(alarmId, ageMs, ExpoAlarm.getRingingAlarmId());

  try {
    const pending = await ExpoAlarm.getPendingChallenge();

    if (pending && !completedIds.has(pending.alarmId) && !handledIds?.has(pending.alarmId)) {
      if (endsNow(pending.alarmId, now - pending.timestamp)) {
        await autoCompleteStaleAlarm(pending.alarmId);
        return null;
      }

      return {
        alarmId: pending.alarmId,
        alarmType: pending.alarmType,
        title: pending.title,
        source: ACTIVE_ALARM_SOURCE.PENDING_CHALLENGE,
      };
    }
  } catch (e) {
    if (retryCount < 2) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return detectActiveAlarm(scheduledAlarms, handledIds, retryCount + 1);
    }
    // Exhausted retries — this is the "can't detect a firing alarm" failure mode
    // the detector exists to catch, so it must be recorded, not swallowed.
    alarmLog.e(
      "Detector",
      `getPendingChallenge failed after retries: ${(e as Error)?.message ?? e}`
    );
  }

  // A quiet's re-ring is the quieted alarm, its task still owed.
  for (const alarm of Object.values(scheduledAlarms)) {
    if (
      runningQuietEnd(alarm, now) !== null &&
      !completedIds.has(alarm.alarmId) &&
      !handledIds?.has(alarm.alarmId)
    ) {
      return {
        alarmId: alarm.alarmId,
        alarmType: alarm.alarmType,
        title: alarm.title,
        source: ACTIVE_ALARM_SOURCE.QUIET,
      };
    }
  }

  // Check past-due alarms
  for (const alarm of Object.values(scheduledAlarms)) {
    if (
      alarm.triggerTime <= now &&
      // Native re-armed it for later; the store keeps the first trigger time.
      !waitsForLater(alarm.alarmId) &&
      !completedIds.has(alarm.alarmId) &&
      !handledIds?.has(alarm.alarmId)
    ) {
      if (endsNow(alarm.alarmId, now - alarm.triggerTime)) {
        await autoCompleteStaleAlarm(alarm.alarmId);
        continue;
      }

      return {
        alarmId: alarm.alarmId,
        alarmType: alarm.alarmType,
        title: alarm.title,
        source: ACTIVE_ALARM_SOURCE.PAST_DUE,
      };
    }
  }

  return null;
}
