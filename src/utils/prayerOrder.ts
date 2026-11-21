import { PRAYER_IDS, type PrayerId } from "@/constants/Prayer";
import { PRAYER_TAP } from "@/constants/WakeTaskBoards";
import { drawInt, type Rng } from "@/utils/rng";

/** The prayer each card place holds, places in reading order. */
export type PrayerDeal = readonly PrayerId[];

/** The cards' places, and how many prayers from Fajr are placed. */
export type PrayerBoardState = { deal: PrayerDeal; placed: number };

export type PrayerTap =
  | { outcome: typeof PRAYER_TAP.PLACED | typeof PRAYER_TAP.DONE; state: PrayerBoardState }
  | { outcome: typeof PRAYER_TAP.WRONG | typeof PRAYER_TAP.IGNORED };

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));

/** The ordering of `items` at `rank` in lexicographic order; 0 keeps it. */
export const orderingAt = <T>(items: readonly T[], rank: number): T[] => {
  const left = [...items];
  let rest = rank;
  return items.map((_, index) => {
    const block = factorial(items.length - 1 - index);
    const pick = Math.floor(rest / block);
    rest %= block;
    return left.splice(pick, 1)[0];
  });
};

/** Any ordering of the five but the one in order, each alike. */
export const dealPrayers = (rng: Rng): PrayerDeal =>
  orderingAt(PRAYER_IDS, drawInt(rng, 1, factorial(PRAYER_IDS.length) - 1));

export const startBoard = (rng: Rng): PrayerBoardState => ({ deal: dealPrayers(rng), placed: 0 });

export const isPlaced = ({ deal, placed }: PrayerBoardState, slot: number): boolean =>
  PRAYER_IDS.indexOf(deal[slot]) < placed;

/** The slots still to place, in reading order. */
export const unplacedSlots = (state: PrayerBoardState): number[] =>
  state.deal.map((_, slot) => slot).filter((slot) => !isPlaced(state, slot));

export const tapPrayer = (state: PrayerBoardState, slot: number): PrayerTap => {
  if (isPlaced(state, slot)) return { outcome: PRAYER_TAP.IGNORED };
  if (state.deal[slot] !== PRAYER_IDS[state.placed]) return { outcome: PRAYER_TAP.WRONG };
  const placed = state.placed + 1;
  return {
    outcome: placed === PRAYER_IDS.length ? PRAYER_TAP.DONE : PRAYER_TAP.PLACED,
    state: { ...state, placed },
  };
};

/** Deals the unplaced cards again over their slots, whatever their order. */
export const reshuffleUnplaced = (state: PrayerBoardState, rng: Rng): PrayerBoardState => {
  const open = unplacedSlots(state);
  const dealt = orderingAt(
    open.map((slot) => state.deal[slot]),
    drawInt(rng, 0, factorial(open.length) - 1)
  );
  const deal = state.deal.map((prayer, slot) => {
    const at = open.indexOf(slot);
    return at === -1 ? prayer : dealt[at];
  });
  return { ...state, deal };
};
