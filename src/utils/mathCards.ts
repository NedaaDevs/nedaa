import {
  ANSWER_CARD_POSITIONS,
  MATH_CARD_SHAPES,
  MATH_LEVELS,
  MATH_OPERATION,
  MATH_OPERATION_SEED,
  type MathOperation,
  type OperandRange,
} from "@/constants/WakeTaskBoards";
import type { ChallengeDifficulty } from "@/types/alarm";
import { drawInt, seededRng, shuffled, type Rng } from "@/utils/rng";

export type MathQuestion = { operation: MathOperation; left: number; right: number };

export type MathRound = {
  question: MathQuestion;
  answer: number;
  /** One card per grid position, the answer among them once. */
  cards: readonly number[];
};

export type MathCardShape = (typeof MATH_CARD_SHAPES)[number];

const LAST_SLOT = ANSWER_CARD_POSITIONS.length - 1;

export const answerOf = ({ operation, left, right }: MathQuestion): number => {
  switch (operation) {
    case MATH_OPERATION.ADD:
      return left + right;
    case MATH_OPERATION.MULTIPLY:
      return left * right;
    default: {
      const unhandled: never = operation;
      throw new Error(`unhandled math operation: ${unhandled}`);
    }
  }
};

/** Shapes whose every slot stays positive at the level's smallest answer. */
export const shapesFor = (difficulty: ChallengeDifficulty): readonly MathCardShape[] => {
  const { operation, left, right } = MATH_LEVELS[difficulty];
  const smallest = answerOf({ operation, left: left.min, right: right.min });
  return MATH_CARD_SHAPES.filter((shape) => Math.max(...shape) < smallest);
};

/** Seeds the layout from the question alone, so it repeats in any build. */
const layoutSeed = ({ operation, left, right }: MathQuestion): number =>
  MATH_OPERATION_SEED[operation] * 10000 + left * 100 + right;

/** Four cards in a drawn shape, the answer in a drawn slot, then shuffled. */
export const cardsFor = (difficulty: ChallengeDifficulty, question: MathQuestion): number[] => {
  const answer = answerOf(question);
  const rng = seededRng(layoutSeed(question));
  const shapes = shapesFor(difficulty);
  const shape = shapes[drawInt(rng, 0, shapes.length - 1)];
  const base = answer - shape[drawInt(rng, 0, LAST_SLOT)];
  return shuffled(
    shape.map((gap) => base + gap),
    rng
  );
};

const drawOperand = (rng: Rng, { min, max }: OperandRange) => drawInt(rng, min, max);

/** The next operand in range, wrapping past the top. */
const stepOperand = (value: number, { min, max }: OperandRange) => (value >= max ? min : value + 1);

/** A question at `difficulty`, never with the answer of `previous`. */
const drawQuestion = (
  difficulty: ChallengeDifficulty,
  rng: Rng,
  previous?: MathQuestion
): MathQuestion => {
  const level = MATH_LEVELS[difficulty];
  const left = drawOperand(rng, level.left);
  const right = drawOperand(rng, level.right);
  const question = { operation: level.operation, left, right };
  if (!previous || answerOf(question) !== answerOf(previous)) return question;
  return { ...question, right: stepOperand(right, level.right) };
};

export const mathRound = (
  difficulty: ChallengeDifficulty,
  rng: Rng,
  previous?: MathQuestion
): MathRound => {
  const question = drawQuestion(difficulty, rng, previous);
  return { question, answer: answerOf(question), cards: cardsFor(difficulty, question) };
};
