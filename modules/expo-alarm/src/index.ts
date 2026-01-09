import { requireOptionalNativeModule, EventEmitter } from "expo-modules-core";

// Types
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

export interface AlarmFiredEvent {
  id: string;
  action: "fired" | "dismissed" | "snoozed";
  alarmType: AlarmType;
}

// Native module (optional - returns null in Expo Go)
const NativeModule = requireOptionalNativeModule("ExpoAlarm");
const isAvailable = NativeModule !== null;

// Event emitter for alarm events
const emitter = isAvailable ? new EventEmitter(NativeModule) : null;

/**
 * Check if the native alarm module is available
 * Returns false in Expo Go
 */
export function isNativeModuleAvailable(): boolean {
  return isAvailable;
}

/**
 * Check if AlarmKit is available (iOS 26+)
 */
export async function isAlarmKitAvailable(): Promise<boolean> {
  if (!isAvailable) return false;
  return NativeModule.isAlarmKitAvailable();
}

/**
 * Request alarm authorization from the user
 * @returns Authorization status after request
 */
export async function requestAuthorization(): Promise<AuthorizationStatus> {
  if (!isAvailable) {
    console.warn("[expo-alarm] Native module not available");
    return "denied";
  }
  return NativeModule.requestAuthorization();
}

/**
 * Get current authorization status without prompting
 */
export async function getAuthorizationStatus(): Promise<AuthorizationStatus> {
  if (!isAvailable) return "denied";
  return NativeModule.getAuthorizationStatus();
}

/**
 * Schedule an alarm
 */
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

/**
 * Cancel a scheduled alarm by ID
 */
export async function cancelAlarm(id: string): Promise<boolean> {
  if (!isAvailable) return false;
  return NativeModule.cancelAlarm(id);
}

/**
 * Cancel all scheduled alarms
 */
export async function cancelAllAlarms(): Promise<void> {
  if (!isAvailable) return;
  return NativeModule.cancelAllAlarms();
}

/**
 * Get list of scheduled alarm IDs
 */
export async function getScheduledAlarmIds(): Promise<string[]> {
  if (!isAvailable) return [];
  return NativeModule.getScheduledAlarmIds();
}

// MARK: - Shared Database (for widget communication)

/**
 * Mark alarm as completed in shared database
 * This is used by the widget to check if alarm should re-trigger
 */
export function markAlarmCompleted(id: string): boolean {
  if (!isAvailable) return false;
  return NativeModule.markAlarmCompleted(id);
}

/**
 * Delete alarm from shared database
 */
export function deleteAlarmFromDB(id: string): boolean {
  if (!isAvailable) return false;
  return NativeModule.deleteAlarmFromDB(id);
}

/**
 * Listen for alarm fired events
 */
export function addAlarmFiredListener(callback: (event: AlarmFiredEvent) => void): {
  remove: () => void;
} {
  if (!emitter) {
    return { remove: () => {} };
  }
  const subscription = emitter.addListener("onAlarmFired", callback);
  return { remove: () => subscription.remove() };
}

// MARK: - Live Activity

export interface StartLiveActivityParams {
  alarmId: string;
  alarmType: AlarmType;
  title: string;
  triggerDate: Date;
}

/**
 * Start a Live Activity for the alarm (iOS 16.1+)
 * @returns Activity ID or null if not supported
 */
export async function startLiveActivity(params: StartLiveActivityParams): Promise<string | null> {
  if (!isAvailable) return null;
  return NativeModule.startLiveActivity(
    params.alarmId,
    params.alarmType,
    params.title,
    params.triggerDate.getTime()
  );
}

/**
 * Update a Live Activity state
 */
export async function updateLiveActivity(
  activityId: string,
  state: "countdown" | "firing"
): Promise<boolean> {
  if (!isAvailable) return false;
  return NativeModule.updateLiveActivity(activityId, state);
}

/**
 * End a specific Live Activity
 */
export async function endLiveActivity(activityId: string): Promise<boolean> {
  if (!isAvailable) return false;
  return NativeModule.endLiveActivity(activityId);
}

/**
 * End all alarm Live Activities
 */
export async function endAllLiveActivities(): Promise<boolean> {
  if (!isAvailable) return false;
  return NativeModule.endAllLiveActivities();
}

// Re-export for convenience
export default {
  isNativeModuleAvailable,
  isAlarmKitAvailable,
  requestAuthorization,
  getAuthorizationStatus,
  scheduleAlarm,
  cancelAlarm,
  cancelAllAlarms,
  getScheduledAlarmIds,
  markAlarmCompleted,
  deleteAlarmFromDB,
  addAlarmFiredListener,
  startLiveActivity,
  updateLiveActivity,
  endLiveActivity,
  endAllLiveActivities,
};
