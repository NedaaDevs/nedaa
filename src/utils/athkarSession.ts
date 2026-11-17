import {
  MARK_SIZE,
  MARK_STATE,
  POSITION,
  type MarkSize,
  type MarkState,
} from "@/constants/AthkarSession";
import type { Athkar, AthkarProgress } from "@/types/athkar";
import { PLAYER_STATE, type PlayerState } from "@/types/athkar-audio";

/** One dhikr of a session. A group holds several texts that take turns under one count. */
export type SessionItem = {
  id: string;
  target: number;
  /** Locale keys. */
  textKeys: readonly string[];
  itemsPerRound: number;
};

export type Counts = Readonly<Record<string, number>>;

export type PositionMark = { id: string; state: MarkState; size: MarkSize };

export const toSessionItems = (list: readonly Athkar[]): SessionItem[] =>
  list.map(({ id, count, text, group }) => ({
    id,
    target: count,
    textKeys: group ? group.texts : [text],
    itemsPerRound: group ? group.itemsPerRound : 1,
  }));

export const toCounts = (progress: readonly AthkarProgress[]): Counts =>
  Object.fromEntries(progress.map(({ athkarId, currentCount }) => [athkarId, currentCount]));

const countOf = (counts: Counts, item: SessionItem) => counts[item.id] ?? 0;

const isDone = (counts: Counts, item: SessionItem) => countOf(counts, item) >= item.target;

/** Which text a count shows. A finished group stays on its last text. */
export const textIndexAt = (item: SessionItem, count: number) =>
  Math.min(count, item.target - 1) % item.itemsPerRound;

/** Locale key of the text an item's count has reached. */
export const textKeyAt = (item: SessionItem, counts: Counts) =>
  item.textKeys[textIndexAt(item, countOf(counts, item))];

/** Audio that plays, or waits between two dhikr. */
export const audioRuns = (state: PlayerState): boolean =>
  state === PLAYER_STATE.PLAYING || state === PLAYER_STATE.LOADING;

/** The first unfinished item after `from`, wrapping; null when no other item is open. */
export const nextOpenIndex = (
  items: readonly SessionItem[],
  counts: Counts,
  from: number
): number | null => {
  for (let step = 1; step < items.length; step += 1) {
    const index = (from + step) % items.length;
    if (!isDone(counts, items[index])) return index;
  }
  return null;
};

const fullSizeStart = (total: number, index: number | null) =>
  Math.max(0, Math.min((index ?? 0) - POSITION.BEFORE, total - POSITION.WINDOW));

const markState = (item: SessionItem, counts: Counts, isCurrent: boolean): MarkState => {
  if (isCurrent) return MARK_STATE.CURRENT;
  return isDone(counts, item) ? MARK_STATE.DONE : MARK_STATE.REMAINING;
};

/** One mark per item. A null index is a finished session: no mark is current. */
export const positionMarks = (
  items: readonly SessionItem[],
  counts: Counts,
  index: number | null
): PositionMark[] => {
  const allFull = items.length <= POSITION.FULL_MAX;
  const start = fullSizeStart(items.length, index);
  return items.map((item, i) => ({
    id: item.id,
    state: markState(item, counts, i === index),
    size: allFull || (i >= start && i < start + POSITION.WINDOW) ? MARK_SIZE.FULL : MARK_SIZE.FINE,
  }));
};
