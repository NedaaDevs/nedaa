import Storage from "expo-sqlite/kv-store";

import { ALARM_TIMING_CHOICES, ALARM_TIMING_MODE, ALARM_TYPE } from "@/constants/Alarm";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import type { AlarmType, AlarmTypeSettings } from "@/types/alarm";

/** Each type's modes, each paired with each offset a saved store can hold. */
export const SAVED_TIMINGS = Object.values(ALARM_TYPE).flatMap((alarmType) => {
  const { modes, minuteSteps } = ALARM_TIMING_CHOICES[alarmType];
  // A type that rings at prayer time can have zero saved in either mode.
  const offsets = modes.includes(ALARM_TIMING_MODE.AT_PRAYER_TIME)
    ? [0, ...minuteSteps]
    : minuteSteps;
  return modes.flatMap((mode) =>
    offsets.map((minutesBefore) => ({ alarmType, timing: { mode, minutesBefore } }))
  );
});

/** Loads any `saved` value as stored; returns what the store then holds. */
export const loadRawSettings = async (alarmType: AlarmType, saved: unknown) => {
  jest
    .mocked(Storage.getItem)
    .mockResolvedValueOnce(JSON.stringify({ state: { [alarmType]: saved }, version: 0 }));
  await useAlarmSettingsStore.persist.rehydrate();
  return useAlarmSettingsStore.getState()[alarmType];
};

/** Loads `saved` as stored; returns the settings the store then holds. */
export const loadSavedSettings = (alarmType: AlarmType, saved: Partial<AlarmTypeSettings>) =>
  loadRawSettings(alarmType, saved);
