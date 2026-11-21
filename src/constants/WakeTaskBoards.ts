import { CHALLENGE_DIFFICULTY } from "expo-alarm";

import { PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import type { ChallengeDifficulty } from "@/types/alarm";

/** The arithmetic a math question asks for. */
export const MATH_OPERATION = { ADD: "add", MULTIPLY: "multiply" } as const;

export type MathOperation = (typeof MATH_OPERATION)[keyof typeof MATH_OPERATION];

export type OperandRange = { min: number; max: number };

export type MathLevel = { operation: MathOperation; left: OperandRange; right: OperandRange };

/** Each difficulty's sum; both builds draw operands from these ranges. */
export const MATH_LEVELS = {
  [CHALLENGE_DIFFICULTY.EASY]: {
    operation: MATH_OPERATION.ADD,
    left: { min: 2, max: 9 },
    right: { min: 2, max: 9 },
  },
  [CHALLENGE_DIFFICULTY.MEDIUM]: {
    operation: MATH_OPERATION.ADD,
    left: { min: 11, max: 99 },
    right: { min: 2, max: 9 },
  },
  [CHALLENGE_DIFFICULTY.HARD]: {
    operation: MATH_OPERATION.MULTIPLY,
    left: { min: 11, max: 19 },
    right: { min: 3, max: 9 },
  },
} as const satisfies Record<ChallengeDifficulty, MathLevel>;

/** Gaps between a question's four cards; the answer takes any one slot. */
export const MATH_CARD_SHAPES = [
  [0, 1, 2, 3],
  [0, 1, 10, 11],
  [0, 2, 10, 12],
  [0, 10, 20, 30],
] as const;

/** Seeds a question's card order, so one question always lays out alike. */
export const MATH_OPERATION_SEED = {
  [MATH_OPERATION.ADD]: 1,
  [MATH_OPERATION.MULTIPLY]: 2,
} as const satisfies Record<MathOperation, number>;

/** The sign drawn between the two operands. */
export const MATH_SYMBOL = {
  [MATH_OPERATION.ADD]: "+",
  [MATH_OPERATION.MULTIPLY]: "×",
} as const satisfies Record<MathOperation, string>;

/** How a question is spoken, with each operand as a number. */
export const MATH_SPOKEN_KEY = {
  [MATH_OPERATION.ADD]: "a11y.alarm.task.math.add",
  [MATH_OPERATION.MULTIPLY]: "a11y.alarm.task.math.multiply",
} as const satisfies Record<MathOperation, string>;

/** How long a wrong card shows as wrong before its board goes on. */
export const WRONG_CARD_HOLD_MS = 600;

/** Replaced board content fades out over OUT as the new fades in over IN. */
export const BOARD_SWAP_MS = { OUT: 180, IN: 280 } as const;

/** Where a card sits in a board's grid, read in order. */
export const ANSWER_CARD_POSITIONS = [0, 1, 2, 3] as const;

export type AnswerCardPosition = (typeof ANSWER_CARD_POSITIONS)[number];

/** How a card says where it sits; Arabic names the place as an ordinal. */
export const ANSWER_CARD_PLACE_KEY = {
  0: "a11y.alarm.task.cardPlace.first",
  1: "a11y.alarm.task.cardPlace.second",
  2: "a11y.alarm.task.cardPlace.third",
  3: "a11y.alarm.task.cardPlace.fourth",
} as const satisfies Record<AnswerCardPosition, string>;

/** A card at rest, held while another is wrong, marked wrong, or placed. */
export const ANSWER_CARD_STATE = {
  REST: "rest",
  HELD: "held",
  WRONG: "wrong",
  PLACED: "placed",
} as const;

export type AnswerCardState = (typeof ANSWER_CARD_STATE)[keyof typeof ANSWER_CARD_STATE];

/** What a card holds: a numeral, a word such as a prayer's name, or a
 *  dhikr's word in the Arabic face. */
export const ANSWER_CARD_KIND = { NUMERAL: "numeral", WORD: "word", DHIKR: "dhikr" } as const;

export type AnswerCardKind = (typeof ANSWER_CARD_KIND)[keyof typeof ANSWER_CARD_KIND];

/** A card's least height by what it holds. */
export const ANSWER_CARD_MIN_HEIGHT = {
  [ANSWER_CARD_KIND.NUMERAL]: "$24",
  [ANSWER_CARD_KIND.WORD]: 72,
  [ANSWER_CARD_KIND.DHIKR]: 88,
} as const satisfies Record<AnswerCardKind, string | number>;

/** What a tap on a prayer card does to the board. */
export const PRAYER_TAP = {
  PLACED: "placed",
  DONE: "done",
  WRONG: "wrong",
  IGNORED: "ignored",
} as const;

export type PrayerTapOutcome = (typeof PRAYER_TAP)[keyof typeof PRAYER_TAP];

/** What each prayer's place is called, empty and filled. */
export const PRAYER_PLACE_KEY = {
  [PRAYER_ID.FAJR]: {
    empty: "a11y.alarm.task.prayers.empty.first",
    filled: "a11y.alarm.task.prayers.filled.first",
  },
  [PRAYER_ID.DHUHR]: {
    empty: "a11y.alarm.task.prayers.empty.second",
    filled: "a11y.alarm.task.prayers.filled.second",
  },
  [PRAYER_ID.ASR]: {
    empty: "a11y.alarm.task.prayers.empty.third",
    filled: "a11y.alarm.task.prayers.filled.third",
  },
  [PRAYER_ID.MAGHRIB]: {
    empty: "a11y.alarm.task.prayers.empty.fourth",
    filled: "a11y.alarm.task.prayers.filled.fourth",
  },
  [PRAYER_ID.ISHA]: {
    empty: "a11y.alarm.task.prayers.empty.fifth",
    filled: "a11y.alarm.task.prayers.filled.fifth",
  },
} as const satisfies Record<PrayerId, { empty: string; filled: string }>;

/** A prayer's name fades into its place over this. */
export const PRAYER_PLACE_FILL_MS = 160;

/** What an empty place draws where its prayer's name goes. */
export const PRAYER_PLACE_EMPTY = "–";

/** Presses the tap board asks for. */
export const TAP_PRESSES = 10;

/** Presses closer together than this count once. */
export const TAP_PRESS_MIN_GAP_MS = 150;

/** Type sizes the boards draw past the text scale, in pt. */
export const BOARD_TYPE = {
  SUM: { fontSize: 96, lineHeight: 110 },
  CARD_NUMERAL: { fontSize: 44, lineHeight: 51 },
  TAP_COUNT: { fontSize: 56, lineHeight: 73 },
  TAP_TARGET: { fontSize: 28, lineHeight: 42 },
  // Arabic with full tashkeel: the line box clears the marks on both sides.
  DHIKR: { fontSize: 30, lineHeight: 63 },
  CARD_DHIKR: { fontSize: 26, lineHeight: 49 },
} as const;

/** Asking for the word, holding the completed dhikr, or solved. */
export const DHIKR_PHASE = { ASKING: "asking", HELD: "held", SOLVED: "solved" } as const;

export type DhikrPhase = (typeof DHIKR_PHASE)[keyof typeof DHIKR_PHASE];

/** A dhikr's word fades into its gap over this. */
export const DHIKR_FILL_MS = 280;

/** How long a completed dhikr stays before another replaces it, in ms; a
 *  screen reader's hold also waits for the announcement, up to CEILING. */
export const DHIKR_HOLD_MS = { DEFAULT: 1500, SCREEN_READER: 5000, CEILING: 20000 } as const;

/** Android has no end-of-speech event: an announcement's time per character. */
export const SPOKEN_MS_PER_CHARACTER = 80;

/** Spoken either side of a dhikr's gap, so the gap is heard as one. */
export const DHIKR_SPOKEN_PAUSE = " … ";

/** Test ids for the boards' parts. */
export const BOARD_PART = {
  ANSWER_CARD: "answer-card",
  ANSWER_MARK: "answer-card-mark",
  MATH_SUM: "math-sum",
  MATH_LINE: "math-line",
  TAP_COUNT: "tap-count",
  TAP_TICK: "tap-tick",
  TAP_STATUS: "tap-status",
  PRAYER_PLACES: "prayer-places",
  PRAYER_PLACE: "prayer-place",
  PRAYER_LINE: "prayer-line",
  PRAYER_STATUS: "prayer-status",
  DHIKR_TEXT: "dhikr-text",
  DHIKR_SLOT: "dhikr-slot",
  DHIKR_NOTE: "dhikr-note",
  DHIKR_MESSAGE: "dhikr-message",
} as const;

/** The four pads, left to right then top to bottom, in every language. */
export const PATTERN_PAD = {
  CIRCLE: "circle",
  TRIANGLE: "triangle",
  SQUARE: "square",
  LINES: "lines",
} as const;

export type PatternPad = (typeof PATTERN_PAD)[keyof typeof PATTERN_PAD];

export const PATTERN_PADS: readonly PatternPad[] = Object.values(PATTERN_PAD);

/** Pads in each order; it never grows within one alarm. */
export const PATTERN_LENGTH = {
  [CHALLENGE_DIFFICULTY.EASY]: 3,
  [CHALLENGE_DIFFICULTY.MEDIUM]: 4,
  [CHALLENGE_DIFFICULTY.HARD]: 5,
} as const satisfies Record<ChallengeDifficulty, number>;

/** What a screen reader calls each pad's shape. */
export const PATTERN_PAD_NAME_KEY = {
  [PATTERN_PAD.CIRCLE]: "a11y.alarm.task.pattern.pad.circle",
  [PATTERN_PAD.TRIANGLE]: "a11y.alarm.task.pattern.pad.triangle",
  [PATTERN_PAD.SQUARE]: "a11y.alarm.task.pattern.pad.square",
  [PATTERN_PAD.LINES]: "a11y.alarm.task.pattern.pad.lines",
} as const satisfies Record<PatternPad, string>;

/** Where each pad sits; the grid stays left to right in Arabic too. */
export const PATTERN_PAD_PLACE_KEY = {
  [PATTERN_PAD.CIRCLE]: "a11y.alarm.task.pattern.place.topLeft",
  [PATTERN_PAD.TRIANGLE]: "a11y.alarm.task.pattern.place.topRight",
  [PATTERN_PAD.SQUARE]: "a11y.alarm.task.pattern.place.bottomLeft",
  [PATTERN_PAD.LINES]: "a11y.alarm.task.pattern.place.bottomRight",
} as const satisfies Record<PatternPad, string>;

/** Each shape on a 24-unit square, drawn as a stroke. */
export const PATTERN_SHAPE_VIEWBOX = "0 0 24 24";

/** A lit pad fills its shape; two lines have no inside to fill. */
export const PATTERN_PAD_FILLS = {
  [PATTERN_PAD.CIRCLE]: true,
  [PATTERN_PAD.TRIANGLE]: true,
  [PATTERN_PAD.SQUARE]: true,
  [PATTERN_PAD.LINES]: false,
} as const satisfies Record<PatternPad, boolean>;

/** A pad's height, its shape's size and the shape's stroke, in pt. */
export const PATTERN_PAD_SIZE = { HEIGHT: 148, SHAPE: 64, STROKE: 3 } as const;

/** Playback times in ms; a screen reader widens the gaps. */
export const PATTERN_TIMING = {
  LEAD_IN: { DEFAULT: 500, SCREEN_READER: 750 },
  LIT: { DEFAULT: 500, REDUCED_MOTION: 700 },
  GAP: { DEFAULT: 250, SCREEN_READER: 750 },
  /** A lit pad's fill fades in and out over this, without Reduce Motion. */
  FADE: 160,
  /** How long a wrong pad shows as wrong before a new order plays. */
  WRONG_HOLD: 1000,
} as const;

/** What a tap on a pad does to the board. */
export const PATTERN_TAP = { NEXT: "next", DONE: "done", WRONG: "wrong" } as const;

export type PatternTapOutcome = (typeof PATTERN_TAP)[keyof typeof PATTERN_TAP];

/** The order playing, being repeated, a wrong pad held, or repeated. */
export const PATTERN_PHASE = {
  WATCHING: "watching",
  REPEATING: "repeating",
  WRONG: "wrong",
  SOLVED: "solved",
} as const;

export type PatternPhase = (typeof PATTERN_PHASE)[keyof typeof PATTERN_PHASE];

/** A pad at rest, lit, marked wrong, or held while it takes no tap. */
export const PATTERN_PAD_STATE = {
  REST: "rest",
  LIT: "lit",
  WRONG: "wrong",
  HELD: "held",
} as const;

export type PatternPadState = (typeof PATTERN_PAD_STATE)[keyof typeof PATTERN_PAD_STATE];

/** The screen-reader action that says the current order again. */
export const PATTERN_HEAR_AGAIN = "hearAgain";

/** Test ids for the pattern board's parts. */
export const PATTERN_PART = {
  PADS: "pattern-pads",
  PAD: "pattern-pad",
  PAD_FILL: "pattern-pad-fill",
  LINE: "pattern-line",
  DOT: "pattern-dot",
  STATUS: "pattern-status",
  SPOKEN: "pattern-spoken",
} as const;
