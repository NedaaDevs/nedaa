import { useEffect, useState, useCallback, useRef } from "react";
import { Vibration, BackHandler, Platform } from "react-native";
import { router } from "expo-router";
import * as ExpoAlarm from "expo-alarm";

import { useAlarmStore } from "@/stores/alarm";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { completeAndRescheduleAlarm } from "@/utils/alarmScheduler";
import { alarmLog } from "@/utils/alarmReport";
import { getNativeSoundName } from "@/utils/nativeSoundName";
import { markAlarmHandled, isAlarmHandled, setAlarmScreenActive } from "@/hooks/useAlarmDeepLink";
import { VIBRATION_PATTERNS, DEFAULT_ALARM_TYPE_SETTINGS } from "@/types/alarm";
import { ALARM_SCREEN_PATH, ALARM_TYPE } from "@/constants/Alarm";
import { PlatformType } from "@/enums/app";
import { isScheduledAlarmType, toSettingsAlarmType } from "@/utils/alarmTypes";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("alarm");

const startSound = async (sound: string, volume: number) => {
  await ExpoAlarm.startAlarmSound(getNativeSoundName(sound || DEFAULT_ALARM_TYPE_SETTINGS.sound));
  ExpoAlarm.setAlarmVolume(volume);
};

/** Starts the alarm sound unless it plays already. */
const ensureSound = async (sound: string, volume: number) => {
  if (!ExpoAlarm.isAlarmSoundPlaying()) await startSound(sound, volume);
};

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

  // A custom or unknown alarm rings with the Fajr settings.
  const settingsType =
    (isScheduledAlarmType(alarmType) && toSettingsAlarmType(alarmType)) || ALARM_TYPE.FAJR;
  const alarmSettings = useAlarmSettingsStore((state) => state[settingsType]);

  const snoozeCount = alarm?.snoozeCount ?? 0;
  const maxSnoozes = alarmSettings.snooze.enabled ? alarmSettings.snooze.maxCount : 0;
  const canSnooze = alarmSettings.snooze.enabled && snoozeCount < maxSnoozes;
  const remainingSnoozes = Math.max(0, maxSnoozes - snoozeCount);

  const vibrationPattern = alarmSettings.vibration.enabled
    ? VIBRATION_PATTERNS[alarmSettings.vibration.pattern]
    : null;

  useEffect(() => {
    const handled = isAlarmHandled(activeAlarmId);
    if (handled && !isSnoozed && !snoozeEndTime) {
      router.replace("/");
    }
  }, [activeAlarmId, isSnoozed, snoozeEndTime]);

  // Android's alarm service plays the sound natively; iOS plays it from here.
  useEffect(() => {
    if (Platform.OS !== PlatformType.IOS || isSnoozed || isDismissed) return;
    ensureSound(alarmSettings.sound, alarmSettings.volume).catch((error: unknown) =>
      log.w("Sound", `alarm sound did not start: ${String(error)}`)
    );
  }, [isSnoozed, isDismissed, alarmSettings.sound, alarmSettings.volume]);

  useEffect(() => {
    if (Platform.OS !== PlatformType.ANDROID) return;

    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    setAlarmScreenActive(activeAlarmId);
    return () => setAlarmScreenActive(null);
  }, [activeAlarmId]);

  // Set from the snooze request until the snooze ends.
  const snoozingRef = useRef(false);

  useEffect(() => {
    if (!snoozeEndTime) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, snoozeEndTime.getTime() - Date.now());
      setSnoozeTimeRemaining(Math.ceil(remaining / 1000));

      if (remaining <= 0) {
        clearInterval(interval);
        snoozingRef.current = false;
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
  // Bumped by each silencing, so a sound restart that lands after one yields.
  const quietGenRef = useRef(0);
  const ringCountRef = useRef(0);

  const handleChallengeComplete = useCallback(async () => {
    dismissedRef.current = true;
    quietGenRef.current += 1;
    setIsDismissed(true);
    Vibration.cancel();
    ExpoAlarm.stopAllAlarmEffects();
    ExpoAlarm.restoreSystemVolume();
    markAlarmHandled(activeAlarmId);
    await completeAndRescheduleAlarm(activeAlarmId);
    router.replace({
      pathname: ALARM_SCREEN_PATH.COMPLETE,
      params: { alarmType },
    });
  }, [activeAlarmId, alarmType]);

  const ringAgain = useCallback(async () => {
    const gen = quietGenRef.current;
    const ringCount = ++ringCountRef.current;
    await startSound(alarmSettings.sound, alarmSettings.volume).catch((error: unknown) =>
      log.w("Sound", `alarm sound did not start: ${String(error)}`)
    );
    if (dismissedRef.current) {
      // The stop ran before this start, so it is undone again.
      ExpoAlarm.stopAllAlarmEffects();
      ExpoAlarm.restoreSystemVolume();
      return;
    }
    if (quietGenRef.current !== gen) {
      // The native stop is shared, so only the newest ring may stop the sound.
      if (ringCountRef.current === ringCount) ExpoAlarm.stopAlarmSound();
      return;
    }
    if (vibrationPattern) {
      ExpoAlarm.startAlarmVibration(alarmSettings.vibration.pattern);
      Vibration.vibrate([...vibrationPattern], true);
    }
  }, [
    alarmSettings.sound,
    alarmSettings.volume,
    alarmSettings.vibration.pattern,
    vibrationPattern,
  ]);

  /** Pauses the sound and vibration while the person works on the task. */
  const handleQuietStart = useCallback(() => {
    if (dismissedRef.current) return;
    quietGenRef.current += 1;
    // The alarm vibrates natively; cancel() reaches only a JS vibration.
    Vibration.cancel();
    ExpoAlarm.stopAlarmVibration();
    ExpoAlarm.stopAlarmSound();
  }, []);

  const handleQuietEnd = useCallback(async () => {
    if (dismissedRef.current || snoozingRef.current) return;
    await ringAgain();
  }, [ringAgain]);

  const handleSnooze = useCallback(async () => {
    if (!canSnooze) return;

    Vibration.cancel();
    quietGenRef.current += 1;
    snoozingRef.current = true;

    const snoozeDuration = alarmSettings.snooze.durationMinutes;
    // A snooze that throws is a failed snooze, so the guard never outlives it.
    const result = await snoozeAlarm(activeAlarmId, snoozeDuration).catch((error: unknown) => {
      alarmLog.e("AlarmScreen", `snooze threw: ${String(error)}`);
      return null;
    });
    if (!result) {
      // The alarm is still armed, so it rings until the challenge is solved.
      snoozingRef.current = false;
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
    tasks: alarmSettings.tasks,
    handleChallengeComplete,
    handleSnooze,
    handleQuietStart,
    handleQuietEnd,
  };
}
