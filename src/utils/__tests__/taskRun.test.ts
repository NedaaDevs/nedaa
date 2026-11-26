import { CHALLENGE_DIFFICULTY } from "expo-alarm";

import { AppLocale } from "@/enums/app";
import { WAKE_TASK_DEFAULT_DIFFICULTY, WAKE_TASK_ID } from "@/constants/WakeTask";
import { TASK_RUN_NEXT } from "@/constants/WakeTaskShell";
import i18n from "@/localization/i18n";
import { usePreferencesStore } from "@/stores/preferences";
import type { WakeTask } from "@/types/alarm";
import {
  FIRST_POSITION,
  advanceTaskRun,
  describeStart,
  difficultyOf,
  isNonEmpty,
  resumePosition,
  stepsOf,
  type NonEmptyTasks,
  type TaskPosition,
} from "@/utils/taskRun";

const MATH_3: WakeTask = { id: WAKE_TASK_ID.MATH, difficulty: CHALLENGE_DIFFICULTY.HARD, steps: 3 };
const MATH_1: WakeTask = { id: WAKE_TASK_ID.MATH, difficulty: CHALLENGE_DIFFICULTY.EASY, steps: 1 };
const DHIKR_2: WakeTask = { id: WAKE_TASK_ID.DHIKR, steps: 2 };
const TAP: WakeTask = { id: WAKE_TASK_ID.TAP };
const PRAYERS: WakeTask = { id: WAKE_TASK_ID.PRAYERS };

/** Every position a stack passes through, solving each board in turn. */
const walk = (tasks: NonEmptyTasks) => {
  const seen: { position: TaskPosition; next: string }[] = [];
  let position: TaskPosition = FIRST_POSITION;
  for (;;) {
    const result = advanceTaskRun(tasks, position);
    seen.push({ position, next: result.next });
    if (result.next === TASK_RUN_NEXT.DONE) return seen;
    position = result.position;
  }
};

const sayIn = (lng: AppLocale) => i18n.getFixedT(lng);

beforeAll(() => usePreferencesStore.setState({ useWesternNumerals: true }));

describe("taskRun", () => {
  it("reads a task's steps, one for a board without steps", () => {
    expect(stepsOf(MATH_3)).toBe(3);
    expect(stepsOf(TAP)).toBe(1);
  });

  it("reads a task's difficulty, the default for a board without one", () => {
    expect(difficultyOf(MATH_3)).toBe(CHALLENGE_DIFFICULTY.HARD);
    expect(difficultyOf(DHIKR_2)).toBe(WAKE_TASK_DEFAULT_DIFFICULTY);
  });

  it("resumes a saved position the stack still holds", () => {
    expect(resumePosition([MATH_3, TAP], { task: 0, step: 2 })).toEqual({ task: 0, step: 2 });
    expect(resumePosition([MATH_3, TAP], { task: 1, step: 0 })).toEqual({ task: 1, step: 0 });
  });

  it("starts over when the stack no longer holds the saved position", () => {
    expect(resumePosition([MATH_3], undefined)).toBe(FIRST_POSITION);
    expect(resumePosition([MATH_3], { task: 1, step: 0 })).toBe(FIRST_POSITION);
    expect(resumePosition([MATH_1, TAP], { task: 0, step: 2 })).toBe(FIRST_POSITION);
    expect(resumePosition([MATH_3], { task: -1, step: 0 })).toBe(FIRST_POSITION);
  });

  it("tells an empty stack apart", () => {
    expect(isNonEmpty([])).toBe(false);
    expect(isNonEmpty([TAP])).toBe(true);
  });

  it("runs each board its steps' times, handing over between tasks", () => {
    expect(walk([MATH_3, DHIKR_2]).map(({ next }) => next)).toEqual([
      TASK_RUN_NEXT.STEP,
      TASK_RUN_NEXT.STEP,
      TASK_RUN_NEXT.HANDOVER,
      TASK_RUN_NEXT.STEP,
      TASK_RUN_NEXT.DONE,
    ]);
  });

  it("solves as many boards as the stack's steps add up to", () => {
    const stacks: NonEmptyTasks[] = [[TAP], [MATH_3], [MATH_1, TAP, DHIKR_2], [DHIKR_2, MATH_3]];
    stacks.forEach((stack) => {
      const total = stack.reduce((sum, task) => sum + stepsOf(task), 0);
      expect(walk(stack)).toHaveLength(total);
    });
  });

  it("starts each task at its first step", () => {
    const starts = walk([MATH_3, DHIKR_2]).filter(({ position }) => position.step === 0);

    expect(starts.map(({ position }) => position.task)).toEqual([0, 1]);
  });

  describe("the start button", () => {
    const START = { [AppLocale.EN]: "Start wake-up task", [AppLocale.AR]: "بدء مهمة الاستيقاظ" };

    it.each([
      [AppLocale.EN, [MATH_3], "Math · 3 steps", "Math, 3 steps"],
      [AppLocale.EN, [MATH_1], "Math", "Math"],
      [AppLocale.EN, [MATH_3, PRAYERS], "Math, then Prayers in order", null],
      [AppLocale.AR, [MATH_3], "مسألة حسابية · 3 خطوات", "مسألة حسابية، 3 خطوات"],
      [AppLocale.AR, [DHIKR_2], "إكمال الذِّكر · خطوتان", "إكمال الذِّكر، خطوتان"],
      [AppLocale.AR, [MATH_3, PRAYERS], "مسألة حسابية ثم ترتيب الصلوات", null],
    ] as const)("names the tasks in %s for %j", (lng, tasks, detail, spoken) => {
      const say = sayIn(lng);
      expect(describeStart(tasks, say)).toEqual({
        title: START[lng],
        detail,
        label: say("a11y.alarm.task.start", { action: START[lng], tasks: spoken ?? detail }),
      });
    });

    // The count carries the noun, so the action does not say it again.
    it.each([
      [AppLocale.EN, "Start 3 wake-up tasks"],
      [AppLocale.AR, "بدء 3 مهام استيقاظ"],
    ] as const)("counts three tasks in %s", (lng, title) => {
      expect(describeStart([MATH_3, TAP, DHIKR_2], sayIn(lng))).toEqual({
        title,
        detail: null,
        label: title,
      });
    });
  });
});
