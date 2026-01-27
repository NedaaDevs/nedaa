import { useEffect, useState, useMemo, useRef } from "react";
import { Vibration, BackHandler, Platform } from "react-native";
import { router } from "expo-router";
import * as ExpoAlarm from "expo-alarm";

import { useAlarmStore } from "@/stores/alarm";
import { markAlarmHandled, isAlarmHandled, setAlarmScreenActive } from "@/hooks/useAlarmDeepLink";
import { ALARM_DEFAULTS, VIBRATION_PATTERN } from "@/constants/Alarm";

const { TAPS_REQUIRED, SNOOZE_MINUTES, MAX_SNOOZES } = ALARM_DEFAULTS;

export function useAlarmScreen(alarmId: string, alarmType: string) {
  const [tapCount, setTapCount] = useState(0);
  const [isSnoozed, setIsSnoozed] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [snoozeEndTime, setSnoozeEndTime] = useState<Date | null>(null);
  const [snoozeTimeRemaining, setSnoozeTimeRemaining] = useState(0);

  const { completeAlarm, snoozeAlarm, getAlarm } = useAlarmStore();
  const alarm = useMemo(() => getAlarm(alarmId), [alarmId, getAlarm]);

  const snoozeCount = alarm?.snoozeCount ?? 0;
  const canSnooze = snoozeCount < MAX_SNOOZES;
  const remainingTaps = TAPS_REQUIRED - tapCount;
  const remainingSnoozes = MAX_SNOOZES - snoozeCount;

  // Redirect home if already handled
  useEffect(() => {
    if (isAlarmHandled(alarmId) && !isSnoozed && !snoozeEndTime) {
      router.replace("/");
    }
  }, [alarmId, isSnoozed, snoozeEndTime]);

  // Clear bypass native effects on mount
  useEffect(() => {
    ExpoAlarm.stopAllAlarmEffects();
  }, []);

  // Ensure audio is playing when alarm is active
  useEffect(() => {
    if (isSnoozed || isDismissed) return;

    const ensureAudioPlaying = async () => {
      try {
        const isPlaying = ExpoAlarm.isAlarmSoundPlaying();
        if (!isPlaying) {
          await ExpoAlarm.startAlarmSound("beep");
        }
      } catch {
        // audio session may not be available
      }
    };

    ensureAudioPlaying();
  }, [isSnoozed, isDismissed]);

  // Block Android hardware back button
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => backHandler.remove();
  }, []);

  // Nav guard registration
  useEffect(() => {
    setAlarmScreenActive(alarmId);
    return () => setAlarmScreenActive(null);
  }, [alarmId]);

  // Snooze countdown timer
  useEffect(() => {
    if (!snoozeEndTime) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, snoozeEndTime.getTime() - Date.now());
      setSnoozeTimeRemaining(Math.ceil(remaining / 1000));

      if (remaining <= 0) {
        clearInterval(interval);
        setIsSnoozed(false);
        setSnoozeEndTime(null);
        setTapCount(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [snoozeEndTime]);

  // Vibration control
  useEffect(() => {
    if (isSnoozed || isDismissed) {
      Vibration.cancel();
      return;
    }
    Vibration.vibrate(VIBRATION_PATTERN, true);
    return () => Vibration.cancel();
  }, [isSnoozed, isDismissed]);

  const handleTap = async () => {
    const newCount = tapCount + 1;
    setTapCount(newCount);

    if (newCount >= TAPS_REQUIRED) {
      setIsDismissed(true);
      Vibration.cancel();

      markAlarmHandled(alarmId);
      await completeAlarm(alarmId);

      router.replace("/");
    }
  };

  const handleSnooze = async () => {
    if (!canSnooze) return;

    Vibration.cancel();
    markAlarmHandled(alarmId);

    const result = await snoozeAlarm(alarmId);
    if (result) {
      setIsSnoozed(true);
      setSnoozeEndTime(result.snoozeEndTime);
      setSnoozeTimeRemaining(SNOOZE_MINUTES * 60);
    }
  };

  return {
    tapCount,
    isSnoozed,
    isDismissed,
    snoozeEndTime,
    snoozeTimeRemaining,
    canSnooze,
    remainingTaps,
    remainingSnoozes,
    handleTap,
    handleSnooze,
  };
}

export function formatTimeRemaining(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
