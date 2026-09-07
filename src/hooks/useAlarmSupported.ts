import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { isAlarmKitAvailable } from "expo-alarm";

import { PlatformType } from "@/enums/app";

// Android drives alarms through our own scheduler, so support there is a
// constant. iOS has AlarmKit or nothing, and the native module answers false
// below the OS floor it requires.
const isAndroid = Platform.OS === PlatformType.ANDROID;

// The OS version holds for the life of the process, so the first answer is the
// only one worth asking for. Later mounts read it without a second bridge call
// and without a frame of the feature hidden.
let cached: boolean | null = isAndroid ? true : null;
let pending: Promise<boolean> | null = null;

const resolveSupport = () => {
  if (!pending) {
    pending = isAlarmKitAvailable()
      .catch(() => false)
      .then((available) => {
        cached = available;
        return available;
      });
  }
  return pending;
};

// True when the device can schedule alarms. Hide every alarm entry point when
// it is false: the native calls resolve false there, so the UI would toggle
// alarms that never fire.
export const useAlarmSupported = () => {
  const [supported, setSupported] = useState(cached ?? false);

  useEffect(() => {
    if (cached !== null) return;

    let active = true;
    resolveSupport().then((available) => {
      if (active) setSupported(available);
    });
    return () => {
      active = false;
    };
  }, []);

  return supported;
};
