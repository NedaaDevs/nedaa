import { readFileSync } from "fs";
import { join } from "path";
import { CHALLENGE_DIFFICULTY, CHALLENGE_TYPE } from "expo-alarm";

import {
  CHALLENGE_COUNTS,
  DEFAULT_WAKE_TASKS,
  WAKE_TASK_DEFAULT_DIFFICULTY,
  WAKE_TASK_DEFAULT_STEPS,
  WAKE_TASK_ID,
  WAKE_TASK_IDS,
  WAKE_TASK_MAX_STACK,
  WAKE_TASK_MIN_STEPS,
  WAKE_TASK_MOVE,
  WAKE_TASK_OPTIONS,
  WAKE_TASK_STEP_CHOICES,
  type ChallengeCount,
  type WakeTaskSteps,
} from "@/constants/WakeTask";
import { TAP_PRESSES } from "@/constants/WakeTaskBoards";
import { REPO_ROOT } from "@/test-helpers/routeTree";
import {
  CHALLENGE_DIFFICULTIES,
  DEFAULT_ALARM_TYPE_SETTINGS,
  DEFAULT_CHALLENGE_CONFIG,
  type ChallengeConfig,
  type WakeTask,
} from "@/types/alarm";
import {
  addWakeTask,
  canAddWakeTask,
  changeWakeTask,
  legacyChallengeFromWakeTasks,
  moveWakeTask,
  normalizeLegacyChallenge,
  normalizeWakeTasks,
  readSavedWakeTaskFields,
  removeWakeTask,
  syncWakeTaskFields,
  wakeTaskFor,
  wakeTasksFromLegacyChallenge,
} from "@/utils/wakeTasks";

const { EASY, MEDIUM, HARD } = CHALLENGE_DIFFICULTY;

const MATH_HARD_2: WakeTask = { id: WAKE_TASK_ID.MATH, difficulty: HARD, steps: 2 };
const PATTERN_MEDIUM_3: WakeTask = { id: WAKE_TASK_ID.PATTERN, difficulty: MEDIUM, steps: 3 };
const DHIKR_4: WakeTask = { id: WAKE_TASK_ID.DHIKR, steps: 4 };
const PRAYERS: WakeTask = { id: WAKE_TASK_ID.PRAYERS };
const TAP: WakeTask = { id: WAKE_TASK_ID.TAP };

// Illegal shapes fail the build, not a runtime check.
// @ts-expect-error A Prayers task takes no steps.
const PRAYERS_WITH_STEPS: WakeTask = { id: WAKE_TASK_ID.PRAYERS, steps: 2 };
// @ts-expect-error A Math task needs its difficulty.
const MATH_NO_DIFFICULTY: WakeTask = { id: WAKE_TASK_ID.MATH, steps: 2 };
// @ts-expect-error A Complete the dhikr task takes no difficulty.
const DHIKR_WITH_DIFFICULTY: WakeTask = { id: WAKE_TASK_ID.DHIKR, difficulty: EASY, steps: 1 };

const legacy = (
  type: ChallengeConfig["type"],
  difficulty: ChallengeConfig["difficulty"],
  count: ChallengeConfig["count"]
): ChallengeConfig => ({ type, difficulty, count });

const SHARED_MAX_STEPS = WAKE_TASK_STEP_CHOICES[WAKE_TASK_STEP_CHOICES.length - 1];
const MATH_MAX_STEPS = CHALLENGE_COUNTS[CHALLENGE_COUNTS.length - 1];

/** A saved count and the steps a board on the shared choices makes of it. */
const COUNT_STEPS: [ChallengeCount, WakeTaskSteps][] = [
  [1, 1],
  [5, 5],
  [6, SHARED_MAX_STEPS],
  [10, SHARED_MAX_STEPS],
];

/** A saved count and the Math steps it becomes: the same number. */
const MATH_COUNT_STEPS = CHALLENGE_COUNTS.map((count): [ChallengeCount, ChallengeCount] => [
  count,
  count,
]);

/** A saved challenge, its stack, and the challenge that stack writes. */
const LEGACY_TABLE: {
  saved: ChallengeConfig;
  tasks: WakeTask[];
  written: ChallengeConfig;
}[] = [
  ...CHALLENGE_COUNTS.map((count) => ({
    saved: legacy(CHALLENGE_TYPE.NONE, HARD, count),
    tasks: [],
    written: legacy(CHALLENGE_TYPE.NONE, EASY, 1),
  })),
  ...COUNT_STEPS.flatMap(([count, steps]) =>
    CHALLENGE_DIFFICULTIES.flatMap((difficulty) => [
      {
        saved: legacy(CHALLENGE_TYPE.TAP, difficulty, count),
        tasks: [TAP],
        written: legacy(CHALLENGE_TYPE.TAP, MEDIUM, 1),
      },
      {
        saved: legacy(CHALLENGE_TYPE.DHIKR, difficulty, count),
        tasks: [{ id: WAKE_TASK_ID.DHIKR, steps }],
        written: legacy(CHALLENGE_TYPE.DHIKR, EASY, steps),
      },
    ])
  ),
  ...MATH_COUNT_STEPS.flatMap(([count, steps]) =>
    CHALLENGE_DIFFICULTIES.map((difficulty) => ({
      saved: legacy(CHALLENGE_TYPE.MATH, difficulty, count),
      tasks: [{ id: WAKE_TASK_ID.MATH, difficulty, steps }],
      written: legacy(CHALLENGE_TYPE.MATH, difficulty, steps),
    }))
  ),
];

describe("wake task shapes", () => {
  it("rejects illegal shapes at compile time", () => {
    expect([PRAYERS_WITH_STEPS, MATH_NO_DIFFICULTY, DHIKR_WITH_DIFFICULTY]).toHaveLength(3);
  });

  it("starts on the stack the default challenge maps to", () => {
    expect(wakeTasksFromLegacyChallenge(DEFAULT_CHALLENGE_CONFIG)).toEqual(DEFAULT_WAKE_TASKS);
    expect(DEFAULT_ALARM_TYPE_SETTINGS.tasks).toEqual(
      wakeTasksFromLegacyChallenge(DEFAULT_ALARM_TYPE_SETTINGS.challenge)
    );
    expect(DEFAULT_ALARM_TYPE_SETTINGS.challenge).toEqual(
      legacyChallengeFromWakeTasks(DEFAULT_ALARM_TYPE_SETTINGS.tasks)
    );
  });

  it.each(WAKE_TASK_IDS)("reads %s with exactly the options its board offers", (id) => {
    const { hasDifficulty, stepChoices } = WAKE_TASK_OPTIONS[id];

    expect(normalizeWakeTasks([{ id }])).toEqual([
      {
        id,
        ...(hasDifficulty && { difficulty: WAKE_TASK_DEFAULT_DIFFICULTY }),
        ...(stepChoices && { steps: WAKE_TASK_DEFAULT_STEPS }),
      },
    ]);
  });
});

describe("wakeTasksFromLegacyChallenge", () => {
  it.each(LEGACY_TABLE)("maps $saved.type $saved.difficulty ×$saved.count", ({ saved, tasks }) => {
    expect(wakeTasksFromLegacyChallenge(saved)).toEqual(tasks);
  });
});

describe("legacyChallengeFromWakeTasks", () => {
  it.each(LEGACY_TABLE)("writes $written.type for $saved.type", ({ tasks, written }) => {
    expect(legacyChallengeFromWakeTasks(tasks)).toEqual(written);
  });

  it("writes the first task of a stack", () => {
    expect(legacyChallengeFromWakeTasks([DHIKR_4, MATH_HARD_2])).toEqual(
      legacy(CHALLENGE_TYPE.DHIKR, EASY, 4)
    );
  });

  // The overlay has no Pattern or Prayers board yet.
  it.each([PATTERN_MEDIUM_3, PRAYERS])("writes a tap for a first $id task", (first) => {
    expect(legacyChallengeFromWakeTasks([first, MATH_HARD_2])).toEqual(
      legacyChallengeFromWakeTasks([TAP])
    );
  });

  // The overlay asks TAPS_<difficulty> presses per count; the Tap board asks TAP_PRESSES.
  it.each([TAP, PATTERN_MEDIUM_3, PRAYERS])(
    "asks the overlay for as many presses as the Tap board for a first $id task",
    (first) => {
      const overlay = readFileSync(
        join(
          REPO_ROOT,
          "modules/expo-alarm/android/src/main/java/expo/modules/alarm/AlarmOverlayService.kt"
        ),
        "utf8"
      );
      const { difficulty, count } = legacyChallengeFromWakeTasks([first]);
      const perCount = overlay.match(new RegExp(`TAPS_${difficulty.toUpperCase()} = (\\d+)`))?.[1];

      expect(Number(perCount) * count).toBe(TAP_PRESSES);
    }
  );

  // Every stack the overlay can run survives the trip through the old fields.
  it.each(LEGACY_TABLE)("reads back what it writes for $saved.type", ({ tasks }) => {
    expect(wakeTasksFromLegacyChallenge(legacyChallengeFromWakeTasks(tasks))).toEqual(tasks);
  });
});

describe("normalizeLegacyChallenge", () => {
  it("keeps a valid challenge", () => {
    const saved = legacy(CHALLENGE_TYPE.MATH, HARD, 7);
    expect(normalizeLegacyChallenge(saved)).toEqual(saved);
  });

  it.each([null, undefined, "math", 3, []])("reads %p as the default challenge", (saved) => {
    expect(normalizeLegacyChallenge(saved)).toEqual(DEFAULT_CHALLENGE_CONFIG);
  });

  it("replaces each bad field with its default", () => {
    expect(normalizeLegacyChallenge({ type: "puzzle", difficulty: "brutal", count: 99 })).toEqual({
      ...DEFAULT_CHALLENGE_CONFIG,
      count: CHALLENGE_COUNTS[CHALLENGE_COUNTS.length - 1],
    });
    expect(normalizeLegacyChallenge({ type: CHALLENGE_TYPE.DHIKR, count: "3" })).toEqual({
      ...DEFAULT_CHALLENGE_CONFIG,
      type: CHALLENGE_TYPE.DHIKR,
    });
  });
});

describe("normalizeWakeTasks", () => {
  it("keeps a valid stack", () => {
    expect(normalizeWakeTasks([PRAYERS, MATH_HARD_2, DHIKR_4])).toEqual([
      PRAYERS,
      MATH_HARD_2,
      DHIKR_4,
    ]);
  });

  it.each([null, undefined, "math", 7, { id: WAKE_TASK_ID.MATH }])(
    "reads %p as an empty stack",
    (saved) => {
      expect(normalizeWakeTasks(saved)).toEqual([]);
    }
  );

  it("drops entries that name no board", () => {
    expect(normalizeWakeTasks([null, WAKE_TASK_ID.TAP, { id: "puzzle" }, {}, TAP])).toEqual([TAP]);
  });

  it("keeps the first of a duplicated board", () => {
    expect(
      normalizeWakeTasks([MATH_HARD_2, TAP, { ...MATH_HARD_2, difficulty: EASY }, TAP])
    ).toEqual([MATH_HARD_2, TAP]);
  });

  it("keeps the first tasks up to the stack limit", () => {
    const five = [MATH_HARD_2, PATTERN_MEDIUM_3, DHIKR_4, PRAYERS, TAP];

    expect(normalizeWakeTasks(five)).toEqual(five.slice(0, WAKE_TASK_MAX_STACK));
  });

  it.each([
    [0, WAKE_TASK_MIN_STEPS],
    [-3, WAKE_TASK_MIN_STEPS],
    [99, SHARED_MAX_STEPS],
    [2.6, 3],
    ["4", WAKE_TASK_DEFAULT_STEPS],
    [undefined, WAKE_TASK_DEFAULT_STEPS],
  ])("reads saved steps %p as %p", (steps, expected) => {
    expect(normalizeWakeTasks([{ id: WAKE_TASK_ID.DHIKR, steps }])).toEqual([
      { id: WAKE_TASK_ID.DHIKR, steps: expected },
    ]);
  });

  it.each([
    [MATH_MAX_STEPS, MATH_MAX_STEPS],
    [99, MATH_MAX_STEPS],
    [0, WAKE_TASK_MIN_STEPS],
  ])("reads saved Math steps %p as %p", (steps, expected) => {
    expect(normalizeWakeTasks([{ id: WAKE_TASK_ID.MATH, difficulty: HARD, steps }])).toEqual([
      { id: WAKE_TASK_ID.MATH, difficulty: HARD, steps: expected },
    ]);
  });

  it.each(["brutal", undefined, 2])("reads saved difficulty %p as the default", (difficulty) => {
    expect(normalizeWakeTasks([{ id: WAKE_TASK_ID.PATTERN, difficulty, steps: 2 }])).toEqual([
      { id: WAKE_TASK_ID.PATTERN, difficulty: WAKE_TASK_DEFAULT_DIFFICULTY, steps: 2 },
    ]);
  });

  it("drops options a board does not offer", () => {
    expect(
      normalizeWakeTasks([{ id: WAKE_TASK_ID.PRAYERS, difficulty: HARD, steps: 4, extra: true }])
    ).toEqual([PRAYERS]);
  });
});

describe("syncWakeTaskFields", () => {
  it("writes the challenge the stack maps to", () => {
    expect(syncWakeTaskFields({ tasks: [MATH_HARD_2], volume: 0.5 })).toEqual({
      tasks: [MATH_HARD_2],
      challenge: legacy(CHALLENGE_TYPE.MATH, HARD, 2),
      volume: 0.5,
    });
  });

  it("writes the stack a challenge maps to", () => {
    const challenge = legacy(CHALLENGE_TYPE.DHIKR, HARD, 8);

    expect(syncWakeTaskFields({ challenge })).toEqual({
      challenge,
      tasks: [{ id: WAKE_TASK_ID.DHIKR, steps: SHARED_MAX_STEPS }],
    });
  });

  it("leaves a change without either field alone", () => {
    const change = { volume: 0.5 };

    expect(syncWakeTaskFields(change)).toBe(change);
  });
});

describe("readSavedWakeTaskFields", () => {
  const MATH_HARD_7 = legacy(CHALLENGE_TYPE.MATH, HARD, 7);
  const MATH_HARD_7_TASK: WakeTask = { id: WAKE_TASK_ID.MATH, difficulty: HARD, steps: 7 };

  // What the picker shows is what the overlay runs, from the first load.
  it.each(LEGACY_TABLE)(
    "pairs $saved.type $saved.difficulty ×$saved.count",
    ({ saved, written }) => {
      const stale = [[], [TAP], [MATH_HARD_2], [DHIKR_4], [PATTERN_MEDIUM_3, PRAYERS], null];

      stale.forEach((tasks) => {
        const read = readSavedWakeTaskFields({ challenge: saved, tasks });

        expect(read.challenge).toEqual(legacyChallengeFromWakeTasks(read.tasks));
        expect(read.challenge).toEqual(written);
      });
    }
  );

  it("keeps a saved stack its challenge stands for", () => {
    const tasks = [MATH_HARD_7_TASK, PRAYERS, TAP];

    expect(readSavedWakeTaskFields({ challenge: MATH_HARD_7, tasks })).toEqual({
      challenge: legacyChallengeFromWakeTasks(tasks),
      tasks,
    });
  });

  // A pair this build wrote reads back unchanged.
  it.each<[WakeTask[]]>([
    [[PATTERN_MEDIUM_3, MATH_HARD_2]],
    [[DHIKR_4, TAP, PATTERN_MEDIUM_3]],
    [[PRAYERS]],
    [[]],
  ])("reads back a saved %j pair as written", (tasks) => {
    const saved = { challenge: legacyChallengeFromWakeTasks(tasks), tasks };

    expect(readSavedWakeTaskFields(saved)).toEqual(saved);
  });

  it("keeps a stack the overlay runs as a tap", () => {
    const tasks = [PATTERN_MEDIUM_3, PRAYERS];

    expect(readSavedWakeTaskFields({ challenge: DEFAULT_CHALLENGE_CONFIG, tasks }).tasks).toEqual(
      tasks
    );
  });

  it("rebuilds a stack left behind by a changed challenge", () => {
    expect(
      readSavedWakeTaskFields({ challenge: MATH_HARD_7, tasks: [DHIKR_4, TAP] }).tasks
    ).toEqual([MATH_HARD_7_TASK]);
  });

  it.each([null, undefined, WAKE_TASK_ID.TAP, { id: WAKE_TASK_ID.TAP }])(
    "reads saved tasks %p as the stack the challenge stands for",
    (tasks) => {
      expect(readSavedWakeTaskFields({ challenge: MATH_HARD_7, tasks }).tasks).toEqual([
        MATH_HARD_7_TASK,
      ]);
    }
  );

  it("reads nothing saved as the defaults", () => {
    expect(readSavedWakeTaskFields(undefined)).toEqual({
      challenge: DEFAULT_CHALLENGE_CONFIG,
      tasks: DEFAULT_WAKE_TASKS,
    });
  });
});

describe("stack edits", () => {
  it("adds a board at the end", () => {
    expect(addWakeTask([PRAYERS], WAKE_TASK_ID.TAP)).toEqual([PRAYERS, TAP]);
  });

  it("adds no board twice and none past the limit", () => {
    const full = [PRAYERS, TAP, DHIKR_4];

    expect(canAddWakeTask([TAP], WAKE_TASK_ID.TAP)).toBe(false);
    expect(addWakeTask([TAP], WAKE_TASK_ID.TAP)).toEqual([TAP]);
    expect(canAddWakeTask(full, WAKE_TASK_ID.MATH)).toBe(false);
    expect(addWakeTask(full, WAKE_TASK_ID.MATH)).toEqual(full);
    expect(canAddWakeTask([TAP], WAKE_TASK_ID.MATH)).toBe(true);
  });

  it("removes a board and keeps the order of the rest", () => {
    expect(removeWakeTask([PRAYERS, TAP, DHIKR_4], WAKE_TASK_ID.TAP)).toEqual([PRAYERS, DHIKR_4]);
  });

  it("moves a board one place each way", () => {
    const stack = [PRAYERS, TAP, DHIKR_4];

    expect(moveWakeTask(stack, WAKE_TASK_ID.TAP, WAKE_TASK_MOVE.UP)).toEqual([
      TAP,
      PRAYERS,
      DHIKR_4,
    ]);
    expect(moveWakeTask(stack, WAKE_TASK_ID.TAP, WAKE_TASK_MOVE.DOWN)).toEqual([
      PRAYERS,
      DHIKR_4,
      TAP,
    ]);
  });

  it("leaves a stack alone for a move past its end or a missing board", () => {
    const stack = [PRAYERS, TAP];

    expect(moveWakeTask(stack, WAKE_TASK_ID.PRAYERS, WAKE_TASK_MOVE.UP)).toEqual(stack);
    expect(moveWakeTask(stack, WAKE_TASK_ID.TAP, WAKE_TASK_MOVE.DOWN)).toEqual(stack);
    expect(moveWakeTask(stack, WAKE_TASK_ID.MATH, WAKE_TASK_MOVE.UP)).toEqual(stack);
  });

  it("returns a new array and leaves its input as it was", () => {
    const stack = [PRAYERS, TAP];
    const edits = [
      addWakeTask(stack, WAKE_TASK_ID.MATH),
      addWakeTask(stack, WAKE_TASK_ID.TAP),
      removeWakeTask(stack, WAKE_TASK_ID.MATH),
      moveWakeTask(stack, WAKE_TASK_ID.TAP, WAKE_TASK_MOVE.UP),
      moveWakeTask(stack, WAKE_TASK_ID.MATH, WAKE_TASK_MOVE.UP),
    ];

    edits.forEach((edited) => expect(edited).not.toBe(stack));
    expect(stack).toEqual([PRAYERS, TAP]);
  });
});

describe("changeWakeTask", () => {
  it("changes one task's options and keeps the rest", () => {
    const stack = [MATH_HARD_2, TAP];

    expect(changeWakeTask(stack, WAKE_TASK_ID.MATH, { difficulty: EASY })).toEqual([
      { ...MATH_HARD_2, difficulty: EASY },
      TAP,
    ]);
    expect(changeWakeTask(stack, WAKE_TASK_ID.MATH, { steps: 4 })).toEqual([
      { ...MATH_HARD_2, steps: 4 },
      TAP,
    ]);
  });

  it("counts Math steps up to its own most", () => {
    expect(changeWakeTask([MATH_HARD_2], WAKE_TASK_ID.MATH, { steps: 9 })).toEqual([
      { ...MATH_HARD_2, steps: 9 },
    ]);
    expect(changeWakeTask([MATH_HARD_2], WAKE_TASK_ID.MATH, { steps: 11 })).toEqual([
      { ...MATH_HARD_2, steps: MATH_MAX_STEPS },
    ]);
  });

  it("keeps steps on the offered choices", () => {
    expect(changeWakeTask([DHIKR_4], WAKE_TASK_ID.DHIKR, { steps: 9 })).toEqual([
      { ...DHIKR_4, steps: SHARED_MAX_STEPS },
    ]);
    expect(changeWakeTask([DHIKR_4], WAKE_TASK_ID.DHIKR, { steps: 0 })).toEqual([
      { ...DHIKR_4, steps: WAKE_TASK_MIN_STEPS },
    ]);
  });

  it("gives a board only the options it offers", () => {
    expect(changeWakeTask([DHIKR_4], WAKE_TASK_ID.DHIKR, { difficulty: HARD })).toEqual([DHIKR_4]);
    expect(changeWakeTask([TAP], WAKE_TASK_ID.TAP, { steps: 3 })).toEqual([TAP]);
  });

  it("leaves a stack without the task as it was", () => {
    expect(changeWakeTask([TAP], WAKE_TASK_ID.MATH, { steps: 3 })).toEqual([TAP]);
  });
});

describe("wakeTaskFor", () => {
  it("reads the stack's own task", () => {
    expect(wakeTaskFor([TAP, MATH_HARD_2], WAKE_TASK_ID.MATH)).toEqual(MATH_HARD_2);
  });

  it("gives a task not in the stack its default options", () => {
    expect(wakeTaskFor([TAP], WAKE_TASK_ID.PATTERN)).toEqual({
      id: WAKE_TASK_ID.PATTERN,
      difficulty: WAKE_TASK_DEFAULT_DIFFICULTY,
      steps: WAKE_TASK_DEFAULT_STEPS,
    });
  });
});
