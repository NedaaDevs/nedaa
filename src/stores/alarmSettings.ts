import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";

import {
  AlarmType,
  AlarmTypeSettings,
  ChallengeConfig,
  GentleWakeUpConfig,
  VibrationConfig,
  SnoozeConfig,
  TimingConfig,
  DEFAULT_ALARM_TYPE_SETTINGS,
  DEFAULT_TIMING_CONFIG,
} from "@/types/alarm";

interface AlarmSettingsState {
  fajr: AlarmTypeSettings;
  friday: AlarmTypeSettings;
}

interface AlarmSettingsActions {
  setEnabled: (alarmType: AlarmType, enabled: boolean) => void;
  setSound: (alarmType: AlarmType, sound: string) => void;
  setVolume: (alarmType: AlarmType, volume: number) => void;
  setTiming: (alarmType: AlarmType, config: TimingConfig) => void;
  setChallenge: (alarmType: AlarmType, challenge: ChallengeConfig) => void;
  setGentleWakeUp: (alarmType: AlarmType, config: GentleWakeUpConfig) => void;
  setVibration: (alarmType: AlarmType, config: VibrationConfig) => void;
  setSnooze: (alarmType: AlarmType, config: SnoozeConfig) => void;
  updateSettings: (alarmType: AlarmType, settings: Partial<AlarmTypeSettings>) => void;
  resetToDefaults: (alarmType: AlarmType) => void;
  getSettings: (alarmType: AlarmType) => AlarmTypeSettings;
}

export type AlarmSettingsStore = AlarmSettingsState & AlarmSettingsActions;

const defaultState: AlarmSettingsState = {
  fajr: { ...DEFAULT_ALARM_TYPE_SETTINGS },
  friday: {
    ...DEFAULT_ALARM_TYPE_SETTINGS,
    timing: { mode: "beforePrayerTime", minutesBefore: 30 },
  },
};

export const useAlarmSettingsStore = create<AlarmSettingsStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...defaultState,

        setEnabled: (alarmType, enabled) => {
          set((state) => ({
            [alarmType]: { ...state[alarmType], enabled },
          }));
        },

        setSound: (alarmType, sound) => {
          set((state) => ({
            [alarmType]: { ...state[alarmType], sound },
          }));
        },

        setVolume: (alarmType, volume) => {
          const clampedVolume = Math.max(0, Math.min(1, volume));
          set((state) => ({
            [alarmType]: { ...state[alarmType], volume: clampedVolume },
          }));
        },

        setTiming: (alarmType, timing) => {
          set((state) => ({
            [alarmType]: { ...state[alarmType], timing },
          }));
        },

        setChallenge: (alarmType, challenge) => {
          set((state) => ({
            [alarmType]: { ...state[alarmType], challenge },
          }));
        },

        setGentleWakeUp: (alarmType, config) => {
          set((state) => ({
            [alarmType]: { ...state[alarmType], gentleWakeUp: config },
          }));
        },

        setVibration: (alarmType, config) => {
          set((state) => ({
            [alarmType]: { ...state[alarmType], vibration: config },
          }));
        },

        setSnooze: (alarmType, config) => {
          set((state) => ({
            [alarmType]: { ...state[alarmType], snooze: config },
          }));
        },

        updateSettings: (alarmType, settings) => {
          set((state) => ({
            [alarmType]: { ...state[alarmType], ...settings },
          }));
        },

        resetToDefaults: (alarmType) => {
          set(() => ({
            [alarmType]: { ...DEFAULT_ALARM_TYPE_SETTINGS },
          }));
        },

        getSettings: (alarmType) => {
          return get()[alarmType];
        },
      }),
      {
        name: "alarm-settings-storage",
        storage: createJSONStorage(() => Storage),
        merge: (persistedState, currentState) => {
          const persisted = persistedState as AlarmSettingsState | undefined;
          if (!persisted) return currentState;

          // Ensure timing field exists with defaults for old data
          const fajrTiming = persisted.fajr?.timing ?? DEFAULT_TIMING_CONFIG;
          const fridayTiming = persisted.friday?.timing ?? {
            mode: "beforePrayerTime" as const,
            minutesBefore: 30,
          };

          return {
            ...currentState,
            fajr: {
              ...DEFAULT_ALARM_TYPE_SETTINGS,
              ...persisted.fajr,
              timing: fajrTiming,
            },
            friday: {
              ...DEFAULT_ALARM_TYPE_SETTINGS,
              ...persisted.friday,
              timing: fridayTiming,
            },
          };
        },
      }
    ),
    { name: "AlarmSettingsStore" }
  )
);
