import { Platform } from "react-native";
import * as ExpoAlarm from "expo-alarm";

import { ALARM_TYPE } from "@/constants/Alarm";
import { PlatformType } from "@/enums/app";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import type { AlarmTypeSettings } from "@/types/alarm";
import { alarmLog } from "@/utils/alarmReport";
import { toScheduledAlarmType } from "@/utils/alarmTypes";
import { getNativeSoundName } from "@/utils/nativeSoundName";

/** The native form of a settings change; Android stores more of it than iOS. */
export const toNativeSettings = (changes: Partial<AlarmTypeSettings>): Record<string, unknown> => {
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
    if (changes.tasks) native.tasks = changes.tasks;
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

/**
 * Writes each alarm's saved stack to Android, whose overlay reads its own copy.
 * A copy from before stacks were stored, or one a failed write left behind,
 * differs from the saved one.
 */
export const pushSavedWakeTasks = async (): Promise<void> => {
  if (Platform.OS !== PlatformType.ANDROID) return;
  // Unhydrated settings are the defaults, which would replace a saved stack.
  if (!useAlarmSettingsStore.persist.hasHydrated()) return;

  const saved = useAlarmSettingsStore.getState();
  for (const alarmType of Object.values(ALARM_TYPE)) {
    const { challenge, tasks } = saved[alarmType];
    const scheduledType = toScheduledAlarmType(alarmType);
    // setAlarmSettings resolves false rather than rejecting.
    const written = await ExpoAlarm.setAlarmSettings(
      scheduledType,
      toNativeSettings({ challenge, tasks })
    );
    if (!written) alarmLog.e("Settings", `saved tasks not written for ${scheduledType}`);
  }
};
