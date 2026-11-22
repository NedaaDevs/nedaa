import {
  ANSWER_CARD_STATE,
  MATH_LINE,
  MATH_TAP,
  type AnswerCardPosition,
  type MathLine,
} from "@/constants/WakeTaskBoards";
import type { ChallengeDifficulty } from "@/types/alarm";
import { mathRound, type MathRound } from "@/utils/mathCards";
import type { Rng } from "@/utils/rng";

export type MathBoardState = {
  round: MathRound;
  /** Questions replaced so far. */
  asked: number;
  /** The card held as wrong; no card takes a press meanwhile. */
  wrong: AnswerCardPosition | null;
  solved: boolean;
};

/** A math card is never placed. */
export type MathCardState =
  typeof ANSWER_CARD_STATE.REST | typeof ANSWER_CARD_STATE.HELD | typeof ANSWER_CARD_STATE.WRONG;

export type MathTap =
  | { outcome: typeof MATH_TAP.SOLVED | typeof MATH_TAP.WRONG; state: MathBoardState }
  | { outcome: typeof MATH_TAP.IGNORED };

export const startMathBoard = (difficulty: ChallengeDifficulty, rng: Rng): MathBoardState => ({
  round: mathRound(difficulty, rng),
  asked: 0,
  wrong: null,
  solved: false,
});

/** Only a card at rest on an unsolved board takes a tap. */
export const tapMathCard = (state: MathBoardState, position: AnswerCardPosition): MathTap => {
  if (state.solved || state.wrong !== null) return { outcome: MATH_TAP.IGNORED };
  if (state.round.cards[position] === state.round.answer) {
    return { outcome: MATH_TAP.SOLVED, state: { ...state, solved: true } };
  }
  return { outcome: MATH_TAP.WRONG, state: { ...state, wrong: position } };
};

/** Ends a wrong card's hold with a question of another answer. */
export const replaceQuestion = (
  state: MathBoardState,
  difficulty: ChallengeDifficulty,
  rng: Rng
): MathBoardState =>
  state.wrong === null
    ? state
    : {
        round: mathRound(difficulty, rng, state.round.question),
        asked: state.asked + 1,
        wrong: null,
        solved: false,
      };

export const cardStateOf = (
  { wrong }: MathBoardState,
  position: AnswerCardPosition
): MathCardState => {
  if (wrong === null) return ANSWER_CARD_STATE.REST;
  return wrong === position ? ANSWER_CARD_STATE.WRONG : ANSWER_CARD_STATE.HELD;
};

export const mathLineOf = ({ wrong, asked }: MathBoardState): MathLine => {
  if (wrong !== null) return MATH_LINE.WRONG;
  return asked > 0 ? MATH_LINE.NEW : MATH_LINE.NONE;
};
