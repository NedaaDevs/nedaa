import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  WAKE_TASK_DEFAULT_DIFFICULTY,
  WAKE_TASK_DEFAULT_STEPS,
  WAKE_TASK_IDS,
  WAKE_TASK_MAX_STACK,
  WAKE_TASK_OPTIONS,
} from "@/constants/WakeTask";
import { TASK_RUN_NEXT } from "@/constants/WakeTaskShell";
import { CHALLENGE_DIFFICULTIES, CHALLENGE_TYPES, type WakeTask } from "@/types/alarm";
import { advanceTaskRun, isNonEmpty } from "@/utils/taskRun";
import {
  legacyChallengeFromWakeTasks,
  normalizeWakeTasks,
  readSavedWakeTaskFields,
} from "@/utils/wakeTasks";

// The Android JVM tests WakeTasksSharedTest and TaskRunTest read the same tables.
const FIXTURES = join(__dirname, "..", "..", "..", "modules", "expo-alarm", "fixtures");

/** The fixtures' syntax, which is also how native stores a stack. */
const FORMAT = {
  EMPTY: "-",
  YES: "yes",
  ABSENT: "absent",
  LIST: ",",
  TASK: ";",
  FIELD: ",",
  VALUE: "=",
} as const;

const NUMBER = /^-?\d+(\.\d+)?$/;

/** The fields native writes, in the order it writes them. */
const FIELDS = ["id", "difficulty", "steps"] as const;

const table = (name: string): string[][] =>
  readFileSync(join(FIXTURES, name), "utf8")
    .split("\n")
    .slice(1)
    .filter((line) => line.length > 0)
    .map((line) => line.split("\t"));

const cell = (value: string): string => (value === FORMAT.EMPTY ? "" : value);

const list = (value: string): string[] =>
  cell(value)
    .split(FORMAT.LIST)
    .filter((item) => item.length > 0);

/** Raw records as WakeTasks.decode reads them; fields with no '=' drop. */
const decode = (text: string): Record<string, unknown>[] =>
  text
    .split(FORMAT.TASK)
    .filter((task) => task.length > 0)
    .map((task) =>
      Object.fromEntries(
        task.split(FORMAT.FIELD).flatMap((field) => {
          const at = field.indexOf(FORMAT.VALUE);
          if (at < 0) return [];
          const value = field.slice(at + 1);
          return [[field.slice(0, at), NUMBER.test(value) ? Number(value) : value]];
        })
      )
    );

const encode = (tasks: readonly WakeTask[]): string =>
  tasks
    .map((task) => {
      const record: Readonly<Record<string, unknown>> = task;
      return FIELDS.filter((key) => record[key] !== undefined)
        .map((key) => `${key}${FORMAT.VALUE}${String(record[key])}`)
        .join(FORMAT.FIELD);
    })
    .join(FORMAT.TASK);

describe("the wake task rules Android shares", () => {
  it("offers the board options the overlay reads", () => {
    const shared = table("wake-task-boards.tsv").map(([id, difficulty, steps]) => [
      id,
      difficulty === FORMAT.YES,
      list(steps).map(Number),
    ]);
    const js = WAKE_TASK_IDS.map((id) => {
      const { hasDifficulty, stepChoices } = WAKE_TASK_OPTIONS[id];
      return [id, hasDifficulty, [...(stepChoices ?? [])]];
    });
    expect(js).toEqual(shared);
  });

  it("uses the limits the overlay uses", () => {
    const shared = Object.fromEntries(table("wake-task-limits.tsv"));
    expect({
      MAX_STACK: String(WAKE_TASK_MAX_STACK),
      DEFAULT_DIFFICULTY: WAKE_TASK_DEFAULT_DIFFICULTY,
      DEFAULT_STEPS: String(WAKE_TASK_DEFAULT_STEPS),
      DIFFICULTIES: CHALLENGE_DIFFICULTIES.join(FORMAT.LIST),
      CHALLENGE_TYPES: CHALLENGE_TYPES.join(FORMAT.LIST),
    }).toEqual(shared);
  });

  it.each(table("wake-task-stack.tsv"))("keeps the stack %s as %s", (input, stack) => {
    expect(encode(normalizeWakeTasks(decode(cell(input))))).toBe(cell(stack));
  });

  it.each(table("wake-task-challenge.tsv"))(
    "derives from the stack %s the challenge %s %s ×%s",
    (stack, type, difficulty, count) => {
      const tasks = normalizeWakeTasks(decode(cell(stack)));
      expect(legacyChallengeFromWakeTasks(tasks)).toEqual({
        type,
        difficulty,
        count: Number(count),
      });
    }
  );

  it.each(table("wake-task-saved.tsv"))(
    "reads %s %s ×%s with tasks %s as %s",
    (type, difficulty, count, stored, stack) => {
      const saved = {
        challenge: { type, difficulty, count: Number(count) },
        tasks: stored === FORMAT.ABSENT ? undefined : decode(cell(stored)),
      };
      expect(encode(readSavedWakeTaskFields(saved).tasks)).toBe(cell(stack));
    }
  );
});

describe("task-run.tsv", () => {
  it.each(table("task-run.tsv"))(
    "solving %s at task %s step %s leads to %s %s %s",
    (stack, task, step, next, nextTask, nextStep) => {
      const tasks = normalizeWakeTasks(decode(stack));
      if (!isNonEmpty(tasks)) throw new Error(`empty stack ${stack}`);
      expect(Object.values(TASK_RUN_NEXT)).toContain(next);
      const result = advanceTaskRun(tasks, { task: Number(task), step: Number(step) });
      const position = "position" in result ? result.position : null;
      expect([result.next, position?.task, position?.step]).toEqual([
        next,
        nextTask === FORMAT.EMPTY ? undefined : Number(nextTask),
        nextStep === FORMAT.EMPTY ? undefined : Number(nextStep),
      ]);
    }
  );
});
