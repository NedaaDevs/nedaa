/**
 * Alarm Service Module
 *
 * Unified exports for alarm functionality across both platforms:
 * - Android: Uses native Kotlin AlarmModule with overlay UI
 * - iOS: Uses AlarmKit (iOS 26+) with native Apple UI
 *
 * Platform-specific implementations are selected by Metro bundler:
 * - NativeAlarmService.android.ts for Android builds
 * - NativeAlarmService.ios.ts for iOS builds
 */

// Native alarm service (platform-specific via Metro bundler)
export {
  scheduleAlarm,
  cancelAlarm,
  cancelAllAlarms,
  getScheduledAlarms,
  getNextAlarmClock,
  checkAlarmPermissions,
  requestAlarmPermissions,
} from "./NativeAlarmService";

// High-level scheduler for prayer alarms
export { alarmScheduler } from "./alarmScheduler";

// iOS AlarmKit service (direct access for iOS-specific features)
export { alarmKit } from "./AlarmKit";

// Types
export type { AlarmPermissionStatus, ScheduleAlarmConfig } from "@/types/alarmService";
export { ALARM_FEATURES } from "@/types/alarmService";

// Sound utilities
export {
  getSoundForPlatform,
  getAndroidSoundUri,
  getIOSSoundName,
  DEFAULT_ALARM_SOUND,
} from "@/services/alarm/sounds";
