import { PRAYER_IDS, type PrayerId } from "@/constants/Prayer";
import {
  ANSWER_CARD_STATE,
  PRAYER_LINE,
  PRAYER_PLACE_PART,
  PRAYER_TAP,
  type AnswerCardState,
  type PrayerPlacePart,
} from "@/constants/WakeTaskBoards";
import {
  isPlaced,
  reshuffleUnplaced,
  startBoard,
  tapPrayer,
  type PrayerBoardState,
} from "@/utils/prayerOrder";
import type { Rng } from "@/utils/rng";

export type PrayersBoardState = {
  order: PrayerBoardState;
  /** The slot held as wrong; no card takes a tap meanwhile. */
  wrong: number | null;
  /** The prayer last tapped too soon, until the next placement. */
  missed: PrayerId | null;
  /** Redeals so far. */
  deals: number;
  solved: boolean;
};

export type PrayersBoardTap =
  | {
      outcome: typeof PRAYER_TAP.PLACED | typeof PRAYER_TAP.DONE | typeof PRAYER_TAP.WRONG;
      state: PrayersBoardState;
    }
  | { outcome: typeof PRAYER_TAP.IGNORED };

export type PrayersLine =
  | { line: typeof PRAYER_LINE.NONE | typeof PRAYER_LINE.DEALT }
  | { line: typeof PRAYER_LINE.WRONG | typeof PRAYER_LINE.DEALT_NEXT; prayer: PrayerId };

/** One sentence the places speak, about one prayer. */
export type PlaceSaid = { part: PrayerPlacePart; prayer: PrayerId };

const filled = (prayer: PrayerId): PlaceSaid => ({ part: PRAYER_PLACE_PART.FILLED, prayer });

const emptyNext = ({ placed }: PrayerBoardState): PlaceSaid[] =>
  placed < PRAYER_IDS.length ? [{ part: PRAYER_PLACE_PART.EMPTY, prayer: PRAYER_IDS[placed] }] : [];

export const startPrayersBoard = (rng: Rng): PrayersBoardState => ({
  order: startBoard(rng),
  wrong: null,
  missed: null,
  deals: 0,
  solved: false,
});

/** Only an open card on an unsolved board with no card held takes a tap. */
export const tapPrayerCard = (state: PrayersBoardState, slot: number): PrayersBoardTap => {
  if (state.solved || state.wrong !== null) return { outcome: PRAYER_TAP.IGNORED };
  const tap = tapPrayer(state.order, slot);
  switch (tap.outcome) {
    case PRAYER_TAP.IGNORED:
      return { outcome: PRAYER_TAP.IGNORED };
    case PRAYER_TAP.WRONG:
      return { outcome: PRAYER_TAP.WRONG, state: { ...state, wrong: slot } };
    case PRAYER_TAP.PLACED:
      return { outcome: tap.outcome, state: { ...state, order: tap.state, missed: null } };
    case PRAYER_TAP.DONE:
      return {
        outcome: tap.outcome,
        state: { ...state, order: tap.state, missed: null, solved: true },
      };
    default: {
      const unhandled: never = tap;
      throw new Error(`unhandled prayer tap: ${String(unhandled)}`);
    }
  }
};

/** Ends a wrong card's hold: the open cards are dealt again, progress kept. */
export const endWrongHold = (state: PrayersBoardState, rng: Rng): PrayersBoardState =>
  state.wrong === null
    ? state
    : {
        ...state,
        order: reshuffleUnplaced(state.order, rng),
        wrong: null,
        missed: state.order.deal[state.wrong],
        deals: state.deals + 1,
      };

export const prayerCardStateOf = (state: PrayersBoardState, slot: number): AnswerCardState => {
  if (isPlaced(state.order, slot)) return ANSWER_CARD_STATE.PLACED;
  if (state.wrong === null) return ANSWER_CARD_STATE.REST;
  return state.wrong === slot ? ANSWER_CARD_STATE.WRONG : ANSWER_CARD_STATE.HELD;
};

/** Reads no slot of the redeal, so a moved card and a kept one read alike. */
export const prayerLineOf = ({ order, wrong, missed }: PrayersBoardState): PrayersLine => {
  if (wrong !== null) return { line: PRAYER_LINE.WRONG, prayer: order.deal[wrong] };
  if (missed === null) return { line: PRAYER_LINE.NONE };
  if (order.placed === 0) return { line: PRAYER_LINE.DEALT };
  return { line: PRAYER_LINE.DEALT_NEXT, prayer: PRAYER_IDS[order.placed - 1] };
};

/** The places' label: the missed prayer, each filled place, then the next. */
export const placesSpokenOf = ({ order, missed }: PrayersBoardState): PlaceSaid[] => [
  ...(missed === null ? [] : [{ part: PRAYER_PLACE_PART.AFTER_MISS, prayer: missed }]),
  ...PRAYER_IDS.slice(0, order.placed).map(filled),
  ...emptyNext(order),
];

/** Said once a card is placed: its place, then the empty one after it. */
export const placedSaidOf = ({ order }: PrayersBoardState): PlaceSaid[] =>
  order.placed === 0 ? [] : [filled(PRAYER_IDS[order.placed - 1]), ...emptyNext(order)];
