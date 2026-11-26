import {
  PATTERN_LENGTH,
  PATTERN_PADS,
  PATTERN_TAP,
  PATTERN_TIMING,
  type PatternPad,
} from "@/constants/WakeTaskBoards";
import type { ChallengeDifficulty } from "@/types/alarm";
import { drawInt, type Rng } from "@/utils/rng";

/** The pads to tap, in order; a pad may follow itself. */
export type PadPattern = readonly PatternPad[];

/** An order and how many of its pads are tapped so far. */
export type PatternState = { pattern: PadPattern; done: number };

export type PatternTap =
  | { outcome: typeof PATTERN_TAP.NEXT | typeof PATTERN_TAP.DONE; state: PatternState }
  | { outcome: typeof PATTERN_TAP.WRONG };

const PADS = PATTERN_PADS.length;

/** How many orders of `length` there are. */
export const patternCount = (length: number): number => PADS ** length;

/** The order at `rank`: its base-4 digits over the pads, first pad first. */
export const patternAt = (length: number, rank: number): PadPattern =>
  Array.from(
    { length },
    (_, index) => PATTERN_PADS[Math.floor(rank / PADS ** (length - 1 - index)) % PADS]
  );

export const rankOf = (pattern: PadPattern): number =>
  pattern.reduce((rank, pad) => rank * PADS + PATTERN_PADS.indexOf(pad), 0);

/** Any order of the level's length, each alike, never `previous` again. */
export const drawPattern = (
  difficulty: ChallengeDifficulty,
  rng: Rng,
  previous?: PadPattern
): PadPattern => {
  const length = PATTERN_LENGTH[difficulty];
  const count = patternCount(length);
  if (previous?.length !== length) return patternAt(length, drawInt(rng, 0, count - 1));
  const skipped = rankOf(previous);
  const rank = drawInt(rng, 0, count - 2);
  return patternAt(length, rank >= skipped ? rank + 1 : rank);
};

export const tapPad = (state: PatternState, pad: PatternPad): PatternTap => {
  if (state.pattern[state.done] !== pad) return { outcome: PATTERN_TAP.WRONG };
  const done = state.done + 1;
  return {
    outcome: done === state.pattern.length ? PATTERN_TAP.DONE : PATTERN_TAP.NEXT,
    state: { ...state, done },
  };
};

export type PlaybackTiming = { leadIn: number; lit: number; gap: number };

export const playbackTiming = ({
  reduceMotion,
  screenReader,
}: {
  reduceMotion: boolean;
  screenReader: boolean;
}): PlaybackTiming => ({
  leadIn: screenReader ? PATTERN_TIMING.LEAD_IN.SCREEN_READER : PATTERN_TIMING.LEAD_IN.DEFAULT,
  lit: reduceMotion ? PATTERN_TIMING.LIT.REDUCED_MOTION : PATTERN_TIMING.LIT.DEFAULT,
  gap: screenReader ? PATTERN_TIMING.GAP.SCREEN_READER : PATTERN_TIMING.GAP.DEFAULT,
});

// Step start times in ms: a lead-in, each pad lit then off, then the turn,
// which opens as the last pad goes off.
export const playbackStarts = (length: number, { leadIn, lit, gap }: PlaybackTiming): number[] =>
  Array.from({ length: 2 * length + 1 }, (_, step) => {
    if (step === 0) return 0;
    const pad = Math.floor((step - 1) / 2);
    return leadIn + pad * (lit + gap) + (step % 2 === 0 ? lit : 0);
  });

export type PlaybackFrame = {
  /** The index in the order of the pad lit now, if any. */
  lit: number | null;
  /** How many pads have lit so far, the lit one included. */
  shown: number;
  playing: boolean;
};

export const playbackFrame = (step: number, length: number): PlaybackFrame => ({
  lit: step % 2 === 1 ? (step - 1) / 2 : null,
  shown: Math.ceil(step / 2),
  playing: step < 2 * length,
});
