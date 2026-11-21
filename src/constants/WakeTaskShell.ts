import { WAKE_TASK_ID, type WakeTaskId } from "@/constants/WakeTask";

/** How long sound and vibration pause as a task opens or after a solve. */
export const QUIET_TIME_SECONDS = { DEFAULT: 30, SCREEN_READER: 60 } as const;

/** The last stretch of quiet time, warned once before the sound returns. */
export const QUIET_ENDING_SECONDS = 5;

/** Sounding time, across the whole stack, before "Stop alarm" appears. */
export const WAY_OUT_SOUNDING_SECONDS = 120;

/** How often the task clock reads the time. */
export const TASK_CLOCK_TICK_MS = 250;

/** The most sounding time one read adds; a paused timer gains no more. */
export const TASK_CLOCK_MAX_GAIN_MS = 2 * TASK_CLOCK_TICK_MS;

/** Under Reduce Motion the quiet bar moves in steps of this many seconds. */
export const QUIET_BAR_STEP_SECONDS = 5;

/** Where quiet time stands. */
export const QUIET_PHASE = {
  PAUSED: "paused",
  ENDING: "ending",
  SOUNDING: "sounding",
} as const;

export type QuietPhase = (typeof QUIET_PHASE)[keyof typeof QUIET_PHASE];

/** What a solved board leads to. */
export const TASK_RUN_NEXT = {
  STEP: "step",
  HANDOVER: "handover",
  DONE: "done",
} as const;

/** The panel between two tasks: it fades in, holds, then fades out. */
export const HANDOVER_MS = { IN: 180, HOLD: 1000, OUT: 180 } as const;

/** A new step's board, and the way out, fade in over this. */
export const TASK_ENTER_MS = 280;

/** A step's board leaves over this. */
export const TASK_EXIT_MS = 180;

/** Each task's name, as the start button and the handover say it. */
export const WAKE_TASK_NAME_KEY = {
  [WAKE_TASK_ID.MATH]: "alarm.task.name.math",
  [WAKE_TASK_ID.PATTERN]: "alarm.task.name.pattern",
  [WAKE_TASK_ID.DHIKR]: "alarm.task.name.dhikr",
  [WAKE_TASK_ID.PRAYERS]: "alarm.task.name.prayers",
  [WAKE_TASK_ID.TAP]: "alarm.task.name.tap",
} as const satisfies Record<WakeTaskId, string>;

/** Test ids for the shell's parts. */
export const TASK_SHELL_PART = {
  QUIET_STATUS: "task-quiet-status",
  PROGRESS_STATUS: "task-progress-status",
  WAY_OUT_STATUS: "task-way-out-status",
  QUIET_STRIP: "task-quiet-strip",
  QUIET_FILL: "task-quiet-fill",
  PIP: "task-step-pip",
  HANDOVER: "task-handover",
} as const;
