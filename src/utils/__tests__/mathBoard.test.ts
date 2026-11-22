import { CHALLENGE_DIFFICULTY } from "expo-alarm";

import {
  ANSWER_CARD_POSITIONS,
  ANSWER_CARD_STATE,
  MATH_LINE,
  MATH_TAP,
  type AnswerCardPosition,
} from "@/constants/WakeTaskBoards";
import {
  cardStateOf,
  mathLineOf,
  replaceQuestion,
  startMathBoard,
  tapMathCard,
  type MathBoardState,
} from "@/utils/mathBoard";
import { seededRng } from "@/utils/rng";

const EASY = CHALLENGE_DIFFICULTY.EASY;

const answerAt = (state: MathBoardState): AnswerCardPosition => {
  const found = ANSWER_CARD_POSITIONS.find(
    (position) => state.round.cards[position] === state.round.answer
  );
  if (found === undefined) throw new Error("no answer card");
  return found;
};

const wrongAt = (state: MathBoardState): AnswerCardPosition => {
  const found = ANSWER_CARD_POSITIONS.find((position) => position !== answerAt(state));
  if (found === undefined) throw new Error("no wrong card");
  return found;
};

const tapped = (state: MathBoardState, position: AnswerCardPosition): MathBoardState => {
  const tap = tapMathCard(state, position);
  if (!("state" in tap)) throw new Error(`tap ${position} was ignored`);
  return tap.state;
};

describe("mathBoard", () => {
  it("starts at rest with no line", () => {
    const state = startMathBoard(EASY, seededRng(1));
    expect(state.asked).toBe(0);
    expect(mathLineOf(state)).toBe(MATH_LINE.NONE);
    expect(ANSWER_CARD_POSITIONS.map((p) => cardStateOf(state, p))).toEqual(
      ANSWER_CARD_POSITIONS.map(() => ANSWER_CARD_STATE.REST)
    );
  });

  it("solves on the answer card", () => {
    const state = startMathBoard(EASY, seededRng(1));
    expect(tapMathCard(state, answerAt(state)).outcome).toBe(MATH_TAP.SOLVED);
  });

  it("holds a wrong card and the others, then replaces the question", () => {
    const rng = seededRng(1);
    const start = startMathBoard(EASY, rng);
    const miss = wrongAt(start);
    const held = tapped(start, miss);
    expect(tapMathCard(start, miss).outcome).toBe(MATH_TAP.WRONG);
    expect(mathLineOf(held)).toBe(MATH_LINE.WRONG);
    for (const position of ANSWER_CARD_POSITIONS) {
      expect(cardStateOf(held, position)).toBe(
        position === miss ? ANSWER_CARD_STATE.WRONG : ANSWER_CARD_STATE.HELD
      );
    }
    const next = replaceQuestion(held, EASY, rng);
    expect(next.asked).toBe(1);
    expect(next.round.answer).not.toBe(start.round.answer);
    expect(mathLineOf(next)).toBe(MATH_LINE.NEW);
    expect(cardStateOf(next, miss)).toBe(ANSWER_CARD_STATE.REST);
  });

  it("ignores every tap during the hold, the answer card too", () => {
    const start = startMathBoard(EASY, seededRng(2));
    const held = tapped(start, wrongAt(start));
    for (const position of ANSWER_CARD_POSITIONS) {
      expect(tapMathCard(held, position).outcome).toBe(MATH_TAP.IGNORED);
    }
  });

  it("ignores every tap once solved", () => {
    const start = startMathBoard(EASY, seededRng(3));
    const solved = tapped(start, answerAt(start));
    for (const position of ANSWER_CARD_POSITIONS) {
      expect(tapMathCard(solved, position).outcome).toBe(MATH_TAP.IGNORED);
    }
  });

  it("replaces nothing with no card held", () => {
    const start = startMathBoard(EASY, seededRng(4));
    expect(replaceQuestion(start, EASY, seededRng(4))).toBe(start);
  });

  it("is never solved by tapping the four cards in turn", () => {
    for (const difficulty of Object.values(CHALLENGE_DIFFICULTY)) {
      for (let seed = 1; seed <= 200; seed++) {
        const rng = seededRng(seed);
        let state = startMathBoard(difficulty, rng);
        const first = state.round.answer;
        const outcomes = ANSWER_CARD_POSITIONS.map((position) => {
          const tap = tapMathCard(state, position);
          if ("state" in tap) state = tap.state;
          return tap.outcome;
        });
        // One miss holds the board, so no card after it counts.
        expect([-1, 0]).toContain(outcomes.indexOf(MATH_TAP.SOLVED));
        expect(outcomes.slice(1)).toEqual(outcomes.slice(1).map(() => MATH_TAP.IGNORED));
        // A miss on the first card replaces the question with a new answer.
        if (outcomes[0] === MATH_TAP.WRONG) {
          expect(replaceQuestion(state, difficulty, rng).round.answer).not.toBe(first);
        }
      }
    }
  });
});
