import { Platform } from "react-native";
import * as ExpoAlarm from "expo-alarm";

import { ALARM_TYPE } from "@/constants/Alarm";
import { PlatformType } from "@/enums/app";
import { useAlarmStore } from "@/stores/alarm";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import type { AlarmType, AlarmTypeSettings } from "@/types/alarm";
import { alarmLog } from "@/utils/alarmReport";
import { scheduleFajrAlarm, scheduleFridayAlarm } from "@/utils/alarmScheduler";
import { toScheduledAlarmType } from "@/utils/alarmTypes";
import { createAsyncLock, type AsyncLock } from "@/utils/asyncLock";
import { getNativeSoundName } from "@/utils/nativeSoundName";

/** A settings change; switching the alarm on or off is setEnabled's. */
export type AlarmSettingsChange = Partial<Omit<AlarmTypeSettings, "enabled">>;

export type AlarmTypeSettingsApi = {
  settings: AlarmTypeSettings;
  update: (changes: AlarmSettingsChange) => void;
  /** Schedules or cancels the alarm; a failed schedule turns it back off. */
  setEnabled: (enabled: boolean) => Promise<void>;
};

const REBUILD_DEBOUNCE_MS = 500;

const SCHEDULE: Record<AlarmType, () => Promise<string | null>> = {
  [ALARM_TYPE.FAJR]: scheduleFajrAlarm,
  [ALARM_TYPE.FRIDAY]: scheduleFridayAlarm,
};

// Module scope, so every mount of one type shares a lock and a pending rebuild.
const LOCKS: Record<AlarmType, AsyncLock> = {
  [ALARM_TYPE.FAJR]: createAsyncLock(),
  [ALARM_TYPE.FRIDAY]: createAsyncLock(),
};
const pendingRebuilds = new Map<AlarmType, ReturnType<typeof setTimeout>>();

const toNativeSettings = (changes: Partial<AlarmTypeSettings>): Record<string, unknown> => {
  const native: Record<string, unknown> = {};
  if (changes.enabled !== undefined) native.enabled = changes.enabled;
  if (changes.sound !== undefined) native.sound = getNativeSoundName(changes.sound);
  if (changes.volume !== undefined) native.volume = changes.volume;

  if (Platform.OS === PlatformType.ANDROID) {
    if (changes.challenge) {
      native.challengeType = changes.challenge.type;
      native.challengeDifficulty = changes.challenge.difficulty;
      native.challengeCount = changes.challenge.count;
    }
    if (changes.vibration) {
      native.vibrationEnabled = changes.vibration.enabled;
      native.vibrationPattern = changes.vibration.pattern;
    }
    if (changes.snooze) {
      native.snoozeEnabled = changes.snooze.enabled;
      native.snoozeMaxCount = changes.snooze.maxCount;
      native.snoozeDuration = changes.snooze.durationMinutes;
    }
    if (changes.timing) {
      native.timingMode = changes.timing.mode;
      native.timingMinutesBefore = changes.timing.minutesBefore;
    }
    if (changes.gentleWakeUp) {
      native.gentleWakeUpEnabled = changes.gentleWakeUp.enabled;
      native.gentleWakeUpDuration = changes.gentleWakeUp.durationMinutes;
    }
  }
  return native;
};

const rebuildDebounced = (alarmType: AlarmType, afterNativeSync: Promise<boolean>) => {
  clearTimeout(pendingRebuilds.get(alarmType));
  pendingRebuilds.set(
    alarmType,
    setTimeout(() => {
      pendingRebuilds.delete(alarmType);
      // Locked: a disable between cancel and recreate leaves a live alarm.
      LOCKS[alarmType](async () => {
        // Scheduling reads native settings; a failed write rebuilds stale ones.
        if (!(await afterNativeSync)) return;
        await useAlarmStore.getState().cancelAlarmsByType(toScheduledAlarmType(alarmType));
        await SCHEDULE[alarmType]();
      });
    }, REBUILD_DEBOUNCE_MS)
  );
};

const writeSettings = (alarmType: AlarmType, changes: Partial<AlarmTypeSettings>) => {
  useAlarmSettingsStore.getState().updateSettings(alarmType, changes);

  const scheduledType = toScheduledAlarmType(alarmType);
  const native = toNativeSettings(changes);
  // setAlarmSettings resolves false rather than rejecting.
  const nativeSync =
    Object.keys(native).length > 0
      ? ExpoAlarm.setAlarmSettings(scheduledType, native)
      : Promise.resolve(true);
  nativeSync.then((ok) => {
    if (!ok) alarmLog.e("Settings", `native settings sync failed for ${scheduledType}`);
  });

  // AlarmKit copies the sound into the alarm; Android reads it at fire time.
  const soundNeedsRebuild = changes.sound !== undefined && Platform.OS === PlatformType.IOS;
  const { enabled } = useAlarmSettingsStore.getState()[alarmType];
  if ((changes.timing || soundNeedsRebuild) && enabled) {
    rebuildDebounced(alarmType, nativeSync);
  }
};

// Serialized: a disable inside an enable's schedule leaves an alarm behind Off.
const setAlarmEnabled = (alarmType: AlarmType, enabled: boolean): Promise<void> =>
  LOCKS[alarmType](async () => {
    writeSettings(alarmType, { enabled });
    try {
      if (enabled) {
        const id = await SCHEDULE[alarmType]();
        // Enabled is stored, so null is a real failure, not the disabled return.
        if (id === null) writeSettings(alarmType, { enabled: false });
      } else if (
        !(await useAlarmStore.getState().cancelAlarmsByType(toScheduledAlarmType(alarmType)))
      ) {
        // The alarm is still armed, so the switch must not read Off.
        writeSettings(alarmType, { enabled: true });
      }
    } catch {
      writeSettings(alarmType, { enabled: !enabled });
    }
  });

/** One alarm type's settings and the writes that keep its alarm in step. */
export const useAlarmTypeSettings = (alarmType: AlarmType): AlarmTypeSettingsApi => {
  const settings = useAlarmSettingsStore((state) => state[alarmType]);
  return {
    settings,
    update: (changes) => writeSettings(alarmType, changes),
    setEnabled: (enabled) => setAlarmEnabled(alarmType, enabled),
  };
};
