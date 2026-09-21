import { useEffect, useState, useCallback, useRef } from "react";
import { Vibration, BackHandler, Platform } from "react-native";
import { router } from "expo-router";
import * as ExpoAlarm from "expo-alarm";

import { ScheduledAlarmType } from "@/enums/alarm";
import { useAlarmStore } from "@/stores/alarm";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { completeAndRescheduleAlarm } from "@/utils/alarmScheduler";
import { getNativeSoundName } from "@/utils/nativeSoundName";
import { markAlarmHandled, isAlarmHandled, setAlarmScreenActive } from "@/hooks/useAlarmDeepLink";
import { VIBRATION_PATTERNS, DEFAULT_CHALLENGE_CONFIG, ChallengeConfig } from "@/types/alarm";
import { PRAYER_ID } from "@/constants/Prayer";

export function useAlarmScreen(alarmId: string, alarmType: string) {
  const [isSnoozed, setIsSnoozed] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [snoozeEndTime, setSnoozeEndTime] = useState<Date | null>(null);
  const [snoozeTimeRemaining, setSnoozeTimeRemaining] = useState(0);
  // A snooze schedules a new alarm id; completion and navigation follow it.
  const [activeAlarmId, setActiveAlarmId] = useState(alarmId);
  const [routeAlarmId, setRouteAlarmId] = useState(alarmId);
  if (routeAlarmId !== alarmId) {
    setRouteAlarmId(alarmId);
    setActiveAlarmId(alarmId);
  }

  const snoozeAlarm = useAlarmStore((state) => state.snoozeAlarm);
  // Selected so the snooze count on screen follows the store.
  const alarm = useAlarmStore((state) => state.scheduledAlarms[activeAlarmId]);

  const settingsType = alarmType === ScheduledAlarmType.JUMMAH ? "friday" : PRAYER_ID.FAJR;
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
    const handled = isAlarmHandled(activeAlarmId);
    if (handled && !isSnoozed && !snoozeEndTime) {
      router.replace("/");
    }
  }, [activeAlarmId, isSnoozed, snoozeEndTime]);

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
            await ExpoAlarm.startAlarmSound(getNativeSoundName(alarmSettings.sound || "beep"));
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
    setAlarmScreenActive(activeAlarmId);
    return () => setAlarmScreenActive(null);
  }, [activeAlarmId]);

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

  const dismissedRef = useRef(false);

  const handleChallengeComplete = useCallback(async () => {
    dismissedRef.current = true;
    setIsDismissed(true);
    Vibration.cancel();
    ExpoAlarm.stopAllAlarmEffects();
    ExpoAlarm.restoreSystemVolume();
    markAlarmHandled(activeAlarmId);
    await completeAndRescheduleAlarm(activeAlarmId);
    router.replace({
      pathname: "/alarm-complete",
      params: { alarmType },
    });
  }, [activeAlarmId, alarmType]);

  const ringAgain = useCallback(async () => {
    await ExpoAlarm.startAlarmSound(getNativeSoundName(alarmSettings.sound || "beep"));
    ExpoAlarm.setAlarmVolume(alarmSettings.volume);
    if (vibrationPattern) {
      Vibration.vibrate([...vibrationPattern], true);
    }
  }, [alarmSettings.sound, alarmSettings.volume, vibrationPattern]);

  const handleGraceStart = useCallback(() => {
    if (dismissedRef.current) return;
    Vibration.cancel();
    ExpoAlarm.stopAlarmSound();
  }, []);

  const handleGraceExpire = useCallback(async () => {
    if (dismissedRef.current || isSnoozed) return;
    await ringAgain();
  }, [isSnoozed, ringAgain]);

  const handleSnooze = useCallback(async () => {
    if (!canSnooze) return;

    Vibration.cancel();

    const snoozeDuration = alarmSettings.snooze.durationMinutes;
    const result = await snoozeAlarm(activeAlarmId, snoozeDuration);
    if (!result) {
      // The alarm is still armed, so it rings until the challenge is solved.
      await ringAgain();
      return;
    }
    markAlarmHandled(activeAlarmId);
    setActiveAlarmId(result.snoozeId);
    setIsSnoozed(true);
    setSnoozeEndTime(result.snoozeEndTime);
    setSnoozeTimeRemaining(snoozeDuration * 60);
  }, [activeAlarmId, canSnooze, alarmSettings.snooze.durationMinutes, snoozeAlarm, ringAgain]);

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
    handleGraceStart,
    handleGraceExpire,
  };
}

export function formatTimeRemaining(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
