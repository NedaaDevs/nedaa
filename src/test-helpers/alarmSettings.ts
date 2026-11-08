import Storage from "expo-sqlite/kv-store";

import { ALARM_TIMING_CHOICES, ALARM_TYPE } from "@/constants/Alarm";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import type { AlarmType, AlarmTypeSettings } from "@/types/alarm";

/** Each type's modes, each paired with each of its minute steps. */
export const SAVED_TIMINGS = Object.values(ALARM_TYPE).flatMap((alarmType) => {
  const { modes, minuteSteps } = ALARM_TIMING_CHOICES[alarmType];
  return modes.flatMap((mode) =>
    minuteSteps.map((minutesBefore) => ({ alarmType, timing: { mode, minutesBefore } }))
  );
});

/** Loads `saved` as stored; returns the settings the store then holds. */
export const loadSavedSettings = async (
  alarmType: AlarmType,
  saved: Partial<AlarmTypeSettings>
) => {
  jest
    .mocked(Storage.getItem)
    .mockResolvedValueOnce(JSON.stringify({ state: { [alarmType]: saved }, version: 0 }));
  await useAlarmSettingsStore.persist.rehydrate();
  return useAlarmSettingsStore.getState()[alarmType];
};
