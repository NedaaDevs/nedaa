import { CHALLENGE_DIFFICULTY, CHALLENGE_TYPE } from "expo-alarm";

import {
  DEFAULT_WAKE_TASKS,
  WAKE_TASK_DEFAULT_DIFFICULTY,
  WAKE_TASK_DEFAULT_STEPS,
  WAKE_TASK_ID,
  WAKE_TASK_IDS,
  WAKE_TASK_MAX_STACK,
  WAKE_TASK_MAX_STEPS,
  WAKE_TASK_MIN_STEPS,
  WAKE_TASK_OPTIONS,
  type WakeTaskSteps,
} from "@/constants/WakeTask";
import {
  CHALLENGE_COUNTS,
  CHALLENGE_DIFFICULTIES,
  DEFAULT_ALARM_TYPE_SETTINGS,
  DEFAULT_CHALLENGE_CONFIG,
  type ChallengeConfig,
  type ChallengeCount,
  type WakeTask,
} from "@/types/alarm";
import {
  legacyChallengeFromWakeTasks,
  normalizeLegacyChallenge,
  normalizeWakeTasks,
  readSavedWakeTaskFields,
  syncWakeTaskFields,
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

/** A saved count and the steps it becomes. */
const COUNT_STEPS: [ChallengeCount, WakeTaskSteps][] = [
  [1, 1],
  [5, 5],
  [6, WAKE_TASK_MAX_STEPS],
  [10, WAKE_TASK_MAX_STEPS],
];

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
        written: legacy(CHALLENGE_TYPE.TAP, EASY, 1),
      },
      {
        saved: legacy(CHALLENGE_TYPE.MATH, difficulty, count),
        tasks: [{ id: WAKE_TASK_ID.MATH, difficulty, steps }],
        written: legacy(CHALLENGE_TYPE.MATH, difficulty, steps),
      },
      {
        saved: legacy(CHALLENGE_TYPE.DHIKR, difficulty, count),
        tasks: [{ id: WAKE_TASK_ID.DHIKR, steps }],
        written: legacy(CHALLENGE_TYPE.DHIKR, EASY, steps),
      },
    ])
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
  });

  it.each(WAKE_TASK_IDS)("reads %s with exactly the options its board offers", (id) => {
    const { hasDifficulty, hasSteps } = WAKE_TASK_OPTIONS[id];

    expect(normalizeWakeTasks([{ id }])).toEqual([
      {
        id,
        ...(hasDifficulty && { difficulty: WAKE_TASK_DEFAULT_DIFFICULTY }),
        ...(hasSteps && { steps: WAKE_TASK_DEFAULT_STEPS }),
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
      legacy(CHALLENGE_TYPE.TAP, EASY, 1)
    );
  });

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
    [99, WAKE_TASK_MAX_STEPS],
    [2.6, 3],
    ["4", WAKE_TASK_DEFAULT_STEPS],
    [undefined, WAKE_TASK_DEFAULT_STEPS],
  ])("reads saved steps %p as %p", (steps, expected) => {
    expect(normalizeWakeTasks([{ id: WAKE_TASK_ID.DHIKR, steps }])).toEqual([
      { id: WAKE_TASK_ID.DHIKR, steps: expected },
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
      tasks: [{ id: WAKE_TASK_ID.DHIKR, steps: WAKE_TASK_MAX_STEPS }],
    });
  });

  it("leaves a change without either field alone", () => {
    const change = { volume: 0.5 };

    expect(syncWakeTaskFields(change)).toBe(change);
  });
});

describe("readSavedWakeTaskFields", () => {
  const MATH_HARD_7 = legacy(CHALLENGE_TYPE.MATH, HARD, 7);
  const MATH_HARD_MAX: WakeTask = {
    id: WAKE_TASK_ID.MATH,
    difficulty: HARD,
    steps: WAKE_TASK_MAX_STEPS,
  };

  // Each saved pair must name one overlay challenge, the saved one.
  it.each(LEGACY_TABLE)("pairs $saved.type $saved.difficulty ×$saved.count", ({ saved }) => {
    const stale = [[], [TAP], [MATH_HARD_2], [DHIKR_4], [PATTERN_MEDIUM_3, PRAYERS], null];

    stale.forEach((tasks) => {
      const read = readSavedWakeTaskFields({ challenge: saved, tasks });

      expect(read.challenge).toEqual(saved);
      expect(legacyChallengeFromWakeTasks(read.tasks)).toEqual(
        legacyChallengeFromWakeTasks(wakeTasksFromLegacyChallenge(saved))
      );
    });
  });

  it("keeps a saved stack its challenge stands for", () => {
    const tasks = [MATH_HARD_MAX, PRAYERS, TAP];

    expect(readSavedWakeTaskFields({ challenge: MATH_HARD_7, tasks })).toEqual({
      challenge: MATH_HARD_7,
      tasks,
    });
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
    ).toEqual([MATH_HARD_MAX]);
  });

  it.each([null, undefined, WAKE_TASK_ID.TAP, { id: WAKE_TASK_ID.TAP }])(
    "reads saved tasks %p as the stack the challenge stands for",
    (tasks) => {
      expect(readSavedWakeTaskFields({ challenge: MATH_HARD_7, tasks }).tasks).toEqual([
        MATH_HARD_MAX,
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
