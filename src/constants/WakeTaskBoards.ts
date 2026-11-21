import { CHALLENGE_DIFFICULTY } from "expo-alarm";

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

/** A wrong card holds this long before a new question replaces it. */
export const MATH_WRONG_HOLD_MS = 600;

/** The old question fades out over OUT while the new one fades in over IN. */
export const MATH_QUESTION_MS = { OUT: 180, IN: 280 } as const;

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

/** A card at rest, held still while another is wrong, or marked wrong. */
export const ANSWER_CARD_STATE = { REST: "rest", HELD: "held", WRONG: "wrong" } as const;

export type AnswerCardState = (typeof ANSWER_CARD_STATE)[keyof typeof ANSWER_CARD_STATE];

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
} as const;

/** Test ids for the boards' parts. */
export const BOARD_PART = {
  ANSWER_CARD: "answer-card",
  ANSWER_MARK: "answer-card-mark",
  MATH_SUM: "math-sum",
  MATH_LINE: "math-line",
  TAP_COUNT: "tap-count",
  TAP_TICK: "tap-tick",
  TAP_STATUS: "tap-status",
} as const;
