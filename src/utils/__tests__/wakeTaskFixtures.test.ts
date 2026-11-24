import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CHALLENGE_DIFFICULTY } from "expo-alarm";

import { PRESS_SCALE } from "@/components/ui/pressable/pressScale";
import { DHIKR_TASK_REVIEWED, DHIKR_TASK_ROWS } from "@/constants/DhikrTask";
import { RINGING_HALO, RINGING_TYPE } from "@/constants/AlarmRinging";
import { DURATION_MS } from "@/constants/Motion";
import { isPrayerId } from "@/constants/Prayer";
import {
  ANSWER_CARD_POSITIONS,
  ANSWER_CARD_STATE,
  BOARD_SWAP_MS,
  DHIKR_FILL_MS,
  DHIKR_HOLD_MS,
  DHIKR_SPOKEN_PAUSE,
  MATH_LEVELS,
  MATH_TAP,
  PATTERN_PADS,
  PATTERN_PAD_SIZE,
  PATTERN_TAP,
  PATTERN_TIMING,
  PRAYER_LINE,
  PRAYER_PLACE_EMPTY,
  PRAYER_PLACE_FILL_MS,
  PRAYER_TAP,
  SPOKEN_MS_PER_CHARACTER,
  TAP_OUTCOME,
  TAP_PRESSES,
  TAP_PRESS_MIN_GAP_MS,
  WRONG_CARD_HOLD_MS,
  type AnswerCardPosition,
  type PatternPad,
} from "@/constants/WakeTaskBoards";
import {
  HANDOVER_MS,
  QUIET_EVENT,
  QUIET_PHASE,
  QUIET_SIGNAL,
  TASK_CLOCK_TICK_MS,
  TASK_ENTER_MS,
  type QuietEvent,
} from "@/constants/WakeTaskShell";
import type { ChallengeDifficulty } from "@/types/alarm";
import { dhikrLineOf, drawDhikrRound, fullDhikr, spokenDhikrLine } from "@/utils/dhikrTask";
import {
  cardStateOf,
  mathLineOf,
  replaceQuestion,
  startMathBoard,
  tapMathCard,
  type MathBoardState,
} from "@/utils/mathBoard";
import { mathRound, type MathQuestion } from "@/utils/mathCards";
import {
  drawPattern,
  playbackFrame,
  playbackStarts,
  playbackTiming,
  tapPad,
  type PatternState,
} from "@/utils/patternOrder";
import {
  reshuffleUnplaced,
  startBoard,
  tapPrayer,
  type PrayerBoardState,
} from "@/utils/prayerOrder";
import {
  endWrongHold,
  placedSaidOf,
  placesSpokenOf,
  prayerCardStateOf,
  prayerLineOf,
  startPrayersBoard,
  tapPrayerCard,
  type PlaceSaid,
  type PrayersBoardState,
} from "@/utils/prayersBoard";
import { drawInt, seededRng, shuffled, type Rng } from "@/utils/rng";
import {
  advanceTaskClock,
  endQuiet,
  quietFraction,
  quietPhase,
  quietSecondsFor,
  quietSecondsLeft,
  restartQuiet,
  resumeTaskClock,
  startTaskClock,
  stepQuiet,
  wayOutShown,
  type ClockReading,
  type TaskClock,
} from "@/utils/taskClock";
import { countsPress, pressTap, startTapBoard, tapStatusOf } from "@/utils/tapPress";

// The Android overlay's JVM tests (TaskRngTest, TaskClockTest, TaskQuietTest,
// MathCardsTest, MathBoardRunTest, PrayerOrderTest, PrayersBoardRunTest, PatternOrderTest,
// DhikrBoardRunTest, TapPressTest) read the same tables.
const FIXTURES = join(__dirname, "..", "..", "..", "modules", "expo-alarm", "fixtures");

const NONE = "-";

/** What a spoken line in the tables calls its gap; the JVM tests' FIXTURE_GAP matches. */
const FIXTURE_GAP = "gap";

/** The op words the tables use; the JVM tests' FixtureOp holds the same. */
const FIXTURE_OP = {
  NEXT: "next",
  INT: "int",
  SHUFFLE: "shuffle",
  SHUFFLE_INT: "shuffleInt",
  START: "start",
  ADVANCE: "advance",
  TICKS: "ticks",
  RESTART: "restart",
  END: "end",
  RESUME: "resume",
  TAP: "tap",
  RESHUFFLE: "reshuffle",
  DRAW: "draw",
  REDRAW: "redraw",
  REPLACE: "replace",
  STEP: "step",
  HOLD: "hold",
} as const;
const SECOND_MS = 1000;
const UINT_RANGE = 2 ** 32;

// Rows of a tab-separated fixture, header dropped.
const readCases = (file: string): string[][] =>
  readFileSync(join(FIXTURES, file), "utf8")
    .split("\n")
    .slice(1)
    .filter((line) => line.length > 0)
    .map((line) => line.split("\t"));

const ints = (cell: string): number[] => cell.split(",").map(Number);

const bool = (cell: string): boolean => {
  if (cell !== String(true) && cell !== String(false)) throw new Error(`not a boolean: ${cell}`);
  return cell === String(true);
};

/** Rows grouped by their first cell, in table order. */
const byCase = (rows: string[][]): [string, string[][]][] => [
  ...rows
    .reduce((cases, row) => cases.set(row[0], [...(cases.get(row[0]) ?? []), row]), new Map())
    .entries(),
];

const DIFFICULTIES: readonly ChallengeDifficulty[] = Object.values(CHALLENGE_DIFFICULTY);

const difficultyOf = (cell: string): ChallengeDifficulty => {
  const found = DIFFICULTIES.find((id) => id === cell);
  if (!found) throw new Error(`unknown difficulty ${cell}`);
  return found;
};

const positionOf = (cell: string): AnswerCardPosition => {
  const found = ANSWER_CARD_POSITIONS.find((position) => String(position) === cell);
  if (found === undefined) throw new Error(`unknown card position ${cell}`);
  return found;
};

const padOf = (cell: string): PatternPad => {
  const found = PATTERN_PADS.find((pad) => pad === cell);
  if (!found) throw new Error(`unknown pad ${cell}`);
  return found;
};

describe("rng.tsv", () => {
  const rows = readCases("rng.tsv");
  const rowsOf = (op: string) => rows.filter(([kind]) => kind === op).map((row) => row.slice(1));

  it.each(rowsOf(FIXTURE_OP.NEXT))("seed %s draws its sequence", (seed, count, values) => {
    const rng = seededRng(Number(seed));
    const drawn = Array.from({ length: Number(count) }, () => rng() * UINT_RANGE);
    expect(drawn).toEqual(ints(values));
  });

  it.each(rowsOf(FIXTURE_OP.INT))("seed %s draws whole numbers %s", (seed, args, values) => {
    const [min, max, count] = ints(args);
    const rng = seededRng(Number(seed));
    expect(Array.from({ length: count }, () => drawInt(rng, min, max))).toEqual(ints(values));
  });

  it.each(rowsOf(FIXTURE_OP.SHUFFLE))("seed %s shuffles %s items", (seed, size, values) => {
    const items = Array.from({ length: Number(size) }, (_, index) => index);
    expect(shuffled(items, seededRng(Number(seed)))).toEqual(ints(values));
  });

  it.each(rowsOf(FIXTURE_OP.SHUFFLE_INT))(
    "seed %s shuffles, then draws %s",
    (seed, args, values) => {
      const [size, min, max] = ints(args);
      const rng = seededRng(Number(seed));
      const order = shuffled(
        Array.from({ length: size }, (_, index) => index),
        rng
      );
      expect([...order, drawInt(rng, min, max)]).toEqual(ints(values));
    }
  );
});

describe("task-clock.tsv", () => {
  const quietMs = (screenReader: string) => quietSecondsFor(bool(screenReader)) * SECOND_MS;

  // Reads every tick from the last counted moment up to `to`.
  const ticks = (clock: TaskClock, to: number, audible: boolean): TaskClock => {
    let out = clock;
    for (let at = clock.countedTo + TASK_CLOCK_TICK_MS; at <= to; at += TASK_CLOCK_TICK_MS) {
      out = advanceTaskClock(out, at, audible);
    }
    return out;
  };

  const apply = (clock: TaskClock | null, [op, nowCell, audible, reader]: string[]) => {
    const now = Number(nowCell);
    if (op === FIXTURE_OP.START) return startTaskClock(now, quietMs(reader));
    if (!clock) throw new Error(`${op} before start`);
    switch (op) {
      case FIXTURE_OP.ADVANCE:
        return advanceTaskClock(clock, now, bool(audible));
      case FIXTURE_OP.TICKS:
        return ticks(clock, now, bool(audible));
      case FIXTURE_OP.RESTART:
        return restartQuiet(clock, now, quietMs(reader), bool(audible));
      case FIXTURE_OP.END:
        return endQuiet(clock, now, bool(audible));
      case FIXTURE_OP.RESUME:
        return resumeTaskClock(clock, now);
      default:
        throw new Error(`unknown op ${op}`);
    }
  };

  const shown = (clock: TaskClock, now: number): string[] =>
    [
      clock.quietUntil,
      clock.quietMs,
      clock.soundingMs,
      clock.countedTo,
      quietPhase(clock, now),
      quietSecondsLeft(clock, now),
      quietFraction(clock, now, false),
      quietFraction(clock, now, true),
      wayOutShown(clock),
    ].map(String);

  // Where the phase sits among the expected columns.
  const PHASE_COLUMN = 4;

  it.each(byCase(readCases("task-clock.tsv")))("%s", (_name, rows) => {
    rows.reduce<TaskClock | null>((clock, row) => {
      const next = apply(clock, row.slice(1, 5));
      const expected = row.slice(5);
      expect(Object.values(QUIET_PHASE)).toContain(expected[PHASE_COLUMN]);
      expect(shown(next, Number(row[2]))).toEqual(expected);
      return next;
    }, null);
  });
});

describe("quiet-step.tsv", () => {
  const events: readonly string[] = Object.values(QUIET_EVENT);
  const isEvent = (op: string): op is QuietEvent => events.includes(op);

  // One op on a reading, and the signals it sent; "ticks" reads every tick up to `now`.
  const apply = (reading: ClockReading | null, [op, nowCell, audibleCell, reader]: string[]) => {
    const now = Number(nowCell);
    const quietMs = quietSecondsFor(bool(reader)) * SECOND_MS;
    if (op === FIXTURE_OP.START)
      return { reading: { clock: startTaskClock(now, quietMs), now }, sent: [] };
    if (!reading) throw new Error(`${op} before start`);
    if (op === FIXTURE_OP.RESUME) {
      return { reading: { clock: resumeTaskClock(reading.clock, now), now }, sent: [] };
    }
    const audible = bool(audibleCell);
    const sent: string[] = [];
    let out = reading;
    const send = (event: QuietEvent, at: number) => {
      const step = stepQuiet(out, event, at, quietMs, audible);
      out = step.reading;
      if (step.signal) sent.push(step.signal);
    };
    if (op === FIXTURE_OP.TICKS) {
      for (let at = out.now + TASK_CLOCK_TICK_MS; at <= now; at += TASK_CLOCK_TICK_MS) {
        send(QUIET_EVENT.TICK, at);
      }
    } else if (isEvent(op)) send(op, now);
    else throw new Error(`unknown op ${op}`);
    return { reading: out, sent };
  };

  it.each(byCase(readCases("quiet-step.tsv")))("%s", (_name, rows) => {
    rows.reduce<ClockReading | null>((reading, row) => {
      const { reading: next, sent } = apply(reading, row.slice(1, 5));
      const { clock, now } = next;
      const signals = row[10] === NONE ? [] : row[10].split(",");
      signals.forEach((signal) => expect(Object.values(QUIET_SIGNAL)).toContain(signal));
      expect(
        [clock.quietUntil, clock.quietMs, clock.soundingMs, clock.countedTo, now].map(String)
      ).toEqual(row.slice(5, 10));
      expect(sent).toEqual(signals);
      return next;
    }, null);
  });
});

describe("math-round.tsv", () => {
  const rows = readCases("math-round.tsv");

  it.each(rows)("%s seed %s after %s", (id, seed, previous, left, right, answer, cards) => {
    const difficulty = difficultyOf(id);
    const asked = (): MathQuestion => {
      const [askedLeft, askedRight] = ints(previous);
      return { operation: MATH_LEVELS[difficulty].operation, left: askedLeft, right: askedRight };
    };
    const round = mathRound(
      difficulty,
      seededRng(Number(seed)),
      previous === NONE ? undefined : asked()
    );
    expect([round.question.left, round.question.right, round.answer]).toEqual(
      [left, right, answer].map(Number)
    );
    expect(round.cards).toEqual(ints(cards));
  });

  it("covers every difficulty", () => {
    expect(new Set(rows.map(([id]) => id))).toEqual(new Set(DIFFICULTIES));
  });
});

describe("math-board.tsv", () => {
  const cases = byCase(readCases("math-board.tsv"));

  it.each(cases)("%s", (_name, rows) => {
    let rng: Rng | null = null;
    let state: MathBoardState | null = null;
    for (const [, id, op, arg, outcome, question, cards, states, line, asked] of rows) {
      const difficulty = difficultyOf(id);
      let said = NONE;
      if (op === FIXTURE_OP.START) {
        rng = seededRng(Number(arg));
        state = startMathBoard(difficulty, rng);
      } else if (op === FIXTURE_OP.STEP && rng) {
        state = startMathBoard(difficulty, rng);
      } else if (op === FIXTURE_OP.TAP && state) {
        const tap = tapMathCard(state, positionOf(arg));
        said = tap.outcome;
        if ("state" in tap) state = tap.state;
      } else if (op === FIXTURE_OP.REPLACE && state && rng) {
        state = replaceQuestion(state, difficulty, rng);
      } else {
        throw new Error(`unknown op ${op}`);
      }
      const board = state;
      const { left, right } = board.round.question;
      const shown = ANSWER_CARD_POSITIONS.map((position) => cardStateOf(board, position));
      expect([
        said,
        `${left},${right}`,
        board.round.cards.join(","),
        shown.join(","),
        mathLineOf(board),
        String(board.asked),
      ]).toEqual([outcome, question, cards, states, line, asked]);
    }
  });

  it("covers every difficulty, every outcome and every card missed", () => {
    const rows = cases.flatMap(([, caseRows]) => caseRows);
    expect(new Set(rows.map((row) => row[1]))).toEqual(new Set(DIFFICULTIES));
    expect(new Set(rows.map((row) => row[4]))).toEqual(new Set([NONE, ...Object.values(MATH_TAP)]));
    const missed = rows.filter((row) => row[4] === MATH_TAP.WRONG).map((row) => row[3]);
    expect(new Set(missed)).toEqual(new Set(ANSWER_CARD_POSITIONS.map(String)));
  });
});

describe("prayer-order.tsv", () => {
  it.each(byCase(readCases("prayer-order.tsv")))("%s", (_name, rows) => {
    let rng: Rng | null = null;
    let state: PrayerBoardState | null = null;
    for (const [, op, arg, outcome, deal, placed] of rows) {
      let said = NONE;
      if (op === FIXTURE_OP.START) {
        rng = seededRng(Number(arg));
        state = startBoard(rng);
      } else if (op === FIXTURE_OP.TAP && state) {
        const tap = tapPrayer(state, Number(arg));
        said = tap.outcome;
        if ("state" in tap) state = tap.state;
      } else if (op === FIXTURE_OP.RESHUFFLE && state && rng) {
        state = reshuffleUnplaced(state, rng);
      } else {
        throw new Error(`unknown op ${op}`);
      }
      expect([NONE, ...Object.values(PRAYER_TAP)]).toContain(outcome);
      expect(deal.split(",").every(isPrayerId)).toBe(true);
      expect([said, state.deal.join(","), String(state.placed)]).toEqual([outcome, deal, placed]);
    }
  });
});

describe("prayers-board.tsv", () => {
  const cases = byCase(readCases("prayers-board.tsv"));
  /** Each sentence as `part:prayer`, joined by commas. */
  const saidCell = (said: PlaceSaid[]) =>
    said.length === 0 ? NONE : said.map(({ part, prayer }) => `${part}:${prayer}`).join(",");

  it.each(cases)("%s", (_name, rows) => {
    let rng: Rng | null = null;
    let state: PrayersBoardState | null = null;
    for (const [, op, arg, ...expected] of rows) {
      let outcome = NONE;
      let said = NONE;
      if (op === FIXTURE_OP.START) {
        rng = seededRng(Number(arg));
        state = startPrayersBoard(rng);
      } else if (op === FIXTURE_OP.TAP && state) {
        const tap = tapPrayerCard(state, Number(arg));
        outcome = tap.outcome;
        if ("state" in tap) state = tap.state;
        if (tap.outcome === PRAYER_TAP.PLACED) said = saidCell(placedSaidOf(tap.state));
      } else if (op === FIXTURE_OP.HOLD && state && rng) {
        state = endWrongHold(state, rng);
      } else {
        throw new Error(`unknown op ${op}`);
      }
      const board = state;
      const line = prayerLineOf(board);
      expect([
        outcome,
        board.order.deal.join(","),
        String(board.order.placed),
        board.order.deal.map((_, slot) => prayerCardStateOf(board, slot)).join(","),
        "prayer" in line ? `${line.line}:${line.prayer}` : line.line,
        saidCell(placesSpokenOf(board)),
        said,
        String(board.deals),
        String(board.solved),
      ]).toEqual(expected);
    }
  });

  it("holds every outcome, card state and line", () => {
    const rows = cases.flatMap(([, caseRows]) => caseRows);
    expect(new Set(rows.map((row) => row[3]))).toEqual(
      new Set([NONE, ...Object.values(PRAYER_TAP)])
    );
    expect(new Set(rows.flatMap((row) => row[6].split(",")))).toEqual(
      new Set(Object.values(ANSWER_CARD_STATE))
    );
    expect(new Set(rows.map((row) => row[7].split(":")[0]))).toEqual(
      new Set(Object.values(PRAYER_LINE))
    );
  });
});

describe("dhikr-rows.tsv", () => {
  it("holds the app's rows, in order", () => {
    expect(readCases("dhikr-rows.tsv")).toEqual(
      DHIKR_TASK_ROWS.map((row, index) => [
        String(index),
        String(row.sourceId),
        row.before,
        row.after,
        row.answer,
        ...row.others,
      ])
    );
  });
});

describe("dhikr-draw.tsv", () => {
  it.each(byCase(readCases("dhikr-draw.tsv")))("%s", (_name, rows) => {
    let rng: Rng | null = null;
    let seen: number[] = [];
    for (const [, op, arg, drawn, row, cards] of rows) {
      if (op === FIXTURE_OP.START) {
        rng = seededRng(Number(arg));
        seen = drawn === NONE ? [] : ints(drawn);
      } else if (op !== FIXTURE_OP.DRAW) {
        throw new Error(`unknown op ${op}`);
      }
      if (!rng) throw new Error("no start");
      const round = drawDhikrRound(DHIKR_TASK_ROWS, seen, rng);
      const expected = DHIKR_TASK_ROWS[Number(row)];
      const dealt = [expected.answer, ...expected.others];
      expect(round.row).toBe(Number(row));
      expect(round.cards).toEqual(ints(cards).map((card) => dealt[card]));
      seen = [...seen, round.row];
    }
  });
});

describe("dhikr-line.tsv", () => {
  const rows = readCases("dhikr-line.tsv");

  it.each(rows)("row %s is said as the table says", (index, full, spoken) => {
    const row = DHIKR_TASK_ROWS[Number(index)];
    expect(fullDhikr(row)).toBe(full);
    expect(spokenDhikrLine(row, FIXTURE_GAP, DHIKR_SPOKEN_PAUSE)).toBe(spoken);
  });

  it.each(rows)("row %s keeps to the gap the words the table says", (index, ...cells) => {
    const line = dhikrLineOf(DHIKR_TASK_ROWS[Number(index)]);
    expect(line.touchingBefore !== null).toBe(bool(cells[2]));
    expect(line.touchingAfter !== null).toBe(bool(cells[3]));
  });

  it("holds every row", () => {
    expect(rows.map(([index]) => Number(index))).toEqual(DHIKR_TASK_ROWS.map((_, index) => index));
  });
});

describe("pattern-order.tsv", () => {
  it.each(byCase(readCases("pattern-order.tsv")))("%s", (_name, rows) => {
    let rng: Rng | null = null;
    let state: PatternState | null = null;
    for (const [, op, arg, outcome, pattern, done] of rows) {
      let said = NONE;
      if (op === FIXTURE_OP.DRAW) {
        const [id, seed] = arg.split(":");
        rng = seededRng(Number(seed));
        state = { pattern: drawPattern(difficultyOf(id), rng), done: 0 };
      } else if (op === FIXTURE_OP.REDRAW && state && rng) {
        state = { pattern: drawPattern(difficultyOf(arg), rng, state.pattern), done: 0 };
      } else if (op === FIXTURE_OP.TAP && state) {
        const tap = tapPad(state, padOf(arg));
        said = tap.outcome;
        if ("state" in tap) state = tap.state;
      } else {
        throw new Error(`unknown op ${op}`);
      }
      expect([NONE, ...Object.values(PATTERN_TAP)]).toContain(outcome);
      expect([said, state.pattern.join(","), String(state.done)]).toEqual([outcome, pattern, done]);
    }
  });
});

describe("pattern-playback.tsv", () => {
  it.each(readCases("pattern-playback.tsv"))(
    "motion %s, reader %s, length %s",
    (reduceMotion, screenReader, lengthCell, starts, frames) => {
      const length = Number(lengthCell);
      const timing = playbackTiming({
        reduceMotion: bool(reduceMotion),
        screenReader: bool(screenReader),
      });
      expect(playbackStarts(length, timing)).toEqual(ints(starts));
      const shown = Array.from({ length: 2 * length + 2 }, (_, step) => {
        const frame = playbackFrame(step, length);
        return `${frame.lit ?? NONE}/${frame.shown}/${frame.playing}`;
      });
      expect(shown).toEqual(frames.split(","));
    }
  );
});

describe("tap-press.tsv", () => {
  it.each(readCases("tap-press.tsv"))("after %s, a press at %s counts: %s", (last, now, counts) => {
    expect(countsPress(last === NONE ? null : Number(last), Number(now))).toBe(bool(counts));
  });
});

describe("tap-board.tsv", () => {
  const rows = readCases("tap-board.tsv");

  it.each(byCase(rows))("%s replays", (_name, steps) => {
    let state = startTapBoard();
    for (const [, at, outcome, done, status] of steps) {
      const tap = pressTap(state, Number(at));
      state = tap.state;
      const said = tapStatusOf(state.done);
      expect([tap.outcome, state.done, said === null ? NONE : String(said)]).toEqual([
        outcome,
        Number(done),
        status,
      ]);
    }
  });

  it("holds every outcome", () => {
    expect(new Set(rows.map((row) => row[2]))).toEqual(new Set(Object.values(TAP_OUTCOME)));
  });
});

describe("shell-constants.tsv", () => {
  /** The JS value each row pins; the native shell reads the same rows. */
  const SHELL_CONSTANTS: Record<string, number> = {
    TAP_PRESSES,
    TAP_PRESS_MIN_GAP_MS,
    WRONG_CARD_HOLD_MS,
    HANDOVER_SHOWN_MS: HANDOVER_MS.IN + HANDOVER_MS.HOLD,
    BOARD_SWAP_IN_MS: BOARD_SWAP_MS.IN,
    PRESS_SCALE,
    PRESS_DOWN_MS: DURATION_MS.PRESS,
    PRAYER_PLACE_FILL_MS,
    PATTERN_WRONG_HOLD_MS: PATTERN_TIMING.WRONG_HOLD,
    PATTERN_FADE_MS: PATTERN_TIMING.FADE,
    PATTERN_PAD_HEIGHT: PATTERN_PAD_SIZE.HEIGHT,
    PATTERN_PAD_SHAPE: PATTERN_PAD_SIZE.SHAPE,
    PATTERN_PAD_STROKE: PATTERN_PAD_SIZE.STROKE,
    DHIKR_FILL_MS,
    DHIKR_HOLD_MS: DHIKR_HOLD_MS.DEFAULT,
    DHIKR_READER_HOLD_MS: DHIKR_HOLD_MS.SCREEN_READER,
    SPOKEN_MS_PER_CHARACTER,
    TASK_ENTER_MS,
    RINGING_NAME_SIZE: RINGING_TYPE.NAME.fontSize,
    RINGING_TIME_SIZE: RINGING_TYPE.TIME.fontSize,
    RINGING_HALO_SIZE: RINGING_HALO.SIZE,
    RINGING_HALO_RING: RINGING_HALO.RING,
    RINGING_HALO_BREATH_MS: RINGING_HALO.BREATH_MS,
    RINGING_HALO_SCALE: RINGING_HALO.SCALE,
    RINGING_HALO_REST_OPACITY: RINGING_HALO.REST_OPACITY,
    RINGING_HALO_LOW_OPACITY: RINGING_HALO.LOW_OPACITY,
  };

  const rows = readCases("shell-constants.tsv");

  it.each(rows)("%s is %s", (name, value) => {
    expect(SHELL_CONSTANTS[name]).toBe(Number(value));
  });

  it("pins every constant", () => {
    expect(rows.map(([name]) => name)).toEqual(Object.keys(SHELL_CONSTANTS));
  });
});

describe("shell-text.tsv", () => {
  /** The JS text each row pins; the native boards read the same rows. */
  const SHELL_TEXT: Record<string, string> = {
    PRAYER_PLACE_EMPTY,
    DHIKR_TASK_REVIEWED: String(DHIKR_TASK_REVIEWED),
  };

  const rows = readCases("shell-text.tsv");

  it.each(rows)("%s is %s", (name, value) => {
    expect(SHELL_TEXT[name]).toBe(value);
  });

  it("pins every text", () => {
    expect(rows.map(([name]) => name)).toEqual(Object.keys(SHELL_TEXT));
  });
});
