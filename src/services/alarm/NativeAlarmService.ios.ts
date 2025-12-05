/**
 * iOS Native Alarm Service
 *
 * This file is selected by Metro bundler when building for iOS.
 * iOS uses AlarmKit (iOS 26+) for scheduling alarms.
 *
 * Note: iOS AlarmKit handles its own UI, so challenge features are not supported.
 * This is an intentional platform limitation documented in ALARM_SYSTEM.md.
 */

import type { AlarmSettings, AlarmType } from "@/types/alarm";

import { alarmKit } from "./AlarmKit";
import { getIOSSoundName } from "./sounds";

export type AlarmPermissionStatus = {
  notifications: boolean;
  exactAlarms: boolean;
  batteryOptimization: boolean;
  overlay: boolean;
};

/**
 * Schedule an alarm using iOS AlarmKit.
 */
export async function scheduleAlarm(config: {
  id: string;
  type: AlarmType;
  scheduledTime: Date;
  title: string;
  body: string;
  subtitle?: string;
  settings: AlarmSettings;
}): Promise<string | null> {
  const { id, type, scheduledTime, title, settings } = config;
  const timestamp = scheduledTime.getTime();

  if (timestamp <= Date.now()) return null;

  try {
    // First cancel any existing alarm with this ID
    await alarmKit.cancelAlarm(id);

    const result = await alarmKit.scheduleAlarm({
      title,
      timestamp,
      snoozeMinutes: settings.snoozeDurationMinutes,
      soundName: getIOSSoundName(settings.sound),
      tintColor: type === "fajr" ? "#4CAF50" : "#2196F3",
    });

    return result.alarmId;
  } catch (error) {
    console.error("[NativeAlarmService.ios] Schedule failed:", error);
    return null;
  }
}

/**
 * Cancel a scheduled alarm.
 */
export async function cancelAlarm(alarmId: string): Promise<void> {
  try {
    await alarmKit.cancelAlarm(alarmId);
  } catch (error) {
    console.error("[NativeAlarmService.ios] Cancel failed:", error);
  }
}

/**
 * Cancel all scheduled alarms.
 */
export async function cancelAllAlarms(): Promise<void> {
  try {
    const alarms = await alarmKit.getAllAlarms();
    for (const alarm of alarms) {
      await alarmKit.cancelAlarm(alarm.id);
    }
  } catch (error) {
    console.error("[NativeAlarmService.ios] Cancel all failed:", error);
  }
}

/**
 * Get all scheduled alarm IDs.
 */
export async function getScheduledAlarms(): Promise<string[]> {
  try {
    const alarms = await alarmKit.getAllAlarms();
    return alarms.map((a) => a.id);
  } catch (error) {
    console.error("[NativeAlarmService.ios] Get alarms failed:", error);
    return [];
  }
}

/**
 * Get the next scheduled alarm time from the system.
 */
export async function getNextAlarmClock(): Promise<Date | null> {
  try {
    const alarms = await alarmKit.getAllAlarms();
    if (alarms.length === 0) return null;

    const now = Date.now();
    const futureAlarms = alarms
      .filter((a) => {
        const fireDate = a.nextFireDate ? new Date(a.nextFireDate).getTime() : 0;
        return fireDate > now;
      })
      .sort((a, b) => {
        const aTime = a.nextFireDate ? new Date(a.nextFireDate).getTime() : 0;
        const bTime = b.nextFireDate ? new Date(b.nextFireDate).getTime() : 0;
        return aTime - bTime;
      });

    if (futureAlarms.length > 0 && futureAlarms[0].nextFireDate) {
      return new Date(futureAlarms[0].nextFireDate);
    }
    return null;
  } catch (error) {
    console.error("[NativeAlarmService.ios] Get next alarm failed:", error);
    return null;
  }
}

/**
 * Check alarm permissions on iOS.
 */
export async function checkAlarmPermissions(): Promise<AlarmPermissionStatus> {
  const status = await alarmKit.getAuthorizationStatus();
  const isAuthorized = status === "authorized";

  return {
    notifications: isAuthorized,
    exactAlarms: isAuthorized,
    batteryOptimization: true, // Not applicable on iOS
    overlay: true, // Not applicable on iOS (AlarmKit handles UI)
  };
}

/**
 * Request alarm permissions on iOS.
 */
export async function requestAlarmPermissions(): Promise<boolean> {
  try {
    const result = await alarmKit.requestAuthorization();
    return result.status === "authorized";
  } catch (error) {
    console.error("[NativeAlarmService.ios] Permission request failed:", error);
    return false;
  }
}
