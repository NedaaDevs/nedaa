/**
 * Android Native Alarm Service
 *
 * This file is selected by Metro bundler when building for Android.
 * It interfaces with the native Kotlin AlarmModule.
 */
import { NativeModules, Platform } from "react-native";

// Types
import type { AlarmSettings, AlarmType } from "@/types/alarm";

// Services
import { getAlarmSoundUri } from "./sounds";

// Enums
import { PlatformType } from "@/enums/app";

type AlarmManagerInterface = {
  scheduleAlarm(config: {
    id: string;
    timestamp: number;
    alarmType: string;
    title: string;
    body: string;
    subtitle?: string;
    soundUri?: string;
    vibration: boolean;
    snoozeMinutes: number;
    challengeType?: string;
    mathDifficulty?: string;
    mathQuestionCount?: number;
    tapCount?: number;
    challengeGracePeriodSec?: number;
  }): Promise<string>;
  cancelAlarm(id: string): Promise<boolean>;
  cancelAllAlarms(): Promise<boolean>;
  getScheduledAlarms(): Promise<
    { id: string; timestamp: number; alarmType: string; title: string }[]
  >;
  canScheduleExactAlarms(): Promise<boolean>;
  openAlarmPermissionSettings(): Promise<boolean>;
  canDrawOverlays(): Promise<boolean>;
  openOverlayPermissionSettings(): Promise<boolean>;
};

const NativeAlarmModule: AlarmManagerInterface | null =
  Platform.OS === PlatformType.ANDROID ? NativeModules.NedaaAlarmModule : null;

export type AlarmPermissionStatus = {
  notifications: boolean;
  exactAlarms: boolean;
  batteryOptimization: boolean;
  overlay: boolean;
};

export async function scheduleAlarm(config: {
  id: string;
  type: AlarmType;
  scheduledTime: Date;
  title: string;
  body: string;
  subtitle?: string;
  settings: AlarmSettings;
}): Promise<string | null> {
  if (!NativeAlarmModule) return null;

  const { id, type, scheduledTime, title, body, subtitle, settings } = config;
  const timestamp = scheduledTime.getTime();

  if (timestamp <= Date.now()) return null;

  try {
    // Resolve sound URI (supports bundled and system alarm sounds)
    const soundUri = await getAlarmSoundUri(settings.sound);

    return await NativeAlarmModule.scheduleAlarm({
      id,
      timestamp,
      alarmType: type,
      title,
      body,
      subtitle,
      soundUri,
      vibration: settings.vibration,
      snoozeMinutes: settings.snoozeDurationMinutes,
      challengeType: settings.challengeEnabled ? settings.challengeType : undefined,
      mathDifficulty: settings.challengeEnabled ? settings.mathDifficulty : undefined,
      mathQuestionCount: settings.challengeEnabled ? settings.mathQuestionCount : undefined,
      tapCount: settings.challengeEnabled ? settings.tapCount : undefined,
      challengeGracePeriodSec: settings.challengeEnabled
        ? settings.challengeGracePeriodSec
        : undefined,
    });
  } catch (error) {
    console.error("[AlarmManager] Schedule failed:", error);
    return null;
  }
}

export async function cancelAlarm(alarmId: string): Promise<void> {
  if (!NativeAlarmModule) return;
  try {
    await NativeAlarmModule.cancelAlarm(alarmId);
  } catch (error) {
    console.error("[AlarmManager] Cancel failed:", error);
  }
}

export const cancelAllAlarms = async (): void => {
  if (!NativeAlarmModule) return;
  try {
    NativeAlarmModule.cancelAllAlarms();
  } catch (error) {
    console.error("[AlarmManager] Cancel all failed:", error);
  }
};

export const getScheduledAlarms = async (): Promise<string[]> => {
  if (!NativeAlarmModule) return [];
  try {
    const alarms = await NativeAlarmModule.getScheduledAlarms();
    return alarms.map((a) => a.id);
  } catch (error) {
    console.error("[AlarmManager] Get alarms failed:", error);
    return [];
  }
};

export const canScheduleExactAlarms = async (): Promise<boolean> => {
  if (!NativeAlarmModule) return false;
  try {
    return await NativeAlarmModule.canScheduleExactAlarms();
  } catch {
    return false;
  }
};

export const openAlarmPermissionSettings = async (): Promise<void> => {
  if (!NativeAlarmModule) return;
  try {
    NativeAlarmModule.openAlarmPermissionSettings();
  } catch {}
};

export const canDrawOverlays = async (): Promise<boolean> => {
  if (!NativeAlarmModule) return false;
  try {
    return await NativeAlarmModule.canDrawOverlays();
  } catch {
    return false;
  }
};

export const openOverlayPermissionSettings = async (): Promise<void> => {
  if (!NativeAlarmModule) return;
  try {
    NativeAlarmModule.openOverlayPermissionSettings();
  } catch {}
};

export const checkAlarmPermissions = async (): Promise<AlarmPermissionStatus> => {
  if (!NativeAlarmModule) {
    return { notifications: true, exactAlarms: true, batteryOptimization: true, overlay: true };
  }
  return {
    notifications: true,
    exactAlarms: await canScheduleExactAlarms(),
    batteryOptimization: true,
    overlay: await canDrawOverlays(),
  };
};

export const requestAlarmPermissions = async (): Promise<boolean> => {
  if (!NativeAlarmModule) return true;

  // Check exact alarms permission
  const canSchedule = await canScheduleExactAlarms();
  if (!canSchedule) {
    await openAlarmPermissionSettings();
    return false;
  }

  // Check overlay permission (needed for alarm UI when app is killed)
  const canOverlay = await canDrawOverlays();
  if (!canOverlay) {
    await openOverlayPermissionSettings();
    return false;
  }

  return true;
};
