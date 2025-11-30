/**
 * Shared types for the alarm service layer.
 */

import type { AlarmSettings, AlarmType } from "@/types/alarm";

/**
 * Permission status for alarm functionality.
 */
export type AlarmPermissionStatus = {
  /** Notification permission granted */
  notifications: boolean;
  /** Can schedule exact alarms (Android 12+) */
  exactAlarms: boolean;
  /** Battery optimization exempt (Android) */
  batteryOptimization: boolean;
  /** Can draw overlays for alarm UI (Android) */
  overlay: boolean;
};

/**
 * Translations passed to the native alarm overlay UI (Android only).
 */
export type AlarmOverlayTranslations = {
  /** Main alarm title (e.g., "Fajr Prayer") */
  alarmTitle: string;
  /** Dismiss button text */
  dismiss: string;
  /** Snooze button text with minutes placeholder */
  snoozeWithMinutes: string;
  /** "Sound paused for X seconds" */
  soundPausedFor: string;
  /** "Sound resumes in X seconds" */
  soundResumesIn: string;
  /** "Sound resumed" */
  soundResumed: string;
  /** "Solve X math problems to dismiss" (plural) */
  solveMathProblems: string;
  /** "Solve the math problem to dismiss" (singular) */
  solveMathProblem: string;
  /** "Question X of Y" */
  questionProgress: string;
  /** Input placeholder for answer */
  answer: string;
  /** Submit button text */
  submit: string;
  /** "Wrong answer, try again" */
  wrongAnswer: string;
  /** "Tap the button X times" */
  tapInstruction: string;
  /** Tap button text */
  tap: string;
};

/**
 * Configuration for scheduling an alarm.
 */
export type ScheduleAlarmConfig = {
  /** Unique alarm identifier */
  id: string;
  /** Alarm type (fajr or jummah) */
  type: AlarmType;
  /** When the alarm should fire */
  scheduledTime: Date;
  /** Main title text */
  title: string;
  /** Body/description text */
  body: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Alarm settings (sound, snooze, challenge, etc.) */
  settings: AlarmSettings;
  /** Translations for native overlay UI (Android only) */
  translations?: AlarmOverlayTranslations;
};

/**
 * Platform feature flags for alarm functionality.
 */
export const ALARM_FEATURES = {
  /** Challenge support (Android only - iOS uses native AlarmKit UI) */
  challenges: true, // Platform check done at runtime
  /** Native system UI for alarm (iOS AlarmKit) */
  systemUI: false, // Platform check done at runtime
  /** Overlay support for when app is killed (Android) */
  overlay: true, // Platform check done at runtime
  /** Grace period before challenge starts (Android) */
  gracePeriod: true, // Platform check done at runtime
} as const;
