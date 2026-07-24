import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";
import * as ExpoAlarm from "expo-alarm";
import i18next from "@/localization/i18n";
import { ScheduledAlarmType } from "@/enums/alarm";
import { ALARM_DEFAULTS } from "@/constants/Alarm";
import { generateDeterministicUUID, getSnoozeKey } from "@/utils/alarmId";
import { toSettingsAlarmType } from "@/utils/alarmTypes";
import { alarmLog } from "@/utils/alarmReport";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";

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
}

export interface SnoozeResult {
  snoozeId: string;
  snoozeEndTime: Date;
  snoozeCount: number;
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
    countdown?: boolean;
  }) => Promise<boolean>;

  completeAlarm: (alarmId: string) => Promise<void>;
  snoozeAlarm: (alarmId: string, snoozeDurationMinutes?: number) => Promise<SnoozeResult | null>;
  cancelAlarm: (alarmId: string) => Promise<void>;
  cancelAlarmsByType: (alarmType: ScheduledAlarmType) => Promise<void>;
  cancelAllAlarms: () => Promise<void>;
  getAlarm: (alarmId: string) => ScheduledAlarm | undefined;
  getAlarmByType: (alarmType: ScheduledAlarmType) => ScheduledAlarm | undefined;
}

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

          ExpoAlarm.stopAllAlarmEffects();
          await ExpoAlarm.cancelAllBackups();
          await ExpoAlarm.clearPendingChallenge();
          await ExpoAlarm.cancelAlarm(alarmId);
          await ExpoAlarm.endAllLiveActivities();
          ExpoAlarm.markAlarmCompleted(alarmId);

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
          await ExpoAlarm.cancelAlarm(alarmId);
          await ExpoAlarm.cancelAllBackups();
          await ExpoAlarm.clearPendingChallenge();

          const rescheduled = await get().scheduleAlarm({
            id: snoozeId,
            triggerDate: snoozeTime,
            title: snoozeTitle,
            alarmType: alarm.alarmType,
            snoozeCount: newSnoozeCount,
            baseTitle,
          });
          if (!rescheduled) {
            // Reschedule refused: keep the original store record so past-due detection
            // can still surface it. Returning null shows no snooze countdown in the UI.
            alarmLog.e(
              "Store",
              `snooze: rescheduling ${alarm.alarmType} failed — keeping original alarm ${alarmId}`
            );
            return null;
          }

          // Remove the old alarm from store (new snooze alarm replaces it)
          set((state) => {
            const newAlarms = { ...state.scheduledAlarms };
            delete newAlarms[alarmId];
            return { scheduledAlarms: newAlarms };
          });

          try {
            await ExpoAlarm.endAllLiveActivities();
            await ExpoAlarm.startLiveActivity({
              alarmId: snoozeId,
              alarmType: alarm.alarmType,
              title: snoozeTitle,
              triggerDate: snoozeTime,
              state: "snoozed",
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

        cancelAlarm: async (alarmId) => {
          try {
            await ExpoAlarm.cancelAlarm(alarmId);
            ExpoAlarm.deleteAlarmFromDB(alarmId);
          } catch (error) {
            alarmLog.e("Store", `cancelAlarm: native cancel failed for ${alarmId}`, error as Error);
          }

          set((state) => {
            const newAlarms = { ...state.scheduledAlarms };
            delete newAlarms[alarmId];
            return { scheduledAlarms: newAlarms };
          });
        },

        cancelAlarmsByType: async (alarmType) => {
          const { scheduledAlarms } = get();
          const toCancel = Object.values(scheduledAlarms).filter(
            (alarm) => alarm.alarmType === alarmType
          );

          for (const alarm of toCancel) {
            try {
              await ExpoAlarm.cancelAlarm(alarm.alarmId);
              ExpoAlarm.deleteAlarmFromDB(alarm.alarmId);
            } catch (error) {
              alarmLog.e(
                "Store",
                `cancelAlarmsByType: native cancel failed for ${alarm.alarmId} (${alarmType})`,
                error as Error
              );
            }
          }

          set((state) => {
            const newAlarms = { ...state.scheduledAlarms };
            for (const alarm of toCancel) {
              delete newAlarms[alarm.alarmId];
            }
            return { scheduledAlarms: newAlarms };
          });
        },

        cancelAllAlarms: async () => {
          try {
            await ExpoAlarm.cancelAllAlarms();
            await ExpoAlarm.cancelAllBackups();
            await ExpoAlarm.endAllLiveActivities();
          } catch (error) {
            alarmLog.e("Store", "cancelAllAlarms: native cancel failed", error as Error);
          }
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
