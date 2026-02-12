import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";
import * as ExpoAlarm from "expo-alarm";
import { scheduleFajrAlarm, scheduleFridayAlarm } from "@/utils/alarmScheduler";
import { ALARM_DEFAULTS } from "@/constants/Alarm";
import { generateDeterministicUUID, getSnoozeKey } from "@/utils/alarmId";
import { AlarmLogger } from "@/utils/alarmLogger";

export interface ScheduledAlarm {
  alarmId: string;
  alarmType: "fajr" | "jummah" | "custom";
  title: string;
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
    alarmType: "fajr" | "jummah" | "custom";
    snoozeCount?: number;
  }) => Promise<boolean>;

  completeAlarm: (alarmId: string) => Promise<void>;
  snoozeAlarm: (alarmId: string, snoozeDurationMinutes?: number) => Promise<SnoozeResult | null>;
  cancelAlarm: (alarmId: string) => Promise<void>;
  cancelAlarmsByType: (alarmType: "fajr" | "jummah" | "custom") => Promise<void>;
  cancelAllAlarms: () => Promise<void>;
  getAlarm: (alarmId: string) => ScheduledAlarm | undefined;
  getAlarmByType: (alarmType: "fajr" | "jummah" | "custom") => ScheduledAlarm | undefined;
}

export const useAlarmStore = create<AlarmState>()(
  devtools(
    persist(
      (set, get) => ({
        scheduledAlarms: {},

        scheduleAlarm: async ({ id, triggerDate, title, alarmType, snoozeCount }) => {
          try {
            const success = await ExpoAlarm.scheduleAlarm({
              id,
              triggerDate,
              title,
              alarmType,
            });

            if (!success) return false;

            set((state) => ({
              scheduledAlarms: {
                ...state.scheduledAlarms,
                [id]: {
                  alarmId: id,
                  alarmType,
                  title,
                  triggerTime: triggerDate.getTime(),
                  liveActivityId: null,
                  snoozeCount: snoozeCount ?? 0,
                },
              },
            }));

            return true;
          } catch {
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

          if (!alarm) {
            AlarmLogger.w("AlarmStore", `completeAlarm: alarm ${alarmId} not found in store`);
          }

          try {
            if (alarm?.alarmType === "fajr") {
              await scheduleFajrAlarm();
            } else if (alarm?.alarmType === "jummah") {
              await scheduleFridayAlarm();
            }
          } catch (error) {
            AlarmLogger.e(
              "AlarmStore",
              "Failed to reschedule after completing alarm",
              error instanceof Error ? error : undefined
            );
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
          if (alarm.snoozeCount >= MAX_SNOOZES) return null;

          const duration = snoozeDurationMinutes ?? SNOOZE_MINUTES;
          const snoozeTime = new Date(Date.now() + duration * 60 * 1000);
          const baseTitle = alarm.title.replace(/\s*\(Snoozed \d+\/\d+\)$/, "");
          const newSnoozeCount = alarm.snoozeCount + 1;
          const snoozeId = generateDeterministicUUID(
            getSnoozeKey(alarm.alarmType, snoozeTime, newSnoozeCount)
          );
          const snoozeTitle = `${baseTitle} (Snoozed ${newSnoozeCount}/${MAX_SNOOZES})`;

          ExpoAlarm.stopAllAlarmEffects();
          await ExpoAlarm.cancelAlarm(alarmId);
          await ExpoAlarm.cancelAllBackups();
          await ExpoAlarm.clearPendingChallenge();

          await get().scheduleAlarm({
            id: snoozeId,
            triggerDate: snoozeTime,
            title: snoozeTitle,
            alarmType: alarm.alarmType,
            snoozeCount: newSnoozeCount,
          });

          // Remove the old alarm from store (new snooze alarm replaces it)
          set((state) => {
            const newAlarms = { ...state.scheduledAlarms };
            delete newAlarms[alarmId];
            return { scheduledAlarms: newAlarms };
          });

          await ExpoAlarm.endAllLiveActivities();
          await ExpoAlarm.startLiveActivity({
            alarmId: snoozeId,
            alarmType: alarm.alarmType,
            title: snoozeTitle,
            triggerDate: snoozeTime,
          });

          return {
            snoozeId,
            snoozeEndTime: snoozeTime,
            snoozeCount: newSnoozeCount,
          };
        },

        cancelAlarm: async (alarmId) => {
          await ExpoAlarm.cancelAlarm(alarmId);

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
            await ExpoAlarm.cancelAlarm(alarm.alarmId);
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
          await ExpoAlarm.cancelAllAlarms();
          await ExpoAlarm.cancelAllBackups();
          await ExpoAlarm.endAllLiveActivities();
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
      }
    ),
    { name: "alarm-store" }
  )
);
