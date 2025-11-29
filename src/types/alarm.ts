// Types
import type { PrayerSoundKey } from "@/constants/sounds";

export type AlarmType = "fajr" | "jummah";

export type AlarmTimeMode = "dynamic" | "fixed";

export type AlarmChallengeType = "none" | "math" | "tap";

export type MathDifficulty = "easy" | "medium" | "hard";

export type AlarmSettings = {
  enabled: boolean;
  hasCompletedSetup: boolean;

  // Time configuration
  timeMode: AlarmTimeMode;
  fixedHour?: number; // 0-23, for fixed mode
  fixedMinute?: number; // 0-59, for fixed mode
  offsetMinutes: number; // -60 to +30, for dynamic mode

  // Sound & volume
  sound: PrayerSoundKey;
  volume: number; // 0.0 - 1.0
  gradualVolume: boolean; // Ramp up over time
  gradualVolumeDurationSec: number; // How long to ramp (default 30)

  // Behavior
  vibration: boolean;
  overrideDnd: boolean; // Android only - override Do Not Disturb

  // Snooze
  snoozeEnabled: boolean;
  snoozeDurationMinutes: number; // 5, 10, 15, etc.
  maxSnoozeCount: number; // How many times can snooze (0 = unlimited)

  // Challenge
  challengeEnabled: boolean;
  challengeType: AlarmChallengeType;
  mathDifficulty: MathDifficulty;
  mathQuestionCount: number; // How many math problems (default 1)
  tapCount: number; // For tap challenge (default 10)
  challengeGracePeriodSec: number; // Seconds of silence while solving (default 15)
};

export const DEFAULT_FAJR_ALARM_SETTINGS: AlarmSettings = {
  enabled: false,
  hasCompletedSetup: false,
  timeMode: "dynamic",
  fixedHour: 5,
  fixedMinute: 0,
  offsetMinutes: 0,
  sound: "makkahAthan1",
  volume: 0.8,
  gradualVolume: true,
  gradualVolumeDurationSec: 30,
  vibration: true,
  overrideDnd: false,
  snoozeEnabled: true,
  snoozeDurationMinutes: 5,
  maxSnoozeCount: 3,
  challengeEnabled: false,
  challengeType: "none",
  mathDifficulty: "easy",
  mathQuestionCount: 1,
  tapCount: 10,
  challengeGracePeriodSec: 15,
};

export const DEFAULT_JUMMAH_ALARM_SETTINGS: AlarmSettings = {
  enabled: false,
  hasCompletedSetup: false,
  timeMode: "dynamic",
  fixedHour: 12,
  fixedMinute: 0,
  offsetMinutes: -30, // 30 minutes before Jummah by default
  sound: "makkahAthan1",
  volume: 0.8,
  gradualVolume: true,
  gradualVolumeDurationSec: 30,
  vibration: true,
  overrideDnd: false,
  snoozeEnabled: true,
  snoozeDurationMinutes: 5,
  maxSnoozeCount: 3,
  challengeEnabled: false,
  challengeType: "none",
  mathDifficulty: "easy",
  mathQuestionCount: 1,
  tapCount: 10,
  challengeGracePeriodSec: 15,
};

// ==========================================
// ALARM STORE STATE
// ==========================================

export type AlarmStoreState = {
  // Settings for each alarm type
  fajrAlarm: AlarmSettings;
  jummahAlarm: AlarmSettings;

  // Scheduled alarm IDs (for cancellation)
  scheduledFajrAlarmId: string | null;
  scheduledJummahAlarmId: string | null;

  // Last scheduled times (for rescheduling detection)
  lastScheduledDate: string | null;
};

// ==========================================
// ALARM STORE ACTIONS
// ==========================================

export type AlarmStoreActions = {
  setFajrAlarmEnabled: (enabled: boolean) => Promise<void>;
  updateFajrAlarmSettings: (settings: Partial<AlarmSettings>) => Promise<void>;
  setJummahAlarmEnabled: (enabled: boolean) => Promise<void>;
  updateJummahAlarmSettings: (settings: Partial<AlarmSettings>) => Promise<void>;
  markSetupCompleted: (type: AlarmType) => void;
  scheduleAllAlarms: () => Promise<void>;
  rescheduleIfNeeded: (force?: boolean) => Promise<void>;
};
