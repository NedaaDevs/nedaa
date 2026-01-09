import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";
import * as ExpoAlarm from "expo-alarm";

export interface ScheduledAlarm {
  alarmId: string;
  alarmType: "fajr" | "jummah" | "custom";
  title: string;
  triggerTime: number;
  liveActivityId: string | null;
}

interface AlarmState {
  scheduledAlarms: Record<string, ScheduledAlarm>;

  scheduleAlarm: (params: {
    id: string;
    triggerDate: Date;
    title: string;
    alarmType: "fajr" | "jummah" | "custom";
  }) => Promise<boolean>;

  completeAlarm: (alarmId: string) => Promise<void>;
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

        scheduleAlarm: async ({ id, triggerDate, title, alarmType }) => {
          try {
            const success = await ExpoAlarm.scheduleAlarm({
              id,
              triggerDate,
              title,
              alarmType,
            });

            if (!success) return false;

            // Start Live Activity
            let liveActivityId: string | null = null;
            try {
              liveActivityId = await ExpoAlarm.startLiveActivity({
                alarmId: id,
                alarmType,
                title,
                triggerDate,
              });
            } catch {
              // Live Activity not available
            }

            set((state) => ({
              scheduledAlarms: {
                ...state.scheduledAlarms,
                [id]: {
                  alarmId: id,
                  alarmType,
                  title,
                  triggerTime: triggerDate.getTime(),
                  liveActivityId,
                },
              },
            }));

            return true;
          } catch (error) {
            console.error(`[Alarm] Schedule error:`, error);
            return false;
          }
        },

        completeAlarm: async (alarmId) => {
          const { scheduledAlarms } = get();
          const alarm = scheduledAlarms[alarmId];

          ExpoAlarm.markAlarmCompleted(alarmId);

          if (alarm?.liveActivityId) {
            await ExpoAlarm.endLiveActivity(alarm.liveActivityId);
          }

          set((state) => {
            const newAlarms = { ...state.scheduledAlarms };
            delete newAlarms[alarmId];
            return { scheduledAlarms: newAlarms };
          });
        },

        cancelAlarm: async (alarmId) => {
          const { scheduledAlarms } = get();
          const alarm = scheduledAlarms[alarmId];

          await ExpoAlarm.cancelAlarm(alarmId);

          if (alarm?.liveActivityId) {
            await ExpoAlarm.endLiveActivity(alarm.liveActivityId);
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
            await ExpoAlarm.cancelAlarm(alarm.alarmId);
            if (alarm.liveActivityId) {
              await ExpoAlarm.endLiveActivity(alarm.liveActivityId);
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
          const { scheduledAlarms } = get();

          for (const alarm of Object.values(scheduledAlarms)) {
            await ExpoAlarm.cancelAlarm(alarm.alarmId);
            if (alarm.liveActivityId) {
              await ExpoAlarm.endLiveActivity(alarm.liveActivityId);
            }
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
      }
    ),
    { name: "alarm-store" }
  )
);
