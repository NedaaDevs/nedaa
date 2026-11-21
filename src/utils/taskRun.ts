import type { TFunction } from "i18next";

import { WAKE_TASK_DEFAULT_DIFFICULTY, WAKE_TASK_MIN_STEPS } from "@/constants/WakeTask";
import { TASK_RUN_NEXT, WAKE_TASK_NAME_KEY } from "@/constants/WakeTaskShell";
import type { ChallengeDifficulty, WakeTask } from "@/types/alarm";
import type { TaskClock } from "@/utils/taskClock";

/** A stack with at least one task; an empty one asks for none. */
export type NonEmptyTasks = readonly [WakeTask, ...WakeTask[]];

export const isNonEmpty = (tasks: readonly WakeTask[]): tasks is NonEmptyTasks => tasks.length > 0;

/** Where a run stands: the task's index and the step within it, from 0. */
export type TaskPosition = Readonly<{ task: number; step: number }>;

export const FIRST_POSITION: TaskPosition = { task: 0, step: 0 };

/** A left run, kept so reopening the task resumes it. */
export type TaskRunSnapshot = Readonly<{ clock: TaskClock; position: TaskPosition }>;

export type TaskRunAdvance =
  | { next: typeof TASK_RUN_NEXT.STEP | typeof TASK_RUN_NEXT.HANDOVER; position: TaskPosition }
  | { next: typeof TASK_RUN_NEXT.DONE };

export const stepsOf = (task: WakeTask): number =>
  "steps" in task ? task.steps : WAKE_TASK_MIN_STEPS;

export const difficultyOf = (task: WakeTask): ChallengeDifficulty =>
  "difficulty" in task ? task.difficulty : WAKE_TASK_DEFAULT_DIFFICULTY;

/** What solving the board at `position` leads to. */
export const advanceTaskRun = (tasks: NonEmptyTasks, position: TaskPosition): TaskRunAdvance => {
  const task = tasks[position.task];
  if (task && position.step + 1 < stepsOf(task)) {
    return { next: TASK_RUN_NEXT.STEP, position: { ...position, step: position.step + 1 } };
  }
  if (position.task + 1 < tasks.length) {
    return { next: TASK_RUN_NEXT.HANDOVER, position: { task: position.task + 1, step: 0 } };
  }
  return { next: TASK_RUN_NEXT.DONE };
};

export const taskName = (task: WakeTask, t: TFunction): string => t(WAKE_TASK_NAME_KEY[task.id]);

/** One or two tasks as the start button shows them and as a reader says them. */
const nameStack = (tasks: NonEmptyTasks, t: TFunction): { shown: string; spoken: string } => {
  const [first, second] = tasks;
  if (second) {
    const shown = t("alarm.task.pair", { first: taskName(first, t), second: taskName(second, t) });
    return { shown, spoken: shown };
  }
  const name = taskName(first, t);
  const count = stepsOf(first);
  if (count === 1) return { shown: name, spoken: name };
  return {
    shown: t("alarm.task.withSteps", { name, count }),
    spoken: t("a11y.alarm.task.withSteps", { name, count }),
  };
};

/** The start button's title, the line under it, and what a reader says. */
export const describeStart = (
  tasks: NonEmptyTasks,
  t: TFunction
): { title: string; detail: string | null; label: string } => {
  if (tasks.length > 2) {
    const title = t("alarm.task.startCount", { count: tasks.length });
    return { title, detail: null, label: title };
  }
  const title = t("alarm.task.start");
  const { shown, spoken } = nameStack(tasks, t);
  return {
    title,
    detail: shown,
    label: t("a11y.alarm.task.start", { action: title, tasks: spoken }),
  };
};
