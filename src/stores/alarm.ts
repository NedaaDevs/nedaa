import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";
import * as ExpoAlarm from "expo-alarm";
import i18next from "@/localization/i18n";
import { ScheduledAlarmType } from "@/enums/alarm";
import { ALARM_DEFAULTS, LIVE_ACTIVITY_STATE } from "@/constants/Alarm";
import { generateDeterministicUUID, getQuietKey, getSnoozeKey } from "@/utils/alarmId";
import { toSettingsAlarmType } from "@/utils/alarmTypes";
import { alarmLog } from "@/utils/alarmReport";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { FIRED_LEDGER } from "@/constants/FiredPrayerGuard";
import { forgetBooking, forgetUnfired } from "@/services/firedPrayerLedger";
import { runningQuietEnd } from "@/utils/emergencyQuiet";

export interface ScheduledAlarm {
  alarmId: string;
  alarmType: ScheduledAlarmType;
  title: string;
  // Original (unsuffixed) title, carried across snoozes; the snoozed-count
  // suffix is rebuilt from i18n on top of it each time.
  baseTitle?: string;
  triggerTime: number;
  liveActivityId: string | null;
  snoozeCount: number;
  // A settings preview; solving it is not a wake-up.
  isPreview?: boolean;
  // Emergency quiet was used for this alarm; its snoozes count as the same alarm.
  quietUsed?: boolean;
  // The first ring's trigger, kept by the snoozes and quiet that replace it.
  firstTriggerTime?: number;
}

// Whatever the cancel reports, forgotten from its start time: a kept entry
// can drop the moved alarm, a forgotten one only lets a second alarm ring.
const forgetCancelled = (alarm: ScheduledAlarm, startedAt: number): void =>
  forgetBooking(FIRED_LEDGER.ALARMS, { key: alarm.alarmType, at: alarm.triggerTime }, startedAt);

export interface SnoozeResult {
  snoozeId: string;
  snoozeEndTime: Date;
  snoozeCount: number;
}

export interface QuietResult {
  quietId: string;
  ringsAt: Date;
}

/** An emergency quiet's steps the caller owns, run in the store's order. */
export interface QuietSteps {
  ringsAt: Date;
  /** Counts the use; a throw keeps the alarm ringing with nothing counted. */
  recordUse: () => void;
  /** Silences what the caller plays, such as a JS vibration. */
  silence: () => void;
}

interface AlarmState {
  scheduledAlarms: Record<string, ScheduledAlarm>;

  scheduleAlarm: (params: {
    id: string;
    triggerDate: Date;
    title: string;
    alarmType: ScheduledAlarmType;
    snoozeCount?: number;
    baseTitle?: string;
    isPreview?: boolean;
    quietUsed?: boolean;
    firstTriggerTime?: number;
    countdown?: boolean;
  }) => Promise<boolean>;

  completeAlarm: (alarmId: string) => Promise<void>;
  snoozeAlarm: (alarmId: string, snoozeDurationMinutes?: number) => Promise<SnoozeResult | null>;
  /** Arms the re-ring, counts the use, then silences; null leaves it ringing. */
  quietAlarm: (alarmId: string, steps: QuietSteps) => Promise<QuietResult | null>;
  cancelAlarm: (alarmId: string) => Promise<void>;
  // Skips ids with no record. False when an alarm could not be cancelled;
  // its record is kept.
  cancelAlarms: (alarmIds: readonly string[]) => Promise<boolean>;
  // False when an alarm could not be cancelled; its records are kept. A
  // running quiet's re-ring is kept: only its task ends it.
  cancelAlarmsByType: (alarmType: ScheduledAlarmType) => Promise<boolean>;
  cancelAllAlarms: () => Promise<void>;
  getAlarm: (alarmId: string) => ScheduledAlarm | undefined;
  getAlarmByType: (alarmType: ScheduledAlarmType) => ScheduledAlarm | undefined;
}

// A replaced alarm, once its replacement is armed. Completed before the
// cancel, so its reported dismissal cannot re-arm it. A failed step is logged
// and the rest still run.
const retireReplaced = async (alarmId: string): Promise<void> => {
  const steps = [
    () => ExpoAlarm.markAlarmCompleted(alarmId),
    () => ExpoAlarm.clearPendingChallenge(),
    () => ExpoAlarm.cancelAlarm(alarmId),
    () => ExpoAlarm.cancelAllBackups(),
  ];
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      alarmLog.e("Store", `retiring ${alarmId}: a native step failed`, error as Error);
    }
  }
  useAlarmStore.setState((state) => {
    const newAlarms = { ...state.scheduledAlarms };
    delete newAlarms[alarmId];
    return { scheduledAlarms: newAlarms };
  });
};

export const useAlarmStore = create<AlarmState>()(
  devtools(
    persist(
      (set, get) => ({
        scheduledAlarms: {},

        scheduleAlarm: async ({
          id,
          triggerDate,
          title,
          alarmType,
          snoozeCount,
          baseTitle,
          countdown,
          isPreview,
          quietUsed,
          firstTriggerTime,
        }) => {
          try {
            const success = await ExpoAlarm.scheduleAlarm({
              id,
              triggerDate,
              title,
              alarmType,
              countdown,
            });

            if (!success) {
              alarmLog.e(
                "Store",
                `scheduleAlarm: native refused ${alarmType} for ${triggerDate.toISOString()}`
              );
              return false;
            }
            alarmLog.i("Store", `scheduled ${alarmType} at ${triggerDate.toISOString()}`);

            set((state) => ({
              scheduledAlarms: {
                ...state.scheduledAlarms,
                [id]: {
                  alarmId: id,
                  alarmType,
                  title,
                  baseTitle: baseTitle ?? title,
                  triggerTime: triggerDate.getTime(),
                  liveActivityId: null,
                  snoozeCount: snoozeCount ?? 0,
                  ...(isPreview && { isPreview }),
                  ...(quietUsed && { quietUsed }),
                  ...(firstTriggerTime !== undefined && { firstTriggerTime }),
                },
              },
            }));

            return true;
          } catch (error) {
            alarmLog.e(
              "Store",
              `scheduleAlarm: ${alarmType} for ${triggerDate.toISOString()} threw`,
              error as Error
            );
            return false;
          }
        },

        completeAlarm: async (alarmId) => {
          const alarm = get().scheduledAlarms[alarmId];

          // Sound, backups, the challenge and the Live Activity are global native
          // state; they belong to this alarm only when its challenge is the open one.
          // A queued completion of an older alarm must not silence the current one.
          const pending = await ExpoAlarm.getPendingChallenge();
          const ownsAlarmState = !pending || pending.alarmId === alarmId;

          // AlarmKit reports each cancel below as a dismissal; the observer must
          // already see the alarm completed, or it re-arms bypass protection.
          if (ownsAlarmState) ExpoAlarm.stopAllAlarmEffects();
          ExpoAlarm.markAlarmCompleted(alarmId);
          if (ownsAlarmState) {
            await ExpoAlarm.clearPendingChallenge();
            await ExpoAlarm.cancelAllBackups();
          }
          await ExpoAlarm.cancelAlarm(alarmId);
          if (ownsAlarmState) await ExpoAlarm.endAllLiveActivities();

          if (alarm) {
            alarmLog.i("Store", `completed ${alarm.alarmType} alarm ${alarmId}`);
          } else {
            alarmLog.w("Store", `completeAlarm: alarm ${alarmId} not found in store`);
          }

          set((state) => {
            const newAlarms = { ...state.scheduledAlarms };
            delete newAlarms[alarmId];
            return { scheduledAlarms: newAlarms };
          });
        },

        snoozeAlarm: async (alarmId, snoozeDurationMinutes) => {
          const alarm = get().scheduledAlarms[alarmId];
          if (!alarm) return null;

          const { MAX_SNOOZES, SNOOZE_MINUTES } = ALARM_DEFAULTS;
          // The snooze cap is the user's per-type setting; the UI offers Snooze from
          // the same value, so gate and display must both read it.
          const settingsType = toSettingsAlarmType(alarm.alarmType);
          const maxSnoozes = settingsType
            ? useAlarmSettingsStore.getState()[settingsType].snooze.maxCount
            : MAX_SNOOZES;
          if (alarm.snoozeCount >= maxSnoozes) return null;

          const duration = snoozeDurationMinutes ?? SNOOZE_MINUTES;
          const snoozeTime = new Date(Date.now() + duration * 60 * 1000);
          const baseTitle = alarm.baseTitle ?? alarm.title;
          const newSnoozeCount = alarm.snoozeCount + 1;
          const snoozeId = generateDeterministicUUID(
            getSnoozeKey(alarm.alarmType, snoozeTime, newSnoozeCount)
          );
          const snoozeTitle = i18next.t("alarm.snoozedTitle", {
            title: baseTitle,
            count: newSnoozeCount,
            max: maxSnoozes,
          });

          ExpoAlarm.stopAllAlarmEffects();

          // The replacement is secured before the original is touched, so a
          // failed snooze leaves the original armed and its challenge open.
          const rescheduled = await get().scheduleAlarm({
            id: snoozeId,
            triggerDate: snoozeTime,
            title: snoozeTitle,
            alarmType: alarm.alarmType,
            snoozeCount: newSnoozeCount,
            baseTitle,
            isPreview: alarm.isPreview,
            quietUsed: alarm.quietUsed,
            firstTriggerTime: alarm.firstTriggerTime ?? alarm.triggerTime,
          });
          if (!rescheduled) {
            alarmLog.e(
              "Store",
              `snooze: rescheduling ${alarm.alarmType} failed — keeping original alarm ${alarmId}`
            );
            return null;
          }

          await retireReplaced(alarmId);

          try {
            await ExpoAlarm.endAllLiveActivities();
            await ExpoAlarm.startLiveActivity({
              alarmId: snoozeId,
              alarmType: alarm.alarmType,
              title: snoozeTitle,
              triggerDate: snoozeTime,
              state: LIVE_ACTIVITY_STATE.SNOOZED,
            });
          } catch (error) {
            // Cosmetic (lock-screen countdown) — the snooze alarm itself is scheduled.
            alarmLog.w("Store", `snooze: live activity failed: ${(error as Error).message}`);
          }

          alarmLog.i(
            "Store",
            `snoozed ${alarm.alarmType} ${newSnoozeCount}/${maxSnoozes} until ${snoozeTime.toISOString()}`
          );

          return {
            snoozeId,
            snoozeEndTime: snoozeTime,
            snoozeCount: newSnoozeCount,
          };
        },

        quietAlarm: async (alarmId, { ringsAt, recordUse, silence }) => {
          const alarm = get().scheduledAlarms[alarmId];
          if (!alarm) return null;

          const quietId = generateDeterministicUUID(getQuietKey(alarm.alarmType, ringsAt));
          const armed = await get().scheduleAlarm({
            id: quietId,
            triggerDate: ringsAt,
            title: alarm.title,
            alarmType: alarm.alarmType,
            snoozeCount: alarm.snoozeCount,
            baseTitle: alarm.baseTitle,
            isPreview: alarm.isPreview,
            quietUsed: true,
            firstTriggerTime: alarm.firstTriggerTime ?? alarm.triggerTime,
          });
          if (!armed) {
            alarmLog.e(
              "Store",
              `quiet: arming ${alarm.alarmType} failed — still ringing ${alarmId}`
            );
            return null;
          }

          try {
            recordUse();
          } catch (error) {
            alarmLog.e(
              "Store",
              `quiet: use not counted — still ringing ${alarmId}`,
              error as Error
            );
            await get().cancelAlarm(quietId);
            return null;
          }

          // The use is counted, so a failure past here is logged, not undone.
          try {
            silence();
            ExpoAlarm.stopAllAlarmEffects();
            await retireReplaced(alarmId);
          } catch (error) {
            alarmLog.e("Store", `quiet: retiring ${alarmId} failed`, error as Error);
          }

          try {
            await ExpoAlarm.endAllLiveActivities();
            await ExpoAlarm.startLiveActivity({
              alarmId: quietId,
              alarmType: alarm.alarmType,
              title: alarm.title,
              triggerDate: ringsAt,
              state: LIVE_ACTIVITY_STATE.COUNTDOWN,
            });
          } catch (error) {
            // Cosmetic (lock-screen countdown) — the re-ring itself is armed.
            alarmLog.w("Store", `quiet: live activity failed: ${(error as Error).message}`);
          }

          alarmLog.i("Store", `quieted ${alarm.alarmType} until ${ringsAt.toISOString()}`);
          return { quietId, ringsAt };
        },

        cancelAlarm: async (alarmId) => {
          const alarm = get().scheduledAlarms[alarmId];
          const startedAt = Date.now();
          try {
            await ExpoAlarm.cancelAlarm(alarmId);
            ExpoAlarm.deleteAlarmFromDB(alarmId);
          } catch (error) {
            alarmLog.e("Store", `cancelAlarm: native cancel failed for ${alarmId}`, error as Error);
          }
          if (alarm) forgetCancelled(alarm, startedAt);

          set((state) => {
            const newAlarms = { ...state.scheduledAlarms };
            delete newAlarms[alarmId];
            return { scheduledAlarms: newAlarms };
          });
        },

        cancelAlarms: async (alarmIds) => {
          const { scheduledAlarms } = get();
          const toCancel = alarmIds.flatMap((alarmId) => {
            const alarm = scheduledAlarms[alarmId];
            return alarm ? [alarm] : [];
          });

          const cancelledIds: string[] = [];
          const startedAt = Date.now();
          for (const alarm of toCancel) {
            try {
              if (await ExpoAlarm.cancelAlarm(alarm.alarmId)) {
                ExpoAlarm.deleteAlarmFromDB(alarm.alarmId);
                cancelledIds.push(alarm.alarmId);
              } else {
                alarmLog.e("Store", `cancelAlarms: native refused ${alarm.alarmId}`);
              }
            } catch (error) {
              alarmLog.e(
                "Store",
                `cancelAlarms: native cancel failed for ${alarm.alarmId} (${alarm.alarmType})`,
                error as Error
              );
            }
            forgetCancelled(alarm, startedAt);
          }

          set((state) => {
            const newAlarms = { ...state.scheduledAlarms };
            for (const alarmId of cancelledIds) {
              delete newAlarms[alarmId];
            }
            return { scheduledAlarms: newAlarms };
          });
          return cancelledIds.length === toCancel.length;
        },

        cancelAlarmsByType: (alarmType) => {
          const now = Date.now();
          return get().cancelAlarms(
            Object.values(get().scheduledAlarms)
              .filter(
                (alarm) => alarm.alarmType === alarmType && runningQuietEnd(alarm, now) === null
              )
              .map((alarm) => alarm.alarmId)
          );
        },

        cancelAllAlarms: async () => {
          const startedAt = Date.now();
          try {
            await ExpoAlarm.cancelAllAlarms();
            await ExpoAlarm.cancelAllBackups();
            await ExpoAlarm.endAllLiveActivities();
          } catch (error) {
            alarmLog.e("Store", "cancelAllAlarms: native cancel failed", error as Error);
          }
          // Whatever the native cancel reports, as for a single alarm.
          forgetUnfired(FIRED_LEDGER.ALARMS, startedAt);
          set({ scheduledAlarms: {} });
        },

        getAlarm: (alarmId) => get().scheduledAlarms[alarmId],

        getAlarmByType: (alarmType) => {
          const { scheduledAlarms } = get();
          return Object.values(scheduledAlarms).find((alarm) => alarm.alarmType === alarmType);
        },
      }),
      {
        name: "alarm-storage",
        storage: createJSONStorage(() => Storage),
        merge: (persisted, current) => ({
          ...current,
          ...(persisted as object),
        }),
      }
    ),
    { name: "alarm-store" }
  )
);
