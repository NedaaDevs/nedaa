import { PRAYER_ID, PRAYER_IDS } from "@/constants/Prayer";
import {
  ANSWER_CARD_STATE,
  PRAYER_LINE,
  PRAYER_PLACE_PART,
  PRAYER_TAP,
} from "@/constants/WakeTaskBoards";
import { reshuffleUnplaced, startBoard } from "@/utils/prayerOrder";
import {
  endWrongHold,
  placedSaidOf,
  placesSpokenOf,
  prayerCardStateOf,
  prayerLineOf,
  startPrayersBoard,
  tapPrayerCard,
  type PrayersBoardState,
} from "@/utils/prayersBoard";
import { seededRng } from "@/utils/rng";

const SEED = 11;
const SEEDS = 500;

const slotOf = (state: PrayersBoardState, prayer: (typeof PRAYER_IDS)[number]) =>
  state.order.deal.indexOf(prayer);

/** The board after `tapPrayerCard`, which must move it on. */
const tapped = (state: PrayersBoardState, slot: number) => {
  const tap = tapPrayerCard(state, slot);
  if (!("state" in tap)) throw new Error(`tap ${slot} was ${tap.outcome}`);
  return tap;
};

const placeInOrder = (from: PrayersBoardState, count: number) =>
  PRAYER_IDS.slice(from.order.placed, from.order.placed + count).reduce(
    (state, prayer) => tapped(state, slotOf(state, prayer)).state,
    from
  );

/** A slot whose prayer is not the next one. */
const wrongSlot = (state: PrayersBoardState) =>
  state.order.deal.findIndex(
    (prayer, slot) =>
      prayer !== PRAYER_IDS[state.order.placed] &&
      prayerCardStateOf(state, slot) !== ANSWER_CARD_STATE.PLACED
  );

describe("prayersBoard", () => {
  it("opens on the prayer order's deal, nothing held, missed or dealt again", () => {
    const state = startPrayersBoard(seededRng(SEED));

    expect(state).toEqual({
      order: startBoard(seededRng(SEED)),
      wrong: null,
      missed: null,
      deals: 0,
      solved: false,
    });
    expect(prayerLineOf(state)).toEqual({ line: PRAYER_LINE.NONE });
    expect(placesSpokenOf(state)).toEqual([
      { part: PRAYER_PLACE_PART.EMPTY, prayer: PRAYER_ID.FAJR },
    ]);
    state.order.deal.forEach((_, slot) =>
      expect(prayerCardStateOf(state, slot)).toBe(ANSWER_CARD_STATE.REST)
    );
  });

  it("places the next prayer, says it and the empty place after it", () => {
    const start = startPrayersBoard(seededRng(SEED));
    const fajr = slotOf(start, PRAYER_ID.FAJR);

    const { outcome, state } = tapped(start, fajr);

    expect(outcome).toBe(PRAYER_TAP.PLACED);
    expect(state.order.placed).toBe(1);
    expect(prayerCardStateOf(state, fajr)).toBe(ANSWER_CARD_STATE.PLACED);
    expect(placedSaidOf(state)).toEqual([
      { part: PRAYER_PLACE_PART.FILLED, prayer: PRAYER_ID.FAJR },
      { part: PRAYER_PLACE_PART.EMPTY, prayer: PRAYER_ID.DHUHR },
    ]);
    expect(placesSpokenOf(state)).toEqual(placedSaidOf(state));
  });

  it("ignores a placed card", () => {
    const start = startPrayersBoard(seededRng(SEED));
    const state = placeInOrder(start, 1);

    expect(tapPrayerCard(state, slotOf(start, PRAYER_ID.FAJR))).toEqual({
      outcome: PRAYER_TAP.IGNORED,
    });
  });

  it("holds a wrong card, every other open card held, the places kept", () => {
    const placed = placeInOrder(startPrayersBoard(seededRng(SEED)), 2);
    const slot = slotOf(placed, PRAYER_ID.ISHA);

    const { outcome, state } = tapped(placed, slot);

    expect(outcome).toBe(PRAYER_TAP.WRONG);
    expect(state.order).toEqual(placed.order);
    expect(prayerLineOf(state)).toEqual({ line: PRAYER_LINE.WRONG, prayer: PRAYER_ID.ISHA });
    state.order.deal.forEach((prayer, at) => {
      const expected =
        at === slot
          ? ANSWER_CARD_STATE.WRONG
          : PRAYER_IDS.indexOf(prayer) < 2
            ? ANSWER_CARD_STATE.PLACED
            : ANSWER_CARD_STATE.HELD;
      expect(prayerCardStateOf(state, at)).toBe(expected);
    });
  });

  it("takes no tap while a wrong card holds, the right one included", () => {
    const start = startPrayersBoard(seededRng(SEED));
    const held = tapped(start, slotOf(start, PRAYER_ID.ISHA)).state;

    held.order.deal.forEach((_, slot) =>
      expect(tapPrayerCard(held, slot)).toEqual({ outcome: PRAYER_TAP.IGNORED })
    );
  });

  it("ends the hold by dealing the open cards again, progress kept", () => {
    const rng = seededRng(SEED);
    const placed = placeInOrder(startPrayersBoard(rng), 2);
    const held = tapped(placed, slotOf(placed, PRAYER_ID.ISHA)).state;
    const expected = reshuffleUnplaced(placed.order, seededRng(SEED + 1));

    const state = endWrongHold(held, seededRng(SEED + 1));

    expect(state).toEqual({
      order: expected,
      wrong: null,
      missed: PRAYER_ID.ISHA,
      deals: 1,
      solved: false,
    });
    expect(prayerLineOf(state)).toEqual({
      line: PRAYER_LINE.DEALT_NEXT,
      prayer: PRAYER_ID.DHUHR,
    });
    expect(placesSpokenOf(state)).toEqual([
      { part: PRAYER_PLACE_PART.AFTER_MISS, prayer: PRAYER_ID.ISHA },
      { part: PRAYER_PLACE_PART.FILLED, prayer: PRAYER_ID.FAJR },
      { part: PRAYER_PLACE_PART.FILLED, prayer: PRAYER_ID.DHUHR },
      { part: PRAYER_PLACE_PART.EMPTY, prayer: PRAYER_ID.ASR },
    ]);
  });

  it("says the cards were dealt again, naming no prayer, when none is placed", () => {
    const start = startPrayersBoard(seededRng(SEED));
    const held = tapped(start, slotOf(start, PRAYER_ID.ISHA)).state;

    expect(prayerLineOf(endWrongHold(held, seededRng(SEED)))).toEqual({ line: PRAYER_LINE.DEALT });
  });

  it("leaves a board with no wrong card as it is", () => {
    const state = startPrayersBoard(seededRng(SEED));

    expect(endWrongHold(state, seededRng(SEED))).toBe(state);
  });

  it("forgets the missed prayer at the next placement", () => {
    const start = startPrayersBoard(seededRng(SEED));
    const dealt = endWrongHold(tapped(start, slotOf(start, PRAYER_ID.ISHA)).state, seededRng(1));

    const state = placeInOrder(dealt, 1);

    expect(state.missed).toBeNull();
    expect(prayerLineOf(state)).toEqual({ line: PRAYER_LINE.NONE });
  });

  it("solves once at Isha and takes no tap after", () => {
    const start = startPrayersBoard(seededRng(SEED));
    const four = placeInOrder(start, PRAYER_IDS.length - 1);

    const { outcome, state } = tapped(four, slotOf(four, PRAYER_ID.ISHA));

    expect(outcome).toBe(PRAYER_TAP.DONE);
    expect(state.solved).toBe(true);
    expect(placesSpokenOf(state)).toEqual(
      PRAYER_IDS.map((prayer) => ({ part: PRAYER_PLACE_PART.FILLED, prayer }))
    );
    state.order.deal.forEach((_, slot) =>
      expect(tapPrayerCard(state, slot)).toEqual({ outcome: PRAYER_TAP.IGNORED })
    );
  });

  it("speaks the same places and line whether or not a card moved in the redeal", () => {
    const start = startPrayersBoard(seededRng(SEED));
    const held = tapped(start, wrongSlot(start)).state;
    const said = (rngSeed: number) => {
      const state = endWrongHold(held, seededRng(rngSeed));
      return [placesSpokenOf(state), prayerLineOf(state)];
    };

    expect(said(1)).toEqual(said(2));
  });

  // A tapper sweeping the cards in reading order, waiting out each hold.
  it("never solves from one pass over the cards in reading order", () => {
    for (let seed = 0; seed < SEEDS; seed += 1) {
      const rng = seededRng(seed);
      let state = startPrayersBoard(rng);
      for (const slot of state.order.deal.keys()) {
        const tap = tapPrayerCard(state, slot);
        if ("state" in tap) state = endWrongHold(tap.state, rng);
      }
      expect(state.solved).toBe(false);
    }
  });
});
