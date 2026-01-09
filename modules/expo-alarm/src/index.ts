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
    params.sound ?? null
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
  addAlarmFiredListener,
};
