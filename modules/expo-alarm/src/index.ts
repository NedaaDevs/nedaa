import { requireOptionalNativeModule } from "expo-modules-core";

export type AuthorizationStatus = "notDetermined" | "authorized" | "denied";

export type AlarmType = "fajr" | "jummah" | "custom";

export interface ScheduleAlarmParams {
  id: string;
  triggerDate: Date;
  title: string;
  alarmType: AlarmType;
  sound?: string;
  dismissText?: string;
  openText?: string;
}

const NativeModule = requireOptionalNativeModule("ExpoAlarm");
const isAvailable = NativeModule !== null;

export function isNativeModuleAvailable(): boolean {
  return isAvailable;
}

export async function isAlarmKitAvailable(): Promise<boolean> {
  if (!isAvailable) return false;
  return NativeModule.isAlarmKitAvailable();
}

export type BackgroundRefreshStatus = "available" | "denied" | "restricted" | "unknown";

export function getBackgroundRefreshStatus(): BackgroundRefreshStatus {
  if (!isAvailable) return "unknown";
  return NativeModule.getBackgroundRefreshStatus();
}

export async function requestAuthorization(): Promise<AuthorizationStatus> {
  if (!isAvailable) {
    console.warn("[expo-alarm] Native module not available");
    return "denied";
  }
  return NativeModule.requestAuthorization();
}

export async function getAuthorizationStatus(): Promise<AuthorizationStatus> {
  if (!isAvailable) return "denied";
  return NativeModule.getAuthorizationStatus();
}

export async function scheduleAlarm(params: ScheduleAlarmParams): Promise<boolean> {
  if (!isAvailable) {
    console.warn("[expo-alarm] Native module not available");
    return false;
  }

  return NativeModule.scheduleAlarm(
    params.id,
    params.triggerDate.getTime(),
    params.title,
    params.alarmType,
    params.sound ?? "",
    params.dismissText ?? "",
    params.openText ?? ""
  );
}

export async function cancelAlarm(id: string): Promise<boolean> {
  if (!isAvailable) return false;
  return NativeModule.cancelAlarm(id);
}

export async function cancelAllAlarms(): Promise<void> {
  if (!isAvailable) return;
  return NativeModule.cancelAllAlarms();
}

export async function getScheduledAlarmIds(): Promise<string[]> {
  if (!isAvailable) return [];
  return NativeModule.getScheduledAlarmIds();
}

export function markAlarmCompleted(id: string): boolean {
  if (!isAvailable) return false;
  return NativeModule.markAlarmCompleted(id);
}

export function deleteAlarmFromDB(id: string): boolean {
  if (!isAvailable) return false;
  return NativeModule.deleteAlarmFromDB(id);
}

export interface StartLiveActivityParams {
  alarmId: string;
  alarmType: AlarmType;
  title: string;
  triggerDate: Date;
}

export async function startLiveActivity(params: StartLiveActivityParams): Promise<string | null> {
  if (!isAvailable) return null;
  return NativeModule.startLiveActivity(
    params.alarmId,
    params.alarmType,
    params.title,
    params.triggerDate.getTime()
  );
}

export async function updateLiveActivity(
  activityId: string,
  state: "countdown" | "firing" | "snoozed"
): Promise<boolean> {
  if (!isAvailable) return false;
  return NativeModule.updateLiveActivity(activityId, state);
}

export async function endLiveActivity(activityId: string): Promise<boolean> {
  if (!isAvailable) return false;
  return NativeModule.endLiveActivity(activityId);
}

export async function endAllLiveActivities(): Promise<boolean> {
  if (!isAvailable) return false;
  return NativeModule.endAllLiveActivities();
}

export interface PendingChallenge {
  alarmId: string;
  alarmType: string;
  title: string;
  timestamp: number;
}

export async function getPendingChallenge(): Promise<PendingChallenge | null> {
  if (!isAvailable) return null;
  const result = await NativeModule.getPendingChallenge();
  if (!result) return null;
  return {
    alarmId: result.alarmId,
    alarmType: result.alarmType,
    title: result.title,
    timestamp: result.timestamp,
  };
}

export async function clearPendingChallenge(): Promise<boolean> {
  if (!isAvailable) return false;
  return NativeModule.clearPendingChallenge();
}

export async function clearCompletedChallenges(): Promise<boolean> {
  if (!isAvailable) return false;
  return NativeModule.clearCompletedChallenges();
}

// Completed queue (alarms completed via Android overlay, need JS processing)
export interface CompletedAlarm {
  alarmId: string;
  alarmType: string;
  title: string;
  completedAt: number;
}

export async function getCompletedQueue(): Promise<CompletedAlarm[]> {
  if (!isAvailable) return [];
  return NativeModule.getCompletedQueue();
}

export async function clearCompletedQueue(): Promise<boolean> {
  if (!isAvailable) return false;
  return NativeModule.clearCompletedQueue();
}

// Snooze queue (alarms snoozed via Android overlay, need JS processing)
export interface SnoozedAlarm {
  originalAlarmId: string;
  snoozeAlarmId: string;
  alarmType: string;
  title: string;
  snoozeCount: number;
  snoozeEndTime: number;
}

export async function getSnoozeQueue(): Promise<SnoozedAlarm[]> {
  if (!isAvailable) return [];
  return NativeModule.getSnoozeQueue();
}

export async function clearSnoozeQueue(): Promise<boolean> {
  if (!isAvailable) return false;
  return NativeModule.clearSnoozeQueue();
}

export async function cancelAllBackups(): Promise<number> {
  if (!isAvailable) return 0;
  return NativeModule.cancelAllBackups();
}

export async function startAlarmSound(soundName: string = "beep"): Promise<boolean> {
  if (!isAvailable) return false;
  return NativeModule.startAlarmSound(soundName);
}

export async function stopAlarmSound(): Promise<boolean> {
  if (!isAvailable) return false;
  return NativeModule.stopAlarmSound();
}

export function isAlarmSoundPlaying(): boolean {
  if (!isAvailable) return false;
  return NativeModule.isAlarmSoundPlaying();
}

export function stopAllAlarmEffects(): boolean {
  if (!isAvailable) return false;
  return NativeModule.stopAllAlarmEffects();
}

export function setAlarmVolume(volume: number): boolean {
  if (!isAvailable) return false;
  return NativeModule.setAlarmVolume(Math.max(0, Math.min(1, volume)));
}

export function getAlarmVolume(): number {
  if (!isAvailable) return 1.0;
  return NativeModule.getAlarmVolume();
}

export interface AlarmKitAlarm {
  id: string;
  state: string;
  triggerDate?: number;
  scheduleType?: string;
  hour?: number;
  minute?: number;
}

export async function getAlarmKitAlarms(): Promise<AlarmKitAlarm[]> {
  if (!isAvailable) return [];
  return NativeModule.getAlarmKitAlarms();
}

export interface NativeLogEntry {
  timestamp: string;
  category: string;
  level: string;
  message: string;
  error?: string;
}

export async function getNativeLogs(): Promise<NativeLogEntry[]> {
  if (!isAvailable) return [];
  return NativeModule.getNativeLogs();
}

export function getPersistentLog(): string {
  if (!isAvailable) return "";
  return NativeModule.getPersistentLog();
}

export function clearPersistentLog(): boolean {
  if (!isAvailable) return false;
  return NativeModule.clearPersistentLog();
}

export function getNextAlarmTime(): number | null {
  if (!isAvailable) return null;
  return NativeModule.getNextAlarmTime();
}

// Android-specific: battery optimization exemption
export function isBatteryOptimizationExempt(): boolean {
  if (!isAvailable) return false;
  try {
    return NativeModule.isBatteryOptimizationExempt();
  } catch {
    return false;
  }
}

export function requestBatteryOptimizationExemption(): boolean {
  if (!isAvailable) return false;
  try {
    return NativeModule.requestBatteryOptimizationExemption();
  } catch {
    return false;
  }
}

// Android-specific: full-screen intent permission (API 34+)
export function canUseFullScreenIntent(): boolean {
  if (!isAvailable) return true;
  try {
    return NativeModule.canUseFullScreenIntent();
  } catch {
    return true;
  }
}

export function requestFullScreenIntentPermission(): boolean {
  if (!isAvailable) return false;
  try {
    return NativeModule.requestFullScreenIntentPermission();
  } catch {
    return false;
  }
}

// Android-specific: draw over apps (SYSTEM_ALERT_WINDOW)
export function canDrawOverlays(): boolean {
  if (!isAvailable) return true;
  try {
    return NativeModule.canDrawOverlays();
  } catch {
    return true;
  }
}

export function requestDrawOverlaysPermission(): boolean {
  if (!isAvailable) return false;
  try {
    return NativeModule.requestDrawOverlaysPermission();
  } catch {
    return false;
  }
}

// Android-specific: auto-start (OEM-specific)
export function getDeviceManufacturer(): string {
  if (!isAvailable) return "unknown";
  try {
    return NativeModule.getDeviceManufacturer();
  } catch {
    return "unknown";
  }
}

export function hasAutoStartSettings(): boolean {
  if (!isAvailable) return false;
  try {
    return NativeModule.hasAutoStartSettings();
  } catch {
    return false;
  }
}

export function openAutoStartSettings(): boolean {
  if (!isAvailable) return false;
  try {
    return NativeModule.openAutoStartSettings();
  } catch {
    return false;
  }
}

// Native alarm settings (Android only)
export interface NativeAlarmSettings {
  enabled: boolean;
  sound: string;
  volume: number;
  challengeType: "tap" | "math";
  challengeDifficulty: "easy" | "medium" | "hard";
  challengeCount: number;
  gentleWakeUpEnabled: boolean;
  gentleWakeUpDuration: number;
  vibrationEnabled: boolean;
  vibrationPattern: "default" | "gentle" | "aggressive";
  snoozeEnabled: boolean;
  snoozeMaxCount: number;
  snoozeDuration: number;
}

export function openNativeSettings(alarmType: "fajr" | "friday"): boolean {
  if (!isAvailable) return false;
  try {
    return NativeModule.openNativeSettings(alarmType);
  } catch {
    return false;
  }
}

export async function getAlarmSettings(
  alarmType: "fajr" | "friday"
): Promise<NativeAlarmSettings | null> {
  if (!isAvailable) return null;
  try {
    return await NativeModule.getAlarmSettings(alarmType);
  } catch {
    return null;
  }
}

export async function setAlarmSettings(
  alarmType: "fajr" | "friday",
  settings: Partial<NativeAlarmSettings>
): Promise<boolean> {
  if (!isAvailable) return false;
  try {
    return await NativeModule.setAlarmSettings(alarmType, settings);
  } catch {
    return false;
  }
}

export function isAlarmTypeEnabled(alarmType: "fajr" | "friday"): boolean {
  if (!isAvailable) return false;
  try {
    return NativeModule.isAlarmTypeEnabled(alarmType);
  } catch {
    return false;
  }
}

export default {
  isNativeModuleAvailable,
  isAlarmKitAvailable,
  getBackgroundRefreshStatus,
  requestAuthorization,
  getAuthorizationStatus,
  scheduleAlarm,
  cancelAlarm,
  cancelAllAlarms,
  getScheduledAlarmIds,
  markAlarmCompleted,
  deleteAlarmFromDB,
  startLiveActivity,
  updateLiveActivity,
  endLiveActivity,
  endAllLiveActivities,
  getPendingChallenge,
  clearPendingChallenge,
  clearCompletedChallenges,
  getCompletedQueue,
  clearCompletedQueue,
  getSnoozeQueue,
  clearSnoozeQueue,
  cancelAllBackups,
  startAlarmSound,
  stopAlarmSound,
  isAlarmSoundPlaying,
  stopAllAlarmEffects,
  setAlarmVolume,
  getAlarmVolume,
  getAlarmKitAlarms,
  getNativeLogs,
  getPersistentLog,
  clearPersistentLog,
  getNextAlarmTime,
  isBatteryOptimizationExempt,
  requestBatteryOptimizationExemption,
  canUseFullScreenIntent,
  requestFullScreenIntentPermission,
  canDrawOverlays,
  requestDrawOverlaysPermission,
  getDeviceManufacturer,
  hasAutoStartSettings,
  openAutoStartSettings,
  openNativeSettings,
  getAlarmSettings,
  setAlarmSettings,
  isAlarmTypeEnabled,
};
