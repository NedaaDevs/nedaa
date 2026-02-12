import { useEffect, useState, useMemo, useCallback } from "react";
import { Vibration, BackHandler, Platform } from "react-native";
import { router } from "expo-router";
import * as ExpoAlarm from "expo-alarm";

import { useAlarmStore } from "@/stores/alarm";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { markAlarmHandled, isAlarmHandled, setAlarmScreenActive } from "@/hooks/useAlarmDeepLink";
import { VIBRATION_PATTERNS, DEFAULT_CHALLENGE_CONFIG, ChallengeConfig } from "@/types/alarm";

export function useAlarmScreen(alarmId: string, alarmType: string) {
  const [isSnoozed, setIsSnoozed] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [snoozeEndTime, setSnoozeEndTime] = useState<Date | null>(null);
  const [snoozeTimeRemaining, setSnoozeTimeRemaining] = useState(0);

  const { completeAlarm, snoozeAlarm, getAlarm } = useAlarmStore();
  const alarm = useMemo(() => getAlarm(alarmId), [alarmId, getAlarm]);

  const settingsType = alarmType === "jummah" ? "friday" : alarmType === "fajr" ? "fajr" : "fajr";
  const alarmSettings = useAlarmSettingsStore((state) => state[settingsType]);

  const snoozeCount = alarm?.snoozeCount ?? 0;
  const maxSnoozes = alarmSettings.snooze.enabled ? alarmSettings.snooze.maxCount : 0;
  const canSnooze = alarmSettings.snooze.enabled && snoozeCount < maxSnoozes;
  const remainingSnoozes = Math.max(0, maxSnoozes - snoozeCount);

  const challengeConfig: ChallengeConfig = alarmSettings.challenge ?? DEFAULT_CHALLENGE_CONFIG;

  const vibrationPattern = alarmSettings.vibration.enabled
    ? VIBRATION_PATTERNS[alarmSettings.vibration.pattern]
    : null;

  useEffect(() => {
    const handled = isAlarmHandled(alarmId);
    if (handled && !isSnoozed && !snoozeEndTime) {
      router.replace("/");
    }
  }, [alarmId, isSnoozed, snoozeEndTime]);

  // On Android, the native AlarmService/AlarmOverlayService handles audio.
  // On iOS, we need to manage audio from React Native.
  useEffect(() => {
    if (Platform.OS === "ios") {
      // iOS: ensure alarm sound is playing when screen mounts
      const ensureAudioPlaying = async () => {
        if (isSnoozed || isDismissed) return;
        try {
          const isPlaying = ExpoAlarm.isAlarmSoundPlaying();
          if (!isPlaying) {
            await ExpoAlarm.startAlarmSound(alarmSettings.sound || "beep");
            ExpoAlarm.setAlarmVolume(alarmSettings.volume);
          }
        } catch {
          // Silently handle errors
        }
      };
      ensureAudioPlaying();
    }
    // Android: native side manages audio, don't interfere
  }, [isSnoozed, isDismissed, alarmSettings.sound, alarmSettings.volume]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    setAlarmScreenActive(alarmId);
    return () => setAlarmScreenActive(null);
  }, [alarmId]);

  useEffect(() => {
    if (!snoozeEndTime) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, snoozeEndTime.getTime() - Date.now());
      setSnoozeTimeRemaining(Math.ceil(remaining / 1000));

      if (remaining <= 0) {
        clearInterval(interval);
        setIsSnoozed(false);
        setSnoozeEndTime(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [snoozeEndTime]);

  useEffect(() => {
    if (isSnoozed || isDismissed || !vibrationPattern) {
      Vibration.cancel();
      return;
    }
    Vibration.vibrate([...vibrationPattern], true);
    return () => Vibration.cancel();
  }, [isSnoozed, isDismissed, vibrationPattern]);

  const handleChallengeComplete = useCallback(async () => {
    setIsDismissed(true);
    Vibration.cancel();
    ExpoAlarm.stopAllAlarmEffects();
    ExpoAlarm.restoreSystemVolume();
    markAlarmHandled(alarmId);
    await completeAlarm(alarmId);
    router.replace({
      pathname: "/alarm-complete",
      params: { alarmType },
    });
  }, [alarmId, alarmType, completeAlarm]);

  const handleSnooze = useCallback(async () => {
    if (!canSnooze) return;

    Vibration.cancel();
    markAlarmHandled(alarmId);

    const snoozeDuration = alarmSettings.snooze.durationMinutes;
    const result = await snoozeAlarm(alarmId, snoozeDuration);
    if (result) {
      setIsSnoozed(true);
      setSnoozeEndTime(result.snoozeEndTime);
      setSnoozeTimeRemaining(snoozeDuration * 60);
    }
  }, [alarmId, canSnooze, alarmSettings.snooze.durationMinutes, snoozeAlarm]);

  return {
    isSnoozed,
    isDismissed,
    snoozeEndTime,
    snoozeTimeRemaining,
    canSnooze,
    remainingSnoozes,
    challengeConfig,
    handleChallengeComplete,
    handleSnooze,
  };
}

export function formatTimeRemaining(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
