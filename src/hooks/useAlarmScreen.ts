import { useEffect, useState, useCallback, useRef } from "react";
import { Vibration, BackHandler, Platform } from "react-native";
import { router } from "expo-router";
import * as ExpoAlarm from "expo-alarm";

import { type QuietResult, useAlarmStore } from "@/stores/alarm";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useEmergencyQuietStore } from "@/stores/emergencyQuiet";
import { completeAndRescheduleAlarm } from "@/utils/alarmScheduler";
import { alarmLog } from "@/utils/alarmReport";
import { getNativeSoundName } from "@/utils/nativeSoundName";
import { markAlarmHandled, isAlarmHandled, setAlarmScreenActive } from "@/hooks/useAlarmDeepLink";
import { VIBRATION_PATTERNS, DEFAULT_ALARM_TYPE_SETTINGS } from "@/types/alarm";
import { ALARM_HYDRATION_TIMEOUT_MS, ALARM_TYPE } from "@/constants/Alarm";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { PlatformType } from "@/enums/app";
import { snoozeLeft, snoozeOpen } from "@/utils/alarmRinging";
import { isScheduledAlarmType, toSettingsAlarmType } from "@/utils/alarmTypes";
import { AppLogger } from "@/utils/appLogger";
import { canSnoozeWith, quietEndsAt, runningQuietEnd } from "@/utils/emergencyQuiet";
import { waitForHydration } from "@/utils/storeHydration";

const log = AppLogger.create("alarm");

const startSound = async (sound: string, volume: number) => {
  await ExpoAlarm.startAlarmSound(getNativeSoundName(sound || DEFAULT_ALARM_TYPE_SETTINGS.sound));
  ExpoAlarm.setAlarmVolume(volume);
};

/** Starts the alarm sound unless it plays already. */
const ensureSound = async (sound: string, volume: number) => {
  if (!ExpoAlarm.isAlarmSoundPlaying()) await startSound(sound, volume);
};

/** A ringing alarm's emergency quiet: what decides the offer, and its confirm. */
export type EmergencyQuietControl = Readonly<{
  hasTask: boolean;
  preview: boolean;
  snoozed: boolean;
  /** This alarm, its snoozes included, has had its quiet. */
  used: boolean;
  /** When the running quiet rings the alarm again; null with none running. */
  quietUntil: number | null;
  confirming: boolean;
  /** The confirm is quieting; "Quiet now" takes no second press. */
  quieting: boolean;
  /** The last confirm failed; the alarm still rings and nothing was counted. */
  failed: boolean;
  open: () => void;
  back: () => void;
  confirm: () => Promise<void>;
}>;

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
  const quietAlarm = useAlarmStore((state) => state.quietAlarm);
  // Selected so the snooze count on screen follows the store.
  const alarm = useAlarmStore((state) => state.scheduledAlarms[activeAlarmId]);

  // A custom or unknown alarm rings with the Fajr settings.
  const settingsType =
    (isScheduledAlarmType(alarmType) && toSettingsAlarmType(alarmType)) || ALARM_TYPE.FAJR;
  const alarmSettings = useAlarmSettingsStore((state) => state[settingsType]);

  const [confirming, setConfirming] = useState(false);
  const [quieting, setQuieting] = useState(false);
  const [failed, setFailed] = useState(false);
  // The quiet lives in the record, so a relaunch finds it; this clock is read
  // again when it ends.
  const [quietClock, setQuietClock] = useState(() => Date.now());
  const quietUntil = runningQuietEnd(alarm, quietClock);
  const quiet = quietUntil !== null;

  const snoozeUse = {
    enabled: alarmSettings.snooze.enabled,
    count: alarm?.snoozeCount ?? 0,
    max: alarmSettings.snooze.maxCount,
  };
  const snoozeIsOpen = snoozeOpen(snoozeUse);
  const canSnooze = canSnoozeWith(snoozeIsOpen, quietUntil);
  const remainingSnoozes = snoozeLeft(snoozeUse);

  const vibrationPattern = alarmSettings.vibration.enabled
    ? VIBRATION_PATTERNS[alarmSettings.vibration.pattern]
    : null;

  useEffect(() => {
    const handled = isAlarmHandled(activeAlarmId);
    if (handled && !isSnoozed && !snoozeEndTime) {
      router.replace(BACK_DESTINATION.HOME.href);
    }
  }, [activeAlarmId, isSnoozed, snoozeEndTime]);

  // Android's alarm service plays the sound natively; iOS plays it from here.
  useEffect(() => {
    if (Platform.OS !== PlatformType.IOS || isSnoozed || isDismissed || quiet) return;
    ensureSound(alarmSettings.sound, alarmSettings.volume).catch((error: unknown) =>
      log.w("Sound", `alarm sound did not start: ${String(error)}`)
    );
  }, [isSnoozed, isDismissed, quiet, alarmSettings.sound, alarmSettings.volume]);

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

  // An ended alarm keeps its snoozed view; its snooze never ends here.
  useEffect(() => {
    if (!snoozeEndTime || isDismissed) return;

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
  }, [snoozeEndTime, isDismissed]);

  // The re-ring alarm sounds natively at the same moment; this restores the screen.
  useEffect(() => {
    if (quietUntil === null) return;
    const id = setTimeout(() => setQuietClock(Date.now()), Math.max(0, quietUntil - Date.now()));
    return () => clearTimeout(id);
  }, [quietUntil]);

  useEffect(() => {
    if (isSnoozed || isDismissed || quiet || !vibrationPattern) {
      Vibration.cancel();
      return;
    }
    Vibration.vibrate([...vibrationPattern], true);
    return () => Vibration.cancel();
  }, [isSnoozed, isDismissed, quiet, vibrationPattern]);

  const dismissedRef = useRef(false);
  // Bumped by each silencing, so a sound restart that lands after one yields.
  const quietGenRef = useRef(0);
  const ringCountRef = useRef(0);
  // From the quiet's silence until the quiet shows, or until it fails.
  const quietPendingRef = useRef(false);
  useEffect(() => {
    if (quiet) quietPendingRef.current = false;
  }, [quiet]);

  // The quiet being confirmed; an ending waits for it.
  const quietInFlightRef = useRef<Promise<QuietResult | null> | null>(null);

  /** Silences the alarm for good and records how it ended. */
  const endAlarm = useCallback(
    async (outcome: ExpoAlarm.AlarmOutcome) => {
      dismissedRef.current = true;
      quietGenRef.current += 1;
      setIsDismissed(true);
      Vibration.cancel();
      ExpoAlarm.stopAllAlarmEffects();
      ExpoAlarm.restoreSystemVolume();
      // A quiet that committed first leaves its re-ring as the armed alarm.
      const quieted = await quietInFlightRef.current?.catch(() => null);
      const endingId = quieted?.quietId ?? activeAlarmId;
      markAlarmHandled(endingId);
      await completeAndRescheduleAlarm(endingId, { outcome });
    },
    [activeAlarmId]
  );

  // The solved panel stays until its Close; another alarm may open over it.
  const handleChallengeComplete = useCallback(async () => {
    await endAlarm(ExpoAlarm.ALARM_OUTCOME.SOLVED);
    setAlarmScreenActive(null);
  }, [endAlarm]);

  /** An alarm with no task stops at its one press. */
  const handlePlainStop = useCallback(async () => {
    await endAlarm(ExpoAlarm.ALARM_OUTCOME.SOLVED);
    router.replace(BACK_DESTINATION.HOME.href);
  }, [endAlarm]);

  const handleClose = useCallback(() => router.replace(BACK_DESTINATION.HOME.href), []);

  const handleStop = useCallback(async () => {
    await endAlarm(ExpoAlarm.ALARM_OUTCOME.STOPPED);
    router.replace(BACK_DESTINATION.HOME.href);
  }, [endAlarm]);

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
    if (dismissedRef.current || quietPendingRef.current || snoozingRef.current || quiet) return;
    await ringAgain();
  }, [quiet, ringAgain]);

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
    setConfirming(false);
    setIsSnoozed(true);
    setSnoozeEndTime(result.snoozeEndTime);
    setSnoozeTimeRemaining(snoozeDuration * 60);
  }, [activeAlarmId, canSnooze, alarmSettings.snooze.durationMinutes, snoozeAlarm, ringAgain]);

  const confirmQuiet = useCallback(async () => {
    if (quieting || dismissedRef.current) return;
    setQuieting(true);
    setFailed(false);
    try {
      const { persist } = useEmergencyQuietStore;
      await waitForHydration(persist, { timeoutMs: ALARM_HYDRATION_TIMEOUT_MS });
      if (dismissedRef.current) return;
      const inFlight = quietAlarm(activeAlarmId, {
        ringsAt: new Date(quietEndsAt(Date.now())),
        recordUse: () => {
          if (dismissedRef.current) throw new Error("alarm ended");
          // An unread count could hand out a use already spent.
          if (!persist.hasHydrated()) throw new Error("emergency quiet count not read");
          useEmergencyQuietStore.getState().recordUse(Date.now());
        },
        silence: () => {
          quietPendingRef.current = true;
          quietGenRef.current += 1;
          Vibration.cancel();
        },
      });
      quietInFlightRef.current = inFlight;
      const result = await inFlight;
      // The ending owns the alarm from here.
      if (dismissedRef.current) return;
      if (!result) {
        quietPendingRef.current = false;
        setFailed(true);
        return;
      }
      markAlarmHandled(activeAlarmId);
      setActiveAlarmId(result.quietId);
      setConfirming(false);
    } catch (error) {
      log.w("Quiet", `emergency quiet failed: ${String(error)}`);
      quietPendingRef.current = false;
      setFailed(true);
    } finally {
      quietInFlightRef.current = null;
      setQuieting(false);
    }
  }, [quieting, quietAlarm, activeAlarmId]);

  const emergency: EmergencyQuietControl = {
    hasTask: alarmSettings.tasks.length > 0,
    preview: alarm?.isPreview === true,
    snoozed: isSnoozed,
    used: alarm?.quietUsed === true,
    quietUntil,
    confirming,
    quieting,
    failed,
    open: () => {
      setFailed(false);
      setConfirming(true);
    },
    back: () => setConfirming(false),
    confirm: confirmQuiet,
  };

  return {
    isSnoozed,
    isDismissed,
    snoozeEndTime,
    snoozeTimeRemaining,
    canSnooze,
    snoozeIsOpen,
    snoozeEnabled: alarmSettings.snooze.enabled,
    snoozeMinutes: alarmSettings.snooze.durationMinutes,
    remainingSnoozes,
    tasks: alarmSettings.tasks,
    handleChallengeComplete,
    handlePlainStop,
    handleClose,
    handleStop,
    handleSnooze,
    handleQuietStart,
    handleQuietEnd,
    emergency,
  };
}
