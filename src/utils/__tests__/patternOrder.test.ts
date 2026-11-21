import { CHALLENGE_DIFFICULTY } from "expo-alarm";

import {
  PATTERN_LENGTH,
  PATTERN_PAD,
  PATTERN_PADS,
  PATTERN_TAP,
  PATTERN_TIMING,
  type PatternPad,
} from "@/constants/WakeTaskBoards";
import { CHALLENGE_DIFFICULTIES, type ChallengeDifficulty } from "@/types/alarm";
import {
  drawPattern,
  patternAt,
  patternCount,
  playbackFrame,
  playbackStarts,
  playbackTiming,
  rankOf,
  tapPad,
  type PadPattern,
} from "@/utils/patternOrder";
import { drawInt, seededRng } from "@/utils/rng";

const SEEDS = Array.from({ length: 400 }, (_, seed) => seed + 1);

/** A source that repeats one draw, so every order it makes is alike. */
const stuck = (value: number) => () => value;

/** Taps `taps` in turn and says whether the order was repeated. */
const solves = (pattern: PadPattern, taps: readonly PatternPad[]): boolean => {
  let state = { pattern, done: 0 };
  for (const pad of taps) {
    const result = tapPad(state, pad);
    if (result.outcome === PATTERN_TAP.WRONG) return false;
    if (result.outcome === PATTERN_TAP.DONE) return true;
    state = result.state;
  }
  return false;
};

/** How often `guess` repeats a fresh order, over `rounds` orders. */
const solveRate = (
  difficulty: (typeof CHALLENGE_DIFFICULTIES)[number],
  guess: (length: number) => PatternPad[],
  rounds: number
) => {
  const orders = seededRng(7);
  let solved = 0;
  let previous: PadPattern | undefined;
  for (let round = 0; round < rounds; round += 1) {
    const pattern = drawPattern(difficulty, orders, previous);
    if (solves(pattern, guess(pattern.length))) solved += 1;
    previous = pattern;
  }
  return solved / rounds;
};

describe("drawPattern", () => {
  describe.each(CHALLENGE_DIFFICULTIES)("at %s", (difficulty) => {
    const length = PATTERN_LENGTH[difficulty];

    it("draws the level's length from the four pads, before and after a miss", () => {
      for (const seed of SEEDS) {
        const rng = seededRng(seed);
        const first = drawPattern(difficulty, rng);
        const next = drawPattern(difficulty, rng, first);
        for (const pattern of [first, next]) {
          expect(pattern).toHaveLength(length);
          pattern.forEach((pad) => expect(PATTERN_PADS).toContain(pad));
        }
      }
    });

    it("draws another order than the one a miss replaces", () => {
      for (const seed of SEEDS) {
        const rng = seededRng(seed);
        let previous = drawPattern(difficulty, rng);
        for (let miss = 0; miss < 10; miss += 1) {
          const next = drawPattern(difficulty, rng, previous);
          expect(next).not.toEqual(previous);
          previous = next;
        }
      }
    });

    it("moves off the replaced order even when the draws repeat", () => {
      [0, 0.5, 0.999999].forEach((value) => {
        const previous = drawPattern(difficulty, stuck(value));
        expect(drawPattern(difficulty, stuck(value), previous)).not.toEqual(previous);
      });
    });

    it("can repeat a pad back to back and reaches every order", () => {
      const seen = new Set<number>();
      const rng = seededRng(3);
      for (let draw = 0; draw < patternCount(length) * 40; draw += 1) {
        seen.add(rankOf(drawPattern(difficulty, rng)));
      }
      expect(seen.size).toBe(patternCount(length));
      expect(seen.has(rankOf(Array.from({ length }, () => PATTERN_PAD.CIRCLE)))).toBe(true);
    });

    // Blind tapping: every order is as likely as any other, so no tap
    // sequence, random or fixed, beats one in 4 to the length.
    it("lets a blind tapper through about one time in four to the length", () => {
      const rounds = 40000;
      const chance = 1 / patternCount(length);
      const taps = seededRng(99);
      const random = (n: number) =>
        Array.from({ length: n }, () => PATTERN_PADS[drawInt(taps, 0, PATTERN_PADS.length - 1)]);
      const fixed = (n: number) => Array.from({ length: n }, () => PATTERN_PAD.CIRCLE);
      const tolerance = 4 * Math.sqrt(chance / rounds);
      for (const guess of [random, fixed]) {
        expect(Math.abs(solveRate(difficulty, guess, rounds) - chance)).toBeLessThan(tolerance);
      }
    });
  });

  it("draws the order alone from the source it is given", () => {
    const a = seededRng(5);
    const b = seededRng(5);
    expect(drawPattern(CHALLENGE_DIFFICULTY.HARD, a)).toEqual(
      drawPattern(CHALLENGE_DIFFICULTY.HARD, b)
    );
    expect(a()).toBe(b());
  });

  // The orders a Kotlin twin must also draw: the first, then after one miss.
  const { CIRCLE: C, TRIANGLE: T, SQUARE: S, LINES: L } = PATTERN_PAD;
  it.each<[ChallengeDifficulty, number, PadPattern, PadPattern]>([
    [CHALLENGE_DIFFICULTY.EASY, 1, [S, S, C], [C, C, C]],
    [CHALLENGE_DIFFICULTY.EASY, 2, [S, L, S], [T, T, C]],
    [CHALLENGE_DIFFICULTY.MEDIUM, 1, [S, S, C, C], [C, C, C, C]],
    [CHALLENGE_DIFFICULTY.MEDIUM, 2, [S, L, S, L], [T, T, C, S]],
    [CHALLENGE_DIFFICULTY.HARD, 1, [S, S, C, C, S], [C, C, C, C, S]],
    [CHALLENGE_DIFFICULTY.HARD, 2, [S, L, S, L, L], [T, T, C, L, C]],
  ])("draws the reference orders at %s for seed %i", (difficulty, seed, first, afterMiss) => {
    const rng = seededRng(seed);
    const opening = drawPattern(difficulty, rng);
    expect(opening).toEqual(first);
    expect(drawPattern(difficulty, rng, opening)).toEqual(afterMiss);
  });
});

describe("patternAt", () => {
  it("reads a rank as base-4 digits over the pads, first pad first", () => {
    expect(patternAt(3, 0)).toEqual([PATTERN_PAD.CIRCLE, PATTERN_PAD.CIRCLE, PATTERN_PAD.CIRCLE]);
    expect(patternAt(3, 1 * 16 + 2 * 4 + 3)).toEqual([
      PATTERN_PAD.TRIANGLE,
      PATTERN_PAD.SQUARE,
      PATTERN_PAD.LINES,
    ]);
  });

  it("gives each rank its own order, and rankOf reads it back", () => {
    const length = PATTERN_LENGTH[CHALLENGE_DIFFICULTY.MEDIUM];
    for (let rank = 0; rank < patternCount(length); rank += 1) {
      expect(rankOf(patternAt(length, rank))).toBe(rank);
    }
  });
});

describe("tapPad", () => {
  const pattern = [PATTERN_PAD.SQUARE, PATTERN_PAD.SQUARE, PATTERN_PAD.LINES];

  it("counts each pad in order and reports done on the last", () => {
    const first = tapPad({ pattern, done: 0 }, PATTERN_PAD.SQUARE);
    expect(first).toEqual({ outcome: PATTERN_TAP.NEXT, state: { pattern, done: 1 } });
    const second = tapPad({ pattern, done: 1 }, PATTERN_PAD.SQUARE);
    expect(second).toEqual({ outcome: PATTERN_TAP.NEXT, state: { pattern, done: 2 } });
    expect(tapPad({ pattern, done: 2 }, PATTERN_PAD.LINES)).toEqual({
      outcome: PATTERN_TAP.DONE,
      state: { pattern, done: 3 },
    });
  });

  it("calls any other pad wrong, at any point", () => {
    expect(tapPad({ pattern, done: 0 }, PATTERN_PAD.CIRCLE).outcome).toBe(PATTERN_TAP.WRONG);
    expect(tapPad({ pattern, done: 2 }, PATTERN_PAD.SQUARE).outcome).toBe(PATTERN_TAP.WRONG);
  });
});

describe("playback", () => {
  const length = 3;
  const timing = { leadIn: 500, lit: 500, gap: 250 };

  it("times a lead-in, then each pad lit and off, then the turn", () => {
    expect(playbackStarts(length, timing)).toEqual([0, 500, 1000, 1250, 1750, 2000, 2500]);
  });

  it("lights each pad once in order and ends on the turn", () => {
    const frames = playbackStarts(length, timing).map((_, step) => playbackFrame(step, length));
    expect(frames.map(({ lit }) => lit)).toEqual([null, 0, null, 1, null, 2, null]);
    expect(frames.map(({ shown }) => shown)).toEqual([0, 1, 1, 2, 2, 3, 3]);
    expect(frames.map(({ playing }) => playing)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it("holds each pad longer under Reduce Motion and widens the gaps for a reader", () => {
    expect(playbackTiming({ reduceMotion: false, screenReader: false })).toEqual({
      leadIn: PATTERN_TIMING.LEAD_IN.DEFAULT,
      lit: PATTERN_TIMING.LIT.DEFAULT,
      gap: PATTERN_TIMING.GAP.DEFAULT,
    });
    const reduced = playbackTiming({ reduceMotion: true, screenReader: false });
    expect(reduced.lit).toBeGreaterThan(PATTERN_TIMING.LIT.DEFAULT);
    const read = playbackTiming({ reduceMotion: false, screenReader: true });
    expect(read.gap).toBeGreaterThan(PATTERN_TIMING.GAP.DEFAULT);
    expect(read.leadIn).toBeGreaterThan(PATTERN_TIMING.LEAD_IN.DEFAULT);
  });

  // A reader hears the order as one sentence while it plays; the turn
  // should not open long before an unhurried reading of it ends.
  it("plays the longest order for a reader at least a second per pad", () => {
    const longest = PATTERN_LENGTH[CHALLENGE_DIFFICULTY.HARD];
    const starts = playbackStarts(
      longest,
      playbackTiming({ reduceMotion: false, screenReader: true })
    );
    expect(starts[starts.length - 1]).toBeGreaterThanOrEqual(longest * 1000);
  });
});
