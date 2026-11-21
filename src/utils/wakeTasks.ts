import { CHALLENGE_TYPE } from "expo-alarm";

import {
  CHALLENGE_COUNTS,
  WAKE_TASK_DEFAULT_DIFFICULTY,
  WAKE_TASK_DEFAULT_STEPS,
  WAKE_TASK_ID,
  WAKE_TASK_IDS,
  WAKE_TASK_MAX_STACK,
  WAKE_TASK_MOVE,
  WAKE_TASK_OPTIONS,
  type WakeTaskId,
  type WakeTaskMove,
  type WakeTaskSteps,
} from "@/constants/WakeTask";
import {
  CHALLENGE_DIFFICULTIES,
  CHALLENGE_TYPES,
  DEFAULT_CHALLENGE_CONFIG,
  type AlarmTypeSettings,
  type ChallengeConfig,
  type ChallengeDifficulty,
  type WakeTask,
} from "@/types/alarm";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The listed value equal to `value`, or undefined. */
const pick = <T>(choices: readonly T[], value: unknown): T | undefined =>
  choices.find((choice) => choice === value);

/** A number rounded and clamped onto an ascending list of whole steps. */
const pickStep = <T extends number>(choices: readonly T[], value: unknown, fallback: T): T => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const clamped = Math.min(Math.max(Math.round(value), choices[0]), choices[choices.length - 1]);
  return pick(choices, clamped) ?? fallback;
};

const readDifficulty = (value: unknown): ChallengeDifficulty =>
  pick(CHALLENGE_DIFFICULTIES, value) ?? WAKE_TASK_DEFAULT_DIFFICULTY;

/** Saved steps kept to a board's choices; every board offers the default. */
const readSteps = <T extends number>(choices: readonly T[], value: unknown) =>
  pickStep<T | WakeTaskSteps>(choices, value, WAKE_TASK_DEFAULT_STEPS);

/** A task for `id`, its options read from `saved` or defaulted. */
const createWakeTask = (id: WakeTaskId, saved: Record<string, unknown> = {}): WakeTask => {
  switch (id) {
    case WAKE_TASK_ID.MATH:
      return {
        id,
        difficulty: readDifficulty(saved.difficulty),
        steps: readSteps(WAKE_TASK_OPTIONS[id].stepChoices, saved.steps),
      };
    case WAKE_TASK_ID.PATTERN:
      return {
        id,
        difficulty: readDifficulty(saved.difficulty),
        steps: readSteps(WAKE_TASK_OPTIONS[id].stepChoices, saved.steps),
      };
    case WAKE_TASK_ID.DHIKR:
      return { id, steps: readSteps(WAKE_TASK_OPTIONS[id].stepChoices, saved.steps) };
    case WAKE_TASK_ID.PRAYERS:
    case WAKE_TASK_ID.TAP:
      return { id };
    default: {
      const unhandled: never = id;
      throw new Error(`no wake task board for ${unhandled}`);
    }
  }
};

/** Whether `id` fits the stack: not in it yet, and the stack not full. */
export const canAddWakeTask = (tasks: readonly WakeTask[], id: WakeTaskId): boolean =>
  tasks.length < WAKE_TASK_MAX_STACK && !tasks.some((task) => task.id === id);

/** The stack with `id` last, on its default options, when it fits. */
export const addWakeTask = (tasks: readonly WakeTask[], id: WakeTaskId): WakeTask[] =>
  canAddWakeTask(tasks, id) ? [...tasks, createWakeTask(id)] : [...tasks];

export const removeWakeTask = (tasks: readonly WakeTask[], id: WakeTaskId): WakeTask[] =>
  tasks.filter((task) => task.id !== id);

/** The stack with `id` one place toward `direction`, when it can move. */
export const moveWakeTask = (
  tasks: readonly WakeTask[],
  id: WakeTaskId,
  direction: WakeTaskMove
): WakeTask[] => {
  const from = tasks.findIndex((task) => task.id === id);
  const to = direction === WAKE_TASK_MOVE.UP ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= tasks.length) return [...tasks];
  const moved = [...tasks];
  [moved[from], moved[to]] = [moved[to], moved[from]];
  return moved;
};

export type WakeTaskOptionChange = { difficulty?: ChallengeDifficulty; steps?: number };

/** The stack with `id`'s options changed, each kept to what its board offers. */
export const changeWakeTask = (
  tasks: readonly WakeTask[],
  id: WakeTaskId,
  change: WakeTaskOptionChange
): WakeTask[] =>
  tasks.map((task) => (task.id === id ? createWakeTask(id, { ...task, ...change }) : task));

/** The stack's task for `id`, or one on the default options. */
export const wakeTaskFor = (tasks: readonly WakeTask[], id: WakeTaskId): WakeTask =>
  tasks.find((task) => task.id === id) ?? createWakeTask(id);

/** A saved stack made valid: known boards, each once, at most the limit. */
export const normalizeWakeTasks = (input: unknown): WakeTask[] => {
  if (!Array.isArray(input)) return [];
  return input.reduce<WakeTask[]>((tasks, entry: unknown) => {
    if (tasks.length >= WAKE_TASK_MAX_STACK || !isRecord(entry)) return tasks;
    const id = pick(WAKE_TASK_IDS, entry.id);
    if (!id || tasks.some((task) => task.id === id)) return tasks;
    return [...tasks, createWakeTask(id, entry)];
  }, []);
};

/** A saved challenge made valid, each bad field replaced by its default. */
export const normalizeLegacyChallenge = (input: unknown): ChallengeConfig => {
  if (!isRecord(input)) return DEFAULT_CHALLENGE_CONFIG;
  return {
    type: pick(CHALLENGE_TYPES, input.type) ?? DEFAULT_CHALLENGE_CONFIG.type,
    difficulty:
      pick(CHALLENGE_DIFFICULTIES, input.difficulty) ?? DEFAULT_CHALLENGE_CONFIG.difficulty,
    count: pickStep(CHALLENGE_COUNTS, input.count, DEFAULT_CHALLENGE_CONFIG.count),
  };
};

/** The stack a saved challenge stands for. */
export const wakeTasksFromLegacyChallenge = (challenge: ChallengeConfig): WakeTask[] => {
  const { difficulty, count: steps } = challenge;
  switch (challenge.type) {
    case CHALLENGE_TYPE.NONE:
      return [];
    case CHALLENGE_TYPE.TAP:
      return [{ id: WAKE_TASK_ID.TAP }];
    case CHALLENGE_TYPE.MATH:
      return [createWakeTask(WAKE_TASK_ID.MATH, { difficulty, steps })];
    case CHALLENGE_TYPE.DHIKR:
      return [createWakeTask(WAKE_TASK_ID.DHIKR, { steps })];
    default: {
      const unhandled: never = challenge.type;
      throw new Error(`no wake task for challenge ${unhandled}`);
    }
  }
};

/** The challenge the native overlay runs for a stack: its first task. */
export const legacyChallengeFromWakeTasks = (tasks: readonly WakeTask[]): ChallengeConfig => {
  const plain = { difficulty: WAKE_TASK_DEFAULT_DIFFICULTY, count: 1 } as const;
  const [first] = tasks;
  if (!first) return { type: CHALLENGE_TYPE.NONE, ...plain };
  switch (first.id) {
    case WAKE_TASK_ID.MATH:
      return { type: CHALLENGE_TYPE.MATH, difficulty: first.difficulty, count: first.steps };
    case WAKE_TASK_ID.DHIKR:
      return { type: CHALLENGE_TYPE.DHIKR, ...plain, count: first.steps };
    // The overlay has no board for these; tap still asks to be awake.
    case WAKE_TASK_ID.PATTERN:
    case WAKE_TASK_ID.PRAYERS:
    case WAKE_TASK_ID.TAP:
      return DEFAULT_CHALLENGE_CONFIG;
    default: {
      const unhandled: never = first;
      throw new Error(`no challenge for wake task ${JSON.stringify(unhandled)}`);
    }
  }
};

/** A change whose `tasks` and `challenge` agree; `tasks` wins a tie. */
export const syncWakeTaskFields = (
  change: Partial<AlarmTypeSettings>
): Partial<AlarmTypeSettings> => {
  if (change.tasks) {
    const tasks = normalizeWakeTasks(change.tasks);
    return { ...change, tasks, challenge: legacyChallengeFromWakeTasks(tasks) };
  }
  if (change.challenge) {
    const challenge = normalizeLegacyChallenge(change.challenge);
    return { ...change, challenge, tasks: wakeTasksFromLegacyChallenge(challenge) };
  }
  return change;
};

const sameChallenge = (a: ChallengeConfig, b: ChallengeConfig): boolean =>
  a.type === b.type && a.difficulty === b.difficulty && a.count === b.count;

/** The stack and the challenge it maps to, so shown and enforced agree. */
const pairFor = (tasks: WakeTask[]): Pick<AlarmTypeSettings, "challenge" | "tasks"> => ({
  challenge: legacyChallengeFromWakeTasks(tasks),
  tasks,
});

/** Saved fields made valid; tasks the challenge contradicts are rebuilt. */
export const readSavedWakeTaskFields = (
  saved: { challenge?: unknown; tasks?: unknown } | undefined
): Pick<AlarmTypeSettings, "challenge" | "tasks"> => {
  const derived = wakeTasksFromLegacyChallenge(normalizeLegacyChallenge(saved?.challenge));
  if (!Array.isArray(saved?.tasks)) return pairFor(derived);
  const tasks = normalizeWakeTasks(saved.tasks);
  // An older build edits the challenge and leaves the saved tasks behind.
  const agrees = sameChallenge(
    legacyChallengeFromWakeTasks(tasks),
    legacyChallengeFromWakeTasks(derived)
  );
  return pairFor(agrees ? tasks : derived);
};
