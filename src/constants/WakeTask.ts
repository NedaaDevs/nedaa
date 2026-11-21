import { CHALLENGE_DIFFICULTY } from "expo-alarm";

import type { ChallengeDifficulty, WakeTask } from "@/types/alarm";

/** Persisted board ids, in display order; renaming one drops a saved task. */
export const WAKE_TASK_ID = {
  TAP: "tap",
  MATH: "math",
  PATTERN: "pattern",
  DHIKR: "dhikr",
  PRAYERS: "prayers",
} as const;

export type WakeTaskId = (typeof WAKE_TASK_ID)[keyof typeof WAKE_TASK_ID];

export const WAKE_TASK_IDS: readonly WakeTaskId[] = Object.values(WAKE_TASK_ID);

/** The step counts a board with steps offers, unless it has its own. */
export const WAKE_TASK_STEP_CHOICES = [1, 2, 3, 4, 5] as const;

export type WakeTaskSteps = (typeof WAKE_TASK_STEP_CHOICES)[number];

export const WAKE_TASK_MIN_STEPS: WakeTaskSteps = WAKE_TASK_STEP_CHOICES[0];

/** The counts a 2.x challenge saved; Math offers each as its steps. */
export const CHALLENGE_COUNTS = [...WAKE_TASK_STEP_CHOICES, 6, 7, 8, 9, 10] as const;

export type ChallengeCount = (typeof CHALLENGE_COUNTS)[number];

/** A board's step counts, ascending and whole; null when it has no steps. */
export type WakeTaskOptions = {
  hasDifficulty: boolean;
  stepChoices: readonly [number, ...number[]] | null;
};

/** The options each board offers; the task type is derived from it. */
export const WAKE_TASK_OPTIONS = {
  [WAKE_TASK_ID.MATH]: { hasDifficulty: true, stepChoices: CHALLENGE_COUNTS },
  [WAKE_TASK_ID.PATTERN]: { hasDifficulty: true, stepChoices: WAKE_TASK_STEP_CHOICES },
  [WAKE_TASK_ID.DHIKR]: { hasDifficulty: false, stepChoices: WAKE_TASK_STEP_CHOICES },
  [WAKE_TASK_ID.PRAYERS]: { hasDifficulty: false, stepChoices: null },
  [WAKE_TASK_ID.TAP]: { hasDifficulty: false, stepChoices: null },
} as const satisfies Record<WakeTaskId, WakeTaskOptions>;

/** The most tasks one alarm asks for, in order. */
export const WAKE_TASK_MAX_STACK = 3;

/** Which way a task moves in its stack. */
export const WAKE_TASK_MOVE = { UP: "up", DOWN: "down" } as const;

export type WakeTaskMove = (typeof WAKE_TASK_MOVE)[keyof typeof WAKE_TASK_MOVE];

export const WAKE_TASK_DEFAULT_DIFFICULTY: ChallengeDifficulty = CHALLENGE_DIFFICULTY.EASY;

export const WAKE_TASK_DEFAULT_STEPS: WakeTaskSteps = WAKE_TASK_MIN_STEPS;

/** The stack the default tap challenge maps to. */
export const DEFAULT_WAKE_TASKS: readonly WakeTask[] = [{ id: WAKE_TASK_ID.TAP }];
