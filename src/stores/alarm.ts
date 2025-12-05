import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";

// Types
import type { AlarmStoreState, AlarmStoreActions } from "@/types/alarm";
import { DEFAULT_FAJR_ALARM_SETTINGS, DEFAULT_JUMMAH_ALARM_SETTINGS } from "@/types/alarm";

// Services
import { alarmScheduler } from "@/services/alarm/alarmScheduler";

// Store type
export type AlarmStore = AlarmStoreState & AlarmStoreActions;

// Default state
const defaultState: AlarmStoreState = {
  fajrAlarm: DEFAULT_FAJR_ALARM_SETTINGS,
  jummahAlarm: DEFAULT_JUMMAH_ALARM_SETTINGS,
  scheduledFajrAlarmId: null,
  scheduledJummahAlarmId: null,
  nextFajrAlarmTime: null,
  nextJummahAlarmTime: null,
  lastScheduledDate: null,
};

export const useAlarmStore = create<AlarmStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...defaultState,
        setFajrAlarmEnabled: async (enabled) => {
          set((state) => ({
            fajrAlarm: { ...state.fajrAlarm, enabled },
          }));
          await get().scheduleAllAlarms();
        },

        updateFajrAlarmSettings: async (settings) => {
          const previousSettings = get().fajrAlarm;
          set((state) => ({
            fajrAlarm: { ...state.fajrAlarm, ...settings },
          }));

          // Reschedule if alarm is enabled
          if (get().fajrAlarm.enabled) {
            const result = await get().scheduleAllAlarms();
            // Revert settings if scheduling failed
            if (!result.fajrSuccess && result.fajrError) {
              console.error("[AlarmStore] Reverting Fajr settings due to error:", result.fajrError);
              set({ fajrAlarm: previousSettings });
              throw new Error(result.fajrError);
            }
          }
        },

        setJummahAlarmEnabled: async (enabled) => {
          set((state) => ({
            jummahAlarm: { ...state.jummahAlarm, enabled },
          }));
          await get().scheduleAllAlarms();
        },

        updateJummahAlarmSettings: async (settings) => {
          const previousSettings = get().jummahAlarm;
          set((state) => ({
            jummahAlarm: { ...state.jummahAlarm, ...settings },
          }));

          // Reschedule if alarm is enabled
          if (get().jummahAlarm.enabled) {
            const result = await get().scheduleAllAlarms();
            // Revert settings if scheduling failed
            if (!result.jummahSuccess && result.jummahError) {
              console.error(
                "[AlarmStore] Reverting Jummah settings due to error:",
                result.jummahError
              );
              set({ jummahAlarm: previousSettings });
              throw new Error(result.jummahError);
            }
          }
        },

        markSetupCompleted: (type) => {
          if (type === "fajr") {
            set((state) => ({
              fajrAlarm: { ...state.fajrAlarm, hasCompletedSetup: true },
            }));
          } else {
            set((state) => ({
              jummahAlarm: { ...state.jummahAlarm, hasCompletedSetup: true },
            }));
          }
        },

        scheduleAllAlarms: async () => {
          const { fajrAlarm, jummahAlarm } = get();

          console.log("[AlarmStore] Scheduling all enabled alarms...");

          // Cancel existing alarms first
          await alarmScheduler.cancelAllAlarms();

          let fajrSuccess = true;
          let fajrError: string | undefined;
          let jummahSuccess = true;
          let jummahError: string | undefined;

          if (fajrAlarm.enabled) {
            console.log("[AlarmStore] Fajr alarm enabled, scheduling...");
            const result = await alarmScheduler.scheduleFajrAlarm(fajrAlarm);
            if (result.success && result.alarmId) {
              set({
                scheduledFajrAlarmId: result.alarmId,
                nextFajrAlarmTime: result.scheduledTime?.toISOString() ?? null,
              });
              console.log(
                "[AlarmStore] Fajr alarm scheduled:",
                result.scheduledTime?.toISOString()
              );
            } else {
              fajrSuccess = false;
              fajrError = result.error;
              set({ nextFajrAlarmTime: null });
              console.warn("[AlarmStore] Failed to schedule Fajr alarm:", result.error);
            }
          } else {
            set({ nextFajrAlarmTime: null });
          }

          if (jummahAlarm.enabled) {
            console.log("[AlarmStore] Jummah alarm enabled, scheduling...");
            const result = await alarmScheduler.scheduleJummahAlarm(jummahAlarm);
            if (result.success && result.alarmId) {
              set({
                scheduledJummahAlarmId: result.alarmId,
                nextJummahAlarmTime: result.scheduledTime?.toISOString() ?? null,
              });
              console.log(
                "[AlarmStore] Jummah alarm scheduled:",
                result.scheduledTime?.toISOString()
              );
            } else {
              jummahSuccess = false;
              jummahError = result.error;
              set({ nextJummahAlarmTime: null });
              console.warn("[AlarmStore] Failed to schedule Jummah alarm:", result.error);
            }
          } else {
            set({ nextJummahAlarmTime: null });
          }

          set({ lastScheduledDate: new Date().toISOString() });

          return { fajrSuccess, fajrError, jummahSuccess, jummahError };
        },

        rescheduleIfNeeded: async (force = false) => {
          const { lastScheduledDate, fajrAlarm, jummahAlarm } = get();

          // Check if any alarm is enabled
          if (!fajrAlarm.enabled && !jummahAlarm.enabled) {
            return;
          }

          // Check if we need to reschedule
          if (!force && lastScheduledDate) {
            const lastScheduled = new Date(lastScheduledDate);
            const now = new Date();

            // Only reschedule if it's been more than 12 hours or it's a new day
            const hoursSinceLastSchedule =
              (now.getTime() - lastScheduled.getTime()) / (1000 * 60 * 60);

            if (hoursSinceLastSchedule < 12 && lastScheduled.getDate() === now.getDate()) {
              console.log("[AlarmStore] No reschedule needed");
              return;
            }
          }

          console.log("[AlarmStore] Rescheduling alarms...");
          await get().scheduleAllAlarms();
        },
      }),
      {
        name: "alarm-storage",
        storage: createJSONStorage(() => Storage),
        partialize: (state) => ({
          fajrAlarm: state.fajrAlarm,
          jummahAlarm: state.jummahAlarm,
          scheduledFajrAlarmId: state.scheduledFajrAlarmId,
          scheduledJummahAlarmId: state.scheduledJummahAlarmId,
          nextFajrAlarmTime: state.nextFajrAlarmTime,
          nextJummahAlarmTime: state.nextJummahAlarmTime,
          lastScheduledDate: state.lastScheduledDate,
        }),
        onRehydrateStorage: () => (state) => {
          if (!state) return;
          console.log("[AlarmStore] Rehydrated from storage");
        },
      }
    ),
    { name: "AlarmStore" }
  )
);
