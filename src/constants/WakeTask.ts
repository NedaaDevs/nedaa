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

export type WakeTaskOptions = { hasDifficulty: boolean; hasSteps: boolean };

/** The options each board offers; the task type is derived from it. */
export const WAKE_TASK_OPTIONS = {
  [WAKE_TASK_ID.MATH]: { hasDifficulty: true, hasSteps: true },
  [WAKE_TASK_ID.PATTERN]: { hasDifficulty: true, hasSteps: true },
  [WAKE_TASK_ID.DHIKR]: { hasDifficulty: false, hasSteps: true },
  [WAKE_TASK_ID.PRAYERS]: { hasDifficulty: false, hasSteps: false },
  [WAKE_TASK_ID.TAP]: { hasDifficulty: false, hasSteps: false },
} as const satisfies Record<WakeTaskId, WakeTaskOptions>;

/** The most tasks one alarm asks for, in order. */
export const WAKE_TASK_MAX_STACK = 3;

/** Which way a task moves in its stack. */
export const WAKE_TASK_MOVE = { UP: "up", DOWN: "down" } as const;

export type WakeTaskMove = (typeof WAKE_TASK_MOVE)[keyof typeof WAKE_TASK_MOVE];

/** The step counts a board with steps offers. */
export const WAKE_TASK_STEP_CHOICES = [1, 2, 3, 4, 5] as const;

export type WakeTaskSteps = (typeof WAKE_TASK_STEP_CHOICES)[number];

export const WAKE_TASK_MIN_STEPS: WakeTaskSteps = WAKE_TASK_STEP_CHOICES[0];

export const WAKE_TASK_MAX_STEPS: WakeTaskSteps =
  WAKE_TASK_STEP_CHOICES[WAKE_TASK_STEP_CHOICES.length - 1];

export const WAKE_TASK_DEFAULT_DIFFICULTY: ChallengeDifficulty = CHALLENGE_DIFFICULTY.EASY;

export const WAKE_TASK_DEFAULT_STEPS: WakeTaskSteps = WAKE_TASK_MIN_STEPS;

/** The stack the default tap challenge maps to. */
export const DEFAULT_WAKE_TASKS: readonly WakeTask[] = [{ id: WAKE_TASK_ID.TAP }];
