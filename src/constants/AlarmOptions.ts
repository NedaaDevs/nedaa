import type { AlarmChallengeType, MathDifficulty } from "@/types/alarm";

// Snooze duration options in minutes (no "off" option - snooze is always enabled)
export const SNOOZE_DURATIONS = [1, 3, 5, 10, 15] as const;

// Challenge types
export const CHALLENGE_TYPES: AlarmChallengeType[] = ["none", "math", "tap"];

// Math difficulty options
export const MATH_DIFFICULTIES: MathDifficulty[] = ["easy", "medium", "hard"];

// Math question count options
export const MATH_QUESTION_COUNTS = [1, 2, 3, 5] as const;

// Tap count options
export const TAP_COUNTS = [10, 20, 30, 50] as const;

// Grace period options in seconds
export const GRACE_PERIODS = [10, 15, 30, 60] as const;

// Offset options in minutes (negative = before prayer, positive = after)
export const OFFSET_OPTIONS = [-60, -30, -15, 0, 10] as const;
