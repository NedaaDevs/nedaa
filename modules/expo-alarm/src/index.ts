import {
  requireOptionalNativeModule,
  EventEmitter,
  type EventSubscription,
} from "expo-modules-core";

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
  // iOS only: present a live countdown (Dynamic Island / lock screen) before the
  // alarm fires. Used by the preview alarm; ignored on Android.
  countdown?: boolean;
}

const NativeModule = requireOptionalNativeModule("ExpoAlarm");
const isAvailable = NativeModule !== null;
// Events the native module declares with `Events(...)`.
type ExpoAlarmEvents = {
  onPlaybackFinished: () => void;
};

const emitter = NativeModule ? new EventEmitter<ExpoAlarmEvents>(NativeModule) : null;

export const addListener = <EventName extends keyof ExpoAlarmEvents>(
  eventName: EventName,
  listener: ExpoAlarmEvents[EventName]
): EventSubscription => {
  if (!emitter) {
    return { remove: () => {} };
  }
  return emitter.addListener(eventName, listener);
};

export const isNativeModuleAvailable = (): boolean => {
  return isAvailable;
};

export const isAlarmKitAvailable = async (): Promise<boolean> => {
  if (!isAvailable) return false;
  return NativeModule.isAlarmKitAvailable();
};

export type BackgroundRefreshStatus = "available" | "denied" | "restricted" | "unknown";

export const getBackgroundRefreshStatus = (): BackgroundRefreshStatus => {
  if (!isAvailable) return "unknown";
  return NativeModule.getBackgroundRefreshStatus();
};

export const requestAuthorization = async (): Promise<AuthorizationStatus> => {
  if (!isAvailable) {
    console.warn("[expo-alarm] Native module not available");
    return "denied";
  }
  return NativeModule.requestAuthorization();
};

export const getAuthorizationStatus = async (): Promise<AuthorizationStatus> => {
  if (!isAvailable) return "denied";
  return NativeModule.getAuthorizationStatus();
};

export const scheduleAlarm = async (params: ScheduleAlarmParams): Promise<boolean> => {
  if (!isAvailable) {
    console.warn("[expo-alarm] Native module not available");
    return false;
  }

  return NativeModule.scheduleAlarm({
    id: params.id,
    triggerTimestamp: params.triggerDate.getTime(),
    title: params.title,
    alarmType: params.alarmType,
    sound: params.sound ?? "",
    dismissText: params.dismissText ?? "",
    openText: params.openText ?? "",
    countdown: params.countdown ?? false,
  });
};

export const cancelAlarm = async (id: string): Promise<boolean> => {
  if (!isAvailable) return false;
  return NativeModule.cancelAlarm(id);
};

export const cancelAllAlarms = async (): Promise<void> => {
  if (!isAvailable) return;
  return NativeModule.cancelAllAlarms();
};

export const getScheduledAlarmIds = async (): Promise<string[]> => {
  if (!isAvailable) return [];
  return NativeModule.getScheduledAlarmIds();
};

export const markAlarmCompleted = (id: string): boolean => {
  if (!isAvailable) return false;
  return NativeModule.markAlarmCompleted(id);
};

export const deleteAlarmFromDB = (id: string): boolean => {
  if (!isAvailable) return false;
  return NativeModule.deleteAlarmFromDB(id);
};

export interface StartLiveActivityParams {
  alarmId: string;
  alarmType: AlarmType;
  title: string;
  triggerDate: Date;
  state?: "countdown" | "snoozed";
}

export const startLiveActivity = async (
  params: StartLiveActivityParams
): Promise<string | null> => {
  if (!isAvailable) return null;
  return NativeModule.startLiveActivity(
    params.alarmId,
    params.alarmType,
    params.title,
    params.triggerDate.getTime(),
    params.state ?? "countdown"
  );
};

export const updateLiveActivity = async (
  activityId: string,
  state: "countdown" | "firing" | "snoozed"
): Promise<boolean> => {
  if (!isAvailable) return false;
  return NativeModule.updateLiveActivity(activityId, state);
};

export const endLiveActivity = async (activityId: string): Promise<boolean> => {
  if (!isAvailable) return false;
  return NativeModule.endLiveActivity(activityId);
};

export const endAllLiveActivities = async (): Promise<boolean> => {
  if (!isAvailable) return false;
  return NativeModule.endAllLiveActivities();
};

export interface PendingChallenge {
  alarmId: string;
  alarmType: string;
  title: string;
  timestamp: number;
}

export const getPendingChallenge = async (): Promise<PendingChallenge | null> => {
  if (!isAvailable) return null;
  const result = await NativeModule.getPendingChallenge();
  if (!result) return null;
  return {
    alarmId: result.alarmId,
    alarmType: result.alarmType,
    title: result.title,
    timestamp: result.timestamp,
  };
};

export const clearPendingChallenge = async (): Promise<boolean> => {
  if (!isAvailable) return false;
  return NativeModule.clearPendingChallenge();
};

export const clearCompletedChallenges = async (): Promise<boolean> => {
  if (!isAvailable) return false;
  return NativeModule.clearCompletedChallenges();
};

// Ids of alarms flagged completed — the cross-platform record that an alarm finished,
// cleared when the id is scheduled again. The Android completed queue is narrower: the
// work list of overlay completions still awaiting recurrence rescheduling.
export const getCompletedAlarmIds = async (): Promise<string[]> => {
  if (!isAvailable) return [];
  return NativeModule.getCompletedAlarmIds();
};

// Completed queue (alarms completed via Android overlay, need JS processing)
export interface CompletedAlarm {
  id: number;
  alarmId: string;
  alarmType: string;
  title: string;
  completedAt: number;
}

export const getCompletedQueue = async (): Promise<CompletedAlarm[]> => {
  if (!isAvailable) return [];
  return NativeModule.getCompletedQueue();
};

// Clears the given queue row ids so concurrent overlay inserts survive to the
// next drain. Falls back to clearing the whole table if the native module
// predates the id-scoped variant, or when no ids are supplied.
export const clearCompletedQueue = async (ids?: number[]): Promise<boolean> => {
  if (!isAvailable) return false;
  if (ids && ids.length > 0) {
    try {
      return await NativeModule.clearCompletedQueueByIds(ids);
    } catch {
      return NativeModule.clearCompletedQueue();
    }
  }
  return NativeModule.clearCompletedQueue();
};

// Snooze queue (alarms snoozed via Android overlay, need JS processing)
export interface SnoozedAlarm {
  id: number;
  originalAlarmId: string;
  snoozeAlarmId: string;
  alarmType: string;
  title: string;
  snoozeCount: number;
  snoozeEndTime: number;
}

export const getSnoozeQueue = async (): Promise<SnoozedAlarm[]> => {
  if (!isAvailable) return [];
  return NativeModule.getSnoozeQueue();
};

// Clears the given queue row ids so concurrent overlay inserts survive to the
// next drain. Falls back to clearing the whole table if the native module
// predates the id-scoped variant, or when no ids are supplied.
export const clearSnoozeQueue = async (ids?: number[]): Promise<boolean> => {
  if (!isAvailable) return false;
  if (ids && ids.length > 0) {
    try {
      return await NativeModule.clearSnoozeQueueByIds(ids);
    } catch {
      return NativeModule.clearSnoozeQueue();
    }
  }
  return NativeModule.clearSnoozeQueue();
};

export const cancelAllBackups = async (): Promise<number> => {
  if (!isAvailable) return 0;
  return NativeModule.cancelAllBackups();
};

export const startAlarmSound = async (soundName: string = "beep"): Promise<boolean> => {
  if (!isAvailable) return false;
  return NativeModule.startAlarmSound(soundName);
};

export const stopAlarmSound = async (): Promise<boolean> => {
  if (!isAvailable) return false;
  return NativeModule.stopAlarmSound();
};

export const isAlarmSoundPlaying = (): boolean => {
  if (!isAvailable) return false;
  return NativeModule.isAlarmSoundPlaying();
};

export const stopAllAlarmEffects = (): boolean => {
  if (!isAvailable) return false;
  return NativeModule.stopAllAlarmEffects();
};

export const setAlarmVolume = (volume: number): boolean => {
  if (!isAvailable) return false;
  return NativeModule.setAlarmVolume(Math.max(0, Math.min(1, volume)));
};

export const getAlarmVolume = (): number => {
  if (!isAvailable) return 1.0;
  return NativeModule.getAlarmVolume();
};

export const saveSystemVolume = (): boolean => {
  if (!isAvailable) return false;
  try {
    return NativeModule.saveSystemVolume();
  } catch {
    return false;
  }
};

export const restoreSystemVolume = (): boolean => {
  if (!isAvailable) return false;
  try {
    return NativeModule.restoreSystemVolume();
  } catch {
    return false;
  }
};

export interface AlarmKitAlarm {
  id: string;
  state: string;
  triggerDate?: number;
  scheduleType?: string;
  hour?: number;
  minute?: number;
}

export const getAlarmKitAlarms = async (): Promise<AlarmKitAlarm[]> => {
  if (!isAvailable) return [];
  return NativeModule.getAlarmKitAlarms();
};

export interface NativeLogEntry {
  timestamp: string;
  category: string;
  level: string;
  message: string;
  error?: string;
}

export const getNativeLogs = async (): Promise<NativeLogEntry[]> => {
  if (!isAvailable) return [];
  return NativeModule.getNativeLogs();
};

export const getPersistentLog = (): string => {
  if (!isAvailable) return "";
  return NativeModule.getPersistentLog();
};

export const clearPersistentLog = (): boolean => {
  if (!isAvailable) return false;
  return NativeModule.clearPersistentLog();
};

export const getNextAlarmTime = (): number | null => {
  if (!isAvailable) return null;
  return NativeModule.getNextAlarmTime();
};

// Android-specific: battery optimization exemption
export const isBatteryOptimizationExempt = (): boolean => {
  if (!isAvailable) return false;
  try {
    return NativeModule.isBatteryOptimizationExempt();
  } catch {
    return false;
  }
};

export const requestBatteryOptimizationExemption = (): boolean => {
  if (!isAvailable) return false;
  try {
    return NativeModule.requestBatteryOptimizationExemption();
  } catch {
    return false;
  }
};

// Android-specific: exact alarm permission (API 31+)
export const canScheduleExactAlarms = (): boolean => {
  if (!isAvailable) return true;
  try {
    return NativeModule.canScheduleExactAlarms();
  } catch {
    return true;
  }
};

export const requestExactAlarmPermission = (): boolean => {
  if (!isAvailable) return false;
  try {
    return NativeModule.requestExactAlarmPermission();
  } catch {
    return false;
  }
};

// Android-specific: full-screen intent permission (API 34+)
export const canUseFullScreenIntent = (): boolean => {
  if (!isAvailable) return true;
  try {
    return NativeModule.canUseFullScreenIntent();
  } catch {
    return true;
  }
};

export const requestFullScreenIntentPermission = (): boolean => {
  if (!isAvailable) return false;
  try {
    return NativeModule.requestFullScreenIntentPermission();
  } catch {
    return false;
  }
};

// Android-specific: draw over apps (SYSTEM_ALERT_WINDOW)
export const canDrawOverlays = (): boolean => {
  if (!isAvailable) return true;
  try {
    return NativeModule.canDrawOverlays();
  } catch {
    return true;
  }
};

export const requestDrawOverlaysPermission = (): boolean => {
  if (!isAvailable) return false;
  try {
    return NativeModule.requestDrawOverlaysPermission();
  } catch {
    return false;
  }
};

// Android-specific: auto-start (OEM-specific)
export const getDeviceManufacturer = (): string => {
  if (!isAvailable) return "unknown";
  try {
    return NativeModule.getDeviceManufacturer();
  } catch {
    return "unknown";
  }
};

export const hasAutoStartSettings = (): boolean => {
  if (!isAvailable) return false;
  try {
    return NativeModule.hasAutoStartSettings();
  } catch {
    return false;
  }
};

export const openAutoStartSettings = (): boolean => {
  if (!isAvailable) return false;
  try {
    return NativeModule.openAutoStartSettings();
  } catch {
    return false;
  }
};

// Challenge values the native overlay reads from stored alarm settings.
export const CHALLENGE_TYPE = {
  NONE: "none",
  TAP: "tap",
  MATH: "math",
  DHIKR: "dhikr",
} as const;

export type ChallengeType = (typeof CHALLENGE_TYPE)[keyof typeof CHALLENGE_TYPE];

export const CHALLENGE_DIFFICULTY = {
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard",
} as const;

export type ChallengeDifficulty = (typeof CHALLENGE_DIFFICULTY)[keyof typeof CHALLENGE_DIFFICULTY];

// Native alarm settings (Android only)
export interface NativeAlarmSettings {
  enabled: boolean;
  sound: string;
  volume: number;
  challengeType: ChallengeType;
  challengeDifficulty: ChallengeDifficulty;
  challengeCount: number;
  gentleWakeUpEnabled: boolean;
  gentleWakeUpDuration: number;
  vibrationEnabled: boolean;
  vibrationPattern: "default" | "gentle" | "aggressive";
  snoozeEnabled: boolean;
  snoozeMaxCount: number;
  snoozeDuration: number;
}

export const openNativeSettings = (alarmType: "fajr" | "jummah"): boolean => {
  if (!isAvailable) return false;
  try {
    return NativeModule.openNativeSettings(alarmType);
  } catch {
    return false;
  }
};

export const getAlarmSettings = async (
  alarmType: "fajr" | "jummah"
): Promise<NativeAlarmSettings | null> => {
  if (!isAvailable) return null;
  try {
    return await NativeModule.getAlarmSettings(alarmType);
  } catch {
    return null;
  }
};

export const setAlarmSettings = async (
  alarmType: "fajr" | "jummah",
  settings: Partial<NativeAlarmSettings>
): Promise<boolean> => {
  if (!isAvailable) return false;
  try {
    return await NativeModule.setAlarmSettings(alarmType, settings);
  } catch {
    return false;
  }
};

export const isAlarmTypeEnabled = (alarmType: "fajr" | "jummah"): boolean => {
  if (!isAvailable) return false;
  try {
    return NativeModule.isAlarmTypeEnabled(alarmType);
  } catch {
    return false;
  }
};

// System alarm sounds
export interface SystemSound {
  id: string; // URI string for system sounds, resource name for bundled
  name: string; // Display name
  isSystem: boolean;
}

export const getSystemAlarmSounds = async (): Promise<SystemSound[]> => {
  if (!isAvailable) return [];
  try {
    const sounds = await NativeModule.getSystemAlarmSounds();
    return sounds.map((s: { id: string; name: string; isSystem: string }) => ({
      id: s.id,
      name: s.name,
      isSystem: s.isSystem === "true",
    }));
  } catch {
    return [];
  }
};

// -- Athan Playback Service (Android) --

export interface ScheduleAthanParams {
  id: string;
  triggerDate: Date;
  prayerId: string;
  soundName: string;
  title: string;
  stopLabel: string;
}

export const scheduleAthan = async (params: ScheduleAthanParams): Promise<boolean> => {
  if (!isAvailable) return false;
  try {
    return await NativeModule.scheduleAthan(
      params.id,
      params.triggerDate.getTime(),
      params.prayerId,
      params.soundName,
      params.title,
      params.stopLabel
    );
  } catch {
    return false;
  }
};

export const cancelAthan = async (id: string): Promise<boolean> => {
  if (!isAvailable) return false;
  try {
    return await NativeModule.cancelAthan(id);
  } catch {
    return false;
  }
};

export const cancelAllAthans = async (ids: string[]): Promise<boolean> => {
  if (!isAvailable) return false;
  try {
    return await NativeModule.cancelAllAthans(ids);
  } catch {
    return false;
  }
};

export const stopAthan = (): boolean => {
  if (!isAvailable) return false;
  try {
    return NativeModule.stopAthan();
  } catch {
    return false;
  }
};

export const isAthanPlaying = (): boolean => {
  if (!isAvailable) return false;
  try {
    return NativeModule.isAthanPlaying();
  } catch {
    return false;
  }
};

export const setAthanAudioStream = (stream: "media" | "ringer"): boolean => {
  if (!isAvailable) return false;
  try {
    return NativeModule.setAthanAudioStream(stream);
  } catch {
    return false;
  }
};

export const setIqamaAudioStream = (stream: "media" | "ringer"): boolean => {
  if (!isAvailable) return false;
  try {
    return NativeModule.setIqamaAudioStream(stream);
  } catch {
    return false;
  }
};

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
  getCompletedAlarmIds,
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
  saveSystemVolume,
  restoreSystemVolume,
  getAlarmKitAlarms,
  getNativeLogs,
  getPersistentLog,
  clearPersistentLog,
  getNextAlarmTime,
  isBatteryOptimizationExempt,
  requestBatteryOptimizationExemption,
  canScheduleExactAlarms,
  requestExactAlarmPermission,
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
  getSystemAlarmSounds,
  scheduleAthan,
  cancelAthan,
  cancelAllAthans,
  stopAthan,
  isAthanPlaying,
  setAthanAudioStream,
  setIqamaAudioStream,
};
