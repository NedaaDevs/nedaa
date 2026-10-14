import { Platform } from "react-native";
import { isAlarmKitAvailable } from "expo-alarm";

import { PlatformType } from "@/enums/app";

// Android runs its own alarms; iOS needs AlarmKit, absent below its OS floor.
const isAndroid = Platform.OS === PlatformType.ANDROID;

// The OS version holds for the process: every reader shares the first answer.
let cached: boolean | null = isAndroid ? true : null;
let pending: Promise<boolean> | null = null;

/** Whether this device can schedule alarms; a native failure counts as no. */
export const alarmSupport = (): Promise<boolean> => {
  if (cached !== null) return Promise.resolve(cached);
  pending ??= isAlarmKitAvailable()
    .catch(() => false)
    .then((available) => {
      cached = available;
      return available;
    });
  return pending;
};

/** The answer already known, or null before the native module answers. */
export const knownAlarmSupport = (): boolean | null => cached;
