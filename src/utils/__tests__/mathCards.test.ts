import { CHALLENGE_DIFFICULTY } from "expo-alarm";

import {
  ANSWER_CARD_POSITIONS,
  MATH_CARD_SHAPES,
  MATH_LEVELS,
  MATH_OPERATION,
} from "@/constants/WakeTaskBoards";
import { CHALLENGE_DIFFICULTIES, type ChallengeDifficulty } from "@/types/alarm";
import { answerOf, cardsFor, mathRound, shapesFor, type MathQuestion } from "@/utils/mathCards";
import { seededRng } from "@/utils/rng";

const SEEDS = Array.from({ length: 400 }, (_, seed) => seed + 1);
const CARDS = ANSWER_CARD_POSITIONS.length;
const WIDEST_GAP = Math.max(...MATH_CARD_SHAPES.flat());

/** A source that repeats one draw, so every question it makes is alike. */
const stuck = (value: number) => () => value;

/** Every question a level can ask, each operand pair once. */
const everyQuestion = (difficulty: ChallengeDifficulty): MathQuestion[] => {
  const { operation, left, right } = MATH_LEVELS[difficulty];
  const questions: MathQuestion[] = [];
  for (let l = left.min; l <= left.max; l += 1) {
    for (let r = right.min; r <= right.max; r += 1) {
      questions.push({ operation, left: l, right: r });
    }
  }
  return questions;
};

/** A guess made from the cards alone, as a grid place. */
type Guess = (cards: readonly number[]) => number;

const firstBest = (cards: readonly number[], score: (card: number) => number) =>
  cards.reduce((best, card, place) => (score(card) > score(cards[best]) ? place : best), 0);

const SLIP_GAPS = [1, 2, 10];

/** The card the most others sit 1, 2 or 10 from. */
const hub: Guess = (cards) =>
  firstBest(cards, (card) => cards.filter((o) => SLIP_GAPS.includes(Math.abs(card - o))).length);

/** Of cards 10 from another, the one nearest the rest. */
const tenPartner: Guess = (cards) => {
  const spread = (card: number) => cards.reduce((sum, o) => sum + Math.abs(card - o), 0);
  const paired = (card: number) => cards.some((o) => Math.abs(card - o) === 10);
  return firstBest(cards, (card) => (paired(card) ? -spread(card) : -Infinity));
};

const bySize =
  (rank: number): Guess =>
  (cards) =>
    cards.indexOf([...cards].sort((a, b) => a - b)[rank]);

const atPlace =
  (place: number): Guess =>
  () =>
    place;

const GUESSES: [string, Guess][] = [
  ["the hub of 1, 2 and 10 gaps", hub],
  ["the partner of a 10-apart pair", tenPartner],
  ...ANSWER_CARD_POSITIONS.map((rank): [string, Guess] => [`rank ${rank} by size`, bySize(rank)]),
  ...ANSWER_CARD_POSITIONS.map((place): [string, Guess] => [`place ${place}`, atPlace(place)]),
];

const CHANCE = 1 / CARDS;

// A fair 1-in-4 pick over n questions lands within three standard
// deviations of chance 99.7% of the time; past it, the cards give it away.
const SPREAD_SIGMAS = 3;
const tolerance = (questions: number) =>
  SPREAD_SIGMAS * Math.sqrt((CHANCE * (1 - CHANCE)) / questions);

describe("mathRound", () => {
  describe.each(CHALLENGE_DIFFICULTIES)("at %s", (difficulty) => {
    const level = MATH_LEVELS[difficulty];
    const rounds = SEEDS.map((seed) => mathRound(difficulty, seededRng(seed)));

    it("asks the level's sum, each operand inside its range", () => {
      rounds.forEach(({ question }) => {
        expect(question.operation).toBe(level.operation);
        expect(question.left).toBeGreaterThanOrEqual(level.left.min);
        expect(question.left).toBeLessThanOrEqual(level.left.max);
        expect(question.right).toBeGreaterThanOrEqual(level.right.min);
        expect(question.right).toBeLessThanOrEqual(level.right.max);
      });
    });

    it("reaches both ends of each range", () => {
      const lefts = rounds.map(({ question }) => question.left);
      const rights = rounds.map(({ question }) => question.right);
      expect(Math.min(...lefts)).toBe(level.left.min);
      expect(Math.max(...lefts)).toBe(level.left.max);
      expect(Math.min(...rights)).toBe(level.right.min);
      expect(Math.max(...rights)).toBe(level.right.max);
    });

    it("asks a question with another answer than the one it replaces", () => {
      SEEDS.forEach((seed) => {
        const rng = seededRng(seed);
        const first = mathRound(difficulty, rng);
        const next = mathRound(difficulty, rng, first.question);
        expect(next.answer).not.toBe(first.answer);
      });
    });

    it("moves off the replaced answer even when the draws repeat", () => {
      [0, 0.5, 0.999].forEach((draw) => {
        const first = mathRound(difficulty, stuck(draw));
        const next = mathRound(difficulty, stuck(draw), first.question);
        expect(next.answer).not.toBe(first.answer);
        expect(next.question.right).toBeGreaterThanOrEqual(level.right.min);
        expect(next.question.right).toBeLessThanOrEqual(level.right.max);
      });
    });
  });

  it("draws the question alone from the source it is given", () => {
    const a = mathRound(CHALLENGE_DIFFICULTY.MEDIUM, seededRng(7));
    const b = mathRound(CHALLENGE_DIFFICULTY.MEDIUM, seededRng(7));
    expect(b).toEqual(a);
  });
});

describe("cardsFor", () => {
  describe.each(CHALLENGE_DIFFICULTIES)("over every question at %s", (difficulty) => {
    const questions = everyQuestion(difficulty);
    const layouts = questions.map((question) => ({
      answer: answerOf(question),
      cards: cardsFor(difficulty, question),
    }));

    it("offers four distinct positive cards, exactly one the answer", () => {
      layouts.forEach(({ answer, cards }) => {
        expect(cards).toHaveLength(CARDS);
        expect(new Set(cards).size).toBe(CARDS);
        expect(cards.filter((card) => card === answer)).toHaveLength(1);
        cards.forEach((card) => {
          expect(card).toBeGreaterThan(0);
          expect(Math.abs(card - answer)).toBeLessThanOrEqual(WIDEST_GAP);
        });
      });
    });

    it.each(GUESSES)("leaves %s at chance", (_name, guess) => {
      const hits = layouts.filter(({ answer, cards }) => cards[guess(cards)] === answer).length;
      expect(Math.abs(hits / layouts.length - CHANCE)).toBeLessThanOrEqual(
        tolerance(layouts.length)
      );
    });
  });

  it.each(CHALLENGE_DIFFICULTIES)("has a shape that fits every answer at %s", (difficulty) => {
    const smallest = Math.min(...everyQuestion(difficulty).map(answerOf));
    expect(shapesFor(difficulty).length).toBeGreaterThan(0);
    shapesFor(difficulty).forEach((shape) => {
      expect(Math.max(...shape)).toBeLessThan(smallest);
    });
  });

  // The reference layouts a Kotlin twin must also produce.
  it.each([
    [CHALLENGE_DIFFICULTY.EASY, MATH_OPERATION.ADD, 7, 8, [18, 16, 15, 17]],
    [CHALLENGE_DIFFICULTY.EASY, MATH_OPERATION.ADD, 2, 2, [4, 3, 5, 2]],
    [CHALLENGE_DIFFICULTY.MEDIUM, MATH_OPERATION.ADD, 47, 8, [45, 56, 55, 46]],
    [CHALLENGE_DIFFICULTY.MEDIUM, MATH_OPERATION.ADD, 11, 2, [13, 1, 11, 3]],
    [CHALLENGE_DIFFICULTY.HARD, MATH_OPERATION.MULTIPLY, 12, 7, [83, 85, 86, 84]],
    [CHALLENGE_DIFFICULTY.HARD, MATH_OPERATION.MULTIPLY, 19, 9, [170, 171, 168, 169]],
  ])("lays out %s %s %i, %i as %j", (difficulty, operation, left, right, cards) => {
    expect(cardsFor(difficulty, { operation, left, right })).toEqual(cards);
  });
});

describe("seededRng", () => {
  it("draws in [0, 1) and repeats for one seed", () => {
    const draws = Array.from({ length: 1000 }, seededRng(42));
    draws.forEach((draw) => {
      expect(draw).toBeGreaterThanOrEqual(0);
      expect(draw).toBeLessThan(1);
    });
    expect(Array.from({ length: 1000 }, seededRng(42))).toEqual(draws);
  });

  // A Kotlin twin copies the generator; these pin its first draws.
  it("draws the reference sequence for seed 1", () => {
    const rng = seededRng(1);
    expect([rng(), rng(), rng()].map((draw) => draw.toFixed(6))).toEqual([
      "0.627074",
      "0.002736",
      "0.527447",
    ]);
  });
});
