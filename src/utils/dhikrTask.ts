import type { DhikrTaskRowShape } from "@/constants/DhikrTask";
import { drawInt, shuffled, type Rng } from "@/utils/rng";

/** One step's dhikr, by its index in the rows, and its cards in board order. */
export type DhikrRound = { row: number; cards: string[] };

/** The dhikr split into the words drawn either side of its gap. */
export type DhikrLine = {
  before: string[];
  /** The piece written against the gap, with no space, such as «وَ». */
  touchingBefore: string | null;
  touchingAfter: string | null;
  after: string[];
};

const WORD_GAP = /\s+/;

const wordsOf = (text: string) => text.split(WORD_GAP).filter((word) => word !== "");

/** A row's four cards, its answer first. */
export const dhikrCardsOf = (row: DhikrTaskRowShape): string[] => [row.answer, ...row.others];

/** The dhikr with its word in the gap. */
export const fullDhikr = (row: DhikrTaskRowShape) => `${row.before}${row.answer}${row.after}`;

/** A row the run has not shown, from a dhikr it has not shown, while one is
 *  left; then any row it has shown, from a dhikr other than the last. */
export const drawDhikrRound = (
  rows: readonly DhikrTaskRowShape[],
  seen: readonly number[],
  rng: Rng
): DhikrRound => {
  const usedSources = new Set(seen.map((index) => rows[index].sourceId));
  const indexes = rows.map((_, index) => index);
  const fresh = indexes.filter((index) => !usedSources.has(rows[index].sourceId));
  const last = seen.at(-1);
  const lastSource = last === undefined ? null : rows[last].sourceId;
  const again = [...new Set(seen)].filter((index) => rows[index].sourceId !== lastSource);
  const pool = fresh.length > 0 ? fresh : again.length > 0 ? again : indexes;
  const row = pool[drawInt(rng, 0, pool.length - 1)];
  return { row, cards: shuffled(dhikrCardsOf(rows[row]), rng) };
};

/** The words either side of the gap; a piece with no space to the gap stays
 *  against it, so a word is never split from its letter. */
export const dhikrLineOf = (row: DhikrTaskRowShape): DhikrLine => {
  const before = wordsOf(row.before);
  const after = wordsOf(row.after);
  const touchingBefore = row.before !== "" && !/\s$/.test(row.before) ? before.pop() : undefined;
  const touchingAfter = row.after !== "" && !/^\s/.test(row.after) ? after.shift() : undefined;
  return {
    before,
    touchingBefore: touchingBefore ?? null,
    touchingAfter: touchingAfter ?? null,
    after,
  };
};

/** The dhikr as a screen reader says it, the gap named between pauses. */
export const spokenDhikrLine = (row: DhikrTaskRowShape, gap: string, pause: string) =>
  [row.before.trim(), gap, row.after.trim()].filter((part) => part !== "").join(pause);
