import { DHIKR_TASK_ROWS, type DhikrTaskRowShape } from "@/constants/DhikrTask";
import {
  dhikrCardsOf,
  dhikrLineOf,
  drawDhikrRound,
  fullDhikr,
  spokenDhikrLine,
} from "@/utils/dhikrTask";
import { seededRng, type Rng } from "@/utils/rng";

const SEEDS = Array.from({ length: 400 }, (_, seed) => seed + 1);
const PAUSE = " … ";
const GAP = "gap";
const SOURCES = new Set(DHIKR_TASK_ROWS.map((row) => row.sourceId)).size;
const LONG_RUN = SOURCES * 3;

/** The rows one run shows, draw by draw, from one source. */
const runOf = (rng: Rng, draws: number, rows: readonly DhikrTaskRowShape[] = DHIKR_TASK_ROWS) =>
  Array.from({ length: draws }).reduce<number[]>(
    (seen) => [...seen, drawDhikrRound(rows, seen, rng).row],
    []
  );

const sourceOf = (row: number) => DHIKR_TASK_ROWS[row].sourceId;

/** Rows that share a source with another row. */
const sharedSources = DHIKR_TASK_ROWS.map((row) => row.sourceId).filter(
  (source, index, all) => all.indexOf(source) !== index
);

const row = (before: string, after: string): DhikrTaskRowShape => ({
  sourceId: 1,
  before,
  after,
  answer: "w",
  others: ["x", "y", "z"],
});

describe("drawDhikrRound", () => {
  it("deals the row's four cards in some order", () => {
    SEEDS.forEach((seed) => {
      const round = drawDhikrRound(DHIKR_TASK_ROWS, [], seededRng(seed));
      expect([...round.cards].sort()).toEqual(dhikrCardsOf(DHIKR_TASK_ROWS[round.row]).sort());
    });
  });

  it("puts the answer at every place, and can open on every row", () => {
    const rounds = SEEDS.map((seed) => drawDhikrRound(DHIKR_TASK_ROWS, [], seededRng(seed)));
    const places = rounds.map(({ row: index, cards }) =>
      cards.indexOf(DHIKR_TASK_ROWS[index].answer)
    );

    expect(new Set(places).size).toBe(dhikrCardsOf(DHIKR_TASK_ROWS[0]).length);
    expect(new Set(rounds.map((round) => round.row)).size).toBe(DHIKR_TASK_ROWS.length);
  });

  it("repeats no dhikr in a run while an unused one remains", () => {
    SEEDS.forEach((seed) => {
      const sources = runOf(seededRng(seed), SOURCES).map(sourceOf);
      expect(new Set(sources).size).toBe(SOURCES);
    });
  });

  it("never shows two rows of one dhikr in a run", () => {
    expect(sharedSources.length).toBeGreaterThan(0);
    SEEDS.forEach((seed) => {
      const shown = new Set(runOf(seededRng(seed), LONG_RUN));
      sharedSources.forEach((source) => {
        const rows = [...shown].filter((index) => sourceOf(index) === source);
        expect(rows.length).toBeLessThanOrEqual(1);
      });
    });
  });

  it("always moves to a different dhikr, past the end of the list too", () => {
    SEEDS.forEach((seed) => {
      const sources = runOf(seededRng(seed), LONG_RUN).map(sourceOf);
      sources.slice(1).forEach((source, index) => expect(source).not.toBe(sources[index]));
    });
  });

  it("draws again only from rows the run has shown, once all are used", () => {
    SEEDS.forEach((seed) => {
      const run = runOf(seededRng(seed), LONG_RUN);
      const first = new Set(run.slice(0, SOURCES));
      run.slice(SOURCES).forEach((index) => expect(first.has(index)).toBe(true));
    });
  });

  it("follows one seed to one run", () => {
    expect(runOf(seededRng(7), LONG_RUN)).toEqual(runOf(seededRng(7), LONG_RUN));
  });
});

describe("dhikrLineOf", () => {
  it("keeps a word that touches the gap beside it", () => {
    expect(dhikrLineOf(row("a b c", "، d e"))).toEqual({
      before: ["a", "b"],
      touchingBefore: "c",
      touchingAfter: "،",
      after: ["d", "e"],
    });
  });

  it("leaves words apart from a gap with space around it", () => {
    expect(dhikrLineOf(row("a b ", " c"))).toEqual({
      before: ["a", "b"],
      touchingBefore: null,
      touchingAfter: null,
      after: ["c"],
    });
    expect(dhikrLineOf(row("", " c"))).toEqual({
      before: [],
      touchingBefore: null,
      touchingAfter: null,
      after: ["c"],
    });
  });

  it("gives back every row's words, in order, around its answer", () => {
    DHIKR_TASK_ROWS.forEach((entry) => {
      const line = dhikrLineOf(entry);
      const middle = `${line.touchingBefore ?? ""}${entry.answer}${line.touchingAfter ?? ""}`;
      const words = [...line.before, middle, ...line.after].join(" ");
      expect(words).toBe(fullDhikr(entry).trim().split(/\s+/).join(" "));
    });
  });
});

describe("spokenDhikrLine", () => {
  it("names the gap between the words on each side", () => {
    expect(spokenDhikrLine(row("a b ", " c"), GAP, PAUSE)).toBe(`a b${PAUSE}${GAP}${PAUSE}c`);
  });

  it("leaves out an empty side", () => {
    expect(spokenDhikrLine(row("a ", ""), GAP, PAUSE)).toBe(`a${PAUSE}${GAP}`);
    expect(spokenDhikrLine(row("", " c"), GAP, PAUSE)).toBe(`${GAP}${PAUSE}c`);
  });
});

describe("fullDhikr", () => {
  it("puts the answer back in its gap", () => {
    expect(fullDhikr(row("a ", "، b"))).toBe("a w، b");
  });
});
