import { PRAYER_ID, PRAYER_IDS, type PrayerId } from "@/constants/Prayer";
import { PRAYER_TAP } from "@/constants/WakeTaskBoards";
import {
  dealPrayers,
  isPlaced,
  orderingAt,
  reshuffleUnplaced,
  startBoard,
  tapPrayer,
  unplacedSlots,
  type PrayerBoardState,
} from "@/utils/prayerOrder";
import { seededRng, type Rng } from "@/utils/rng";

const SEEDS = Array.from({ length: 600 }, (_, seed) => seed + 1);
const CARDS = PRAYER_IDS.length;
const ORDERINGS = 120;

/** A source that repeats one draw. */
const stuck = (value: number) => () => value;

const slotOf = (state: PrayerBoardState, prayer: PrayerId) => state.deal.indexOf(prayer);

/** A board with the first `placed` prayers placed, from a seed's deal. */
const boardAt = (seed: number, placed: number): PrayerBoardState => ({
  deal: dealPrayers(seededRng(seed)),
  placed,
});

describe("orderingAt", () => {
  it("keeps the order at rank 0 and reverses it at the last rank", () => {
    expect(orderingAt(PRAYER_IDS, 0)).toEqual(PRAYER_IDS);
    expect(orderingAt(PRAYER_IDS, ORDERINGS - 1)).toEqual([...PRAYER_IDS].reverse());
  });

  it("gives every ordering once across its ranks", () => {
    const all = Array.from({ length: ORDERINGS }, (_, rank) => orderingAt(PRAYER_IDS, rank).join());
    expect(new Set(all).size).toBe(ORDERINGS);
  });
});

describe("dealPrayers", () => {
  it("never deals the five in order, even from a stuck source", () => {
    SEEDS.forEach((seed) => expect(dealPrayers(seededRng(seed))).not.toEqual(PRAYER_IDS));
    [0, 0.5, 0.999999].forEach((draw) => {
      expect(dealPrayers(stuck(draw))).not.toEqual(PRAYER_IDS);
    });
  });

  it("deals each prayer once", () => {
    SEEDS.forEach((seed) => {
      expect([...dealPrayers(seededRng(seed))].sort()).toEqual([...PRAYER_IDS].sort());
    });
  });

  it("reaches every ordering but the one in order", () => {
    const seen = new Set(
      Array.from({ length: 20000 }, (_, seed) => dealPrayers(seededRng(seed)).join())
    );
    expect(seen.size).toBe(ORDERINGS - 1);
  });

  // The reference deals a Kotlin twin must also produce.
  it.each([
    [1, [PRAYER_ID.MAGHRIB, PRAYER_ID.FAJR, PRAYER_ID.ASR, PRAYER_ID.ISHA, PRAYER_ID.DHUHR]],
    [2, [PRAYER_ID.MAGHRIB, PRAYER_ID.ASR, PRAYER_ID.ISHA, PRAYER_ID.FAJR, PRAYER_ID.DHUHR]],
    [7, [PRAYER_ID.FAJR, PRAYER_ID.DHUHR, PRAYER_ID.MAGHRIB, PRAYER_ID.ASR, PRAYER_ID.ISHA]],
    [42, [PRAYER_ID.MAGHRIB, PRAYER_ID.FAJR, PRAYER_ID.DHUHR, PRAYER_ID.ASR, PRAYER_ID.ISHA]],
  ])("deals seed %i as %j", (seed, deal) => {
    expect(dealPrayers(seededRng(seed))).toEqual(deal);
  });
});

describe("tapPrayer", () => {
  it("places the next prayer and counts it", () => {
    const state = boardAt(1, 0);
    const result = tapPrayer(state, slotOf(state, PRAYER_ID.FAJR));
    expect(result).toEqual({ outcome: PRAYER_TAP.PLACED, state: { ...state, placed: 1 } });
  });

  it("calls any later prayer wrong and leaves the board as it was", () => {
    const state = boardAt(1, 1);
    [PRAYER_ID.ASR, PRAYER_ID.MAGHRIB, PRAYER_ID.ISHA].forEach((prayer) => {
      expect(tapPrayer(state, slotOf(state, prayer))).toEqual({ outcome: PRAYER_TAP.WRONG });
    });
  });

  it("ignores a placed card", () => {
    const state = boardAt(1, 2);
    expect(tapPrayer(state, slotOf(state, PRAYER_ID.FAJR))).toEqual({
      outcome: PRAYER_TAP.IGNORED,
    });
  });

  it("is done when Isha is placed", () => {
    const state = boardAt(1, CARDS - 1);
    expect(tapPrayer(state, slotOf(state, PRAYER_ID.ISHA))).toEqual({
      outcome: PRAYER_TAP.DONE,
      state: { ...state, placed: CARDS },
    });
  });
});

describe("isPlaced and unplacedSlots", () => {
  it("names a slot placed only once its prayer is", () => {
    const state = boardAt(1, 2);
    PRAYER_IDS.forEach((prayer, index) => {
      expect(isPlaced(state, slotOf(state, prayer))).toBe(index < 2);
    });
    expect(unplacedSlots(state)).toEqual(
      PRAYER_IDS.slice(2)
        .map((prayer) => slotOf(state, prayer))
        .sort((a, b) => a - b)
    );
  });
});

describe("reshuffleUnplaced", () => {
  it("keeps every placed card in its place", () => {
    SEEDS.forEach((seed) => {
      [1, 2, 3].forEach((placed) => {
        const state = boardAt(seed, placed);
        const next = reshuffleUnplaced(state, seededRng(seed + 1000));
        expect(next.placed).toBe(placed);
        PRAYER_IDS.slice(0, placed).forEach((prayer) => {
          expect(slotOf(next, prayer)).toBe(slotOf(state, prayer));
        });
        expect([...next.deal].sort()).toEqual([...PRAYER_IDS].sort());
      });
    });
  });

  // Drawn apart from the old order, so the old order says nothing of the new.
  it("can leave the cards where they were, as often as any other order", () => {
    const state = boardAt(1, CARDS - 2);
    const stayed = SEEDS.filter(
      (seed) => reshuffleUnplaced(state, seededRng(seed + 2000)).deal.join() === state.deal.join()
    ).length;
    expect(stayed / SEEDS.length).toBeGreaterThan(0.4);
    expect(stayed / SEEDS.length).toBeLessThan(0.6);
  });

  // The reference reshuffles a Kotlin twin must also produce.
  it.each([
    [1, 1, [PRAYER_ID.MAGHRIB, PRAYER_ID.FAJR, PRAYER_ID.ASR, PRAYER_ID.ISHA, PRAYER_ID.DHUHR]],
    [3, 0, [PRAYER_ID.MAGHRIB, PRAYER_ID.ASR, PRAYER_ID.ISHA, PRAYER_ID.DHUHR, PRAYER_ID.FAJR]],
    [7, 1, [PRAYER_ID.FAJR, PRAYER_ID.DHUHR, PRAYER_ID.MAGHRIB, PRAYER_ID.ISHA, PRAYER_ID.ASR]],
    [5, 2, [PRAYER_ID.ASR, PRAYER_ID.DHUHR, PRAYER_ID.MAGHRIB, PRAYER_ID.ISHA, PRAYER_ID.FAJR]],
    [2, 3, [PRAYER_ID.MAGHRIB, PRAYER_ID.ASR, PRAYER_ID.ISHA, PRAYER_ID.FAJR, PRAYER_ID.DHUHR]],
  ])("reshuffles seed %i with %i placed as %j", (seed, placed, deal) => {
    const rng = seededRng(seed);
    const state = { deal: dealPrayers(rng), placed };
    expect(reshuffleUnplaced(state, rng)).toEqual({ deal, placed });
  });
});

/** Picks a slot from what a person sees without reading a name. */
type Strategy = (open: readonly number[], last: number | null, random: Rng) => number;

const BLIND: [string, Strategy][] = [
  ["random taps", (open, _last, random) => open[Math.floor(random() * open.length)]],
  ["a sweep in reading order", (open, last) => open.find((slot) => slot > (last ?? -1)) ?? open[0]],
  [
    "a sweep against reading order",
    (open, last) =>
      [...open].reverse().find((slot) => slot < (last ?? CARDS)) ?? open[open.length - 1],
  ],
  [
    "the same place until it fills",
    (open, last) => (last !== null && open.includes(last) ? last : open[0]),
  ],
  ["always the first open card", (open) => open[0]],
  ["always the last open card", (open) => open[open.length - 1]],
];

/** Far past any game chance allows; a board that stops moving on throws. */
const MAX_TAPS = 1000;

/** Taps until Isha is placed; the board's own source deals and reshuffles. */
const play = (strategy: Strategy, seed: number): number => {
  const rng = seededRng(seed);
  const random = seededRng(seed + 7919);
  let state = startBoard(rng);
  let last: number | null = null;
  for (let taps = 1; taps <= MAX_TAPS; taps += 1) {
    last = strategy(unplacedSlots(state), last, random);
    const result = tapPrayer(state, last);
    switch (result.outcome) {
      case PRAYER_TAP.DONE:
        return taps;
      case PRAYER_TAP.PLACED:
        state = result.state;
        break;
      case PRAYER_TAP.WRONG:
        state = reshuffleUnplaced(state, rng);
        break;
      case PRAYER_TAP.IGNORED:
        throw new Error("a strategy tapped a placed card");
      default: {
        const unhandled: never = result;
        throw new Error(`unhandled tap: ${String(unhandled)}`);
      }
    }
  }
  throw new Error(`seed ${seed} placed no Isha in ${MAX_TAPS} taps`);
};

/** Each tap with k cards open is right 1 time in k: 5 + 4 + 3 + 2 + 1. */
const CHANCE_TAPS = 15;
const GAMES = Array.from({ length: 4000 }, (_, game) => game + 1);

describe("blind tapping", () => {
  it("takes five taps when the cards are read", () => {
    const state = startBoard(seededRng(3));
    let current = state;
    PRAYER_IDS.forEach((prayer, index) => {
      const result = tapPrayer(current, slotOf(current, prayer));
      expect(result.outcome).toBe(index === CARDS - 1 ? PRAYER_TAP.DONE : PRAYER_TAP.PLACED);
      if (result.outcome === PRAYER_TAP.PLACED) current = result.state;
    });
  });

  it.each(BLIND)("by %s takes about 15 taps, no fewer than chance", (_name, strategy) => {
    const taps = GAMES.map((seed) => play(strategy, seed));
    const mean = taps.reduce((sum, n) => sum + n, 0) / taps.length;
    // The spread of 4000 games; past it, the pattern reads the cards.
    expect(Math.abs(mean - CHANCE_TAPS)).toBeLessThan(0.35);
    // Five straight right taps by chance: 1 in 120.
    expect(taps.filter((n) => n === CARDS).length / taps.length).toBeLessThan(0.02);
  });

  // A reshuffle that had to move every card would put the next prayer where
  // the wrong one was, and a second tap there would win.
  it.each([2, 3, 4, 5])(
    "after a miss with %i open, the missed place holds the next 1 in k",
    (k) => {
      const placed = CARDS - k;
      const hits = SEEDS.filter((seed) => {
        const state = boardAt(seed, placed);
        const missed = unplacedSlots(state).find((slot) => state.deal[slot] !== PRAYER_IDS[placed]);
        if (missed === undefined) throw new Error("no wrong card to miss");
        const next = reshuffleUnplaced(state, seededRng(seed + 3000));
        return next.deal[missed] === PRAYER_IDS[placed];
      }).length;
      expect(Math.abs(hits / SEEDS.length - 1 / k)).toBeLessThan(
        3 * Math.sqrt(((1 / k) * (1 - 1 / k)) / SEEDS.length)
      );
    }
  );
});
