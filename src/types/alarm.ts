export type AlarmType = "fajr" | "friday";

export type TimingMode = "atPrayerTime" | "beforePrayerTime";

export type ChallengeType = "tap" | "math" | "none";

export type ChallengeDifficulty = "easy" | "medium" | "hard";

export type VibrationPattern = "default" | "gentle" | "aggressive";

export type GentleWakeUpDuration = 1 | 3 | 5;

export type SnoozeDuration = 1 | 3 | 5 | 10;

export type SnoozeMaxCount = 1 | 2 | 3;

export type ChallengeCount = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface ChallengeConfig {
  type: ChallengeType;
  difficulty: ChallengeDifficulty;
  count: ChallengeCount;
}

export interface GentleWakeUpConfig {
  enabled: boolean;
  durationMinutes: GentleWakeUpDuration;
}

export interface VibrationConfig {
  enabled: boolean;
  pattern: VibrationPattern;
}

export interface SnoozeConfig {
  enabled: boolean;
  maxCount: SnoozeMaxCount;
  durationMinutes: SnoozeDuration;
}

export interface TimingConfig {
  mode: TimingMode;
  minutesBefore: number;
}

export interface AlarmTypeSettings {
  enabled: boolean;
  sound: string;
  volume: number;
  timing: TimingConfig;
  challenge: ChallengeConfig;
  gentleWakeUp: GentleWakeUpConfig;
  vibration: VibrationConfig;
  snooze: SnoozeConfig;
}

export interface AlarmSettings {
  fajr: AlarmTypeSettings;
  friday: AlarmTypeSettings;
}

export const DEFAULT_CHALLENGE_CONFIG: ChallengeConfig = {
  type: "tap",
  difficulty: "easy",
  count: 1,
};

export const DEFAULT_GENTLE_WAKEUP_CONFIG: GentleWakeUpConfig = {
  enabled: false,
  durationMinutes: 3,
};

export const DEFAULT_VIBRATION_CONFIG: VibrationConfig = {
  enabled: true,
  pattern: "default",
};

export const DEFAULT_SNOOZE_CONFIG: SnoozeConfig = {
  enabled: true,
  maxCount: 3,
  durationMinutes: 5,
};

export const DEFAULT_TIMING_CONFIG: TimingConfig = {
  mode: "atPrayerTime",
  minutesBefore: 0,
};

export const DEFAULT_ALARM_TYPE_SETTINGS: AlarmTypeSettings = {
  enabled: false,
  sound: "beep",
  volume: 1.0,
  timing: DEFAULT_TIMING_CONFIG,
  challenge: DEFAULT_CHALLENGE_CONFIG,
  gentleWakeUp: DEFAULT_GENTLE_WAKEUP_CONFIG,
  vibration: DEFAULT_VIBRATION_CONFIG,
  snooze: DEFAULT_SNOOZE_CONFIG,
};

export const TIMING_WINDOW_MINUTES = {
  fajr: 90,
  friday: 120,
} as const;

export const CHALLENGE_DIFFICULTY_CONFIG = {
  tap: {
    easy: { taps: 5 },
    medium: { taps: 10 },
    hard: { taps: 20 },
  },
  math: {
    easy: { maxNumber: 10, operations: ["+", "-"] as const },
    medium: { maxNumber: 50, operations: ["+", "-"] as const },
    hard: { maxNumber: 100, operations: ["+", "-", "*"] as const },
  },
} as const;

export const VIBRATION_PATTERNS = {
  default: [0, 800, 200, 800, 200, 800, 200, 800],
  gentle: [0, 400, 400, 400, 400, 400],
  aggressive: [0, 1000, 100, 1000, 100, 1000, 100, 1000],
} as const;

export const GENTLE_WAKEUP_DURATIONS: GentleWakeUpDuration[] = [1, 3, 5];

export const SNOOZE_DURATIONS: SnoozeDuration[] = [1, 3, 5, 10];

export const SNOOZE_MAX_COUNTS: SnoozeMaxCount[] = [1, 2, 3];

export const CHALLENGE_COUNTS: ChallengeCount[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const CHALLENGE_TYPES: ChallengeType[] = ["none", "tap", "math"];

export const CHALLENGE_DIFFICULTIES: ChallengeDifficulty[] = ["easy", "medium", "hard"];

export const GRACE_PERIOD_SECONDS: Record<
  Exclude<ChallengeType, "none">,
  Record<ChallengeDifficulty, number>
> = {
  tap: { easy: 10, medium: 15, hard: 20 },
  math: { easy: 15, medium: 20, hard: 30 },
};
