import {
  ADVANCE_PAUSE_MS,
  MARK_SIZE,
  MARK_STATE,
  POSITION,
  type MarkSize,
  type MarkState,
} from "@/constants/AthkarSession";
import type { Athkar, AthkarProgress } from "@/types/athkar";
import { PLAYER_STATE, type PlayerState } from "@/types/athkar-audio";
import { keyText, type DhikrText } from "@/utils/athkarText";

/** One dhikr of a session. A group holds several texts that take turns under one count. */
export type SessionItem = {
  id: string;
  target: number;
  texts: readonly DhikrText[];
  itemsPerRound: number;
};

export type Counts = Readonly<Record<string, number>>;

export type PositionMark = { id: string; state: MarkState; size: MarkSize };

export const toSessionItems = (list: readonly Athkar[]): SessionItem[] =>
  list.map(({ id, count, text, group }) => ({
    id,
    target: count,
    texts: (group ? group.texts : [text]).map(keyText),
    itemsPerRound: group ? group.itemsPerRound : 1,
  }));

export const toCounts = (progress: readonly AthkarProgress[]): Counts =>
  Object.fromEntries(progress.map(({ athkarId, currentCount }) => [athkarId, currentCount]));

const countOf = (counts: Counts, item: SessionItem) => counts[item.id] ?? 0;

const isDone = (counts: Counts, item: SessionItem) => countOf(counts, item) >= item.target;

/** Which text a count shows. A finished group stays on its last text. */
export const textIndexAt = (item: SessionItem, count: number) =>
  Math.min(count, item.target - 1) % item.itemsPerRound;

/** The text an item's count has reached, named by its dhikr and its turn. */
export const textAt = (item: SessionItem, counts: Counts): { id: string; text: DhikrText } => {
  const turn = textIndexAt(item, countOf(counts, item));
  return { id: `${item.id}:${turn}`, text: item.texts[turn] };
};

/** Audio that plays, or waits between two dhikr. */
export const audioRuns = (state: PlayerState): boolean =>
  state === PLAYER_STATE.PLAYING || state === PLAYER_STATE.LOADING;

/** Audio counts this dhikr: it plays it, waits on it, or is starting on it. */
export const audioOwnsCount = (
  audio: {
    playerState: PlayerState;
    currentAthkarId: string | null;
    loadingAthkarId: string | null;
  },
  id: string
): boolean =>
  (audioRuns(audio.playerState) && audio.currentAthkarId === id) ||
  (audio.playerState === PLAYER_STATE.LOADING && audio.loadingAthkarId === id);

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

/** The one pending move to the next dhikr: it waits the pause, and a cancel drops it. */
export const createAdvance = () => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };
  return {
    cancel,
    start: (move: () => void) => {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        move();
      }, ADVANCE_PAUSE_MS);
    },
  };
};
