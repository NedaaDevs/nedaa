import { ATHKAR_GROUP_ORDER, type AthkarGroupOrder } from "@/constants/Athkar";
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
  /** Which text each count of a group shows; one text shows under either. */
  groupOrder: AthkarGroupOrder;
};

export type Counts = Readonly<Record<string, number>>;

export type PositionMark = { id: string; state: MarkState; size: MarkSize };

export const toSessionItems = (
  list: readonly Athkar[],
  groupOrder: AthkarGroupOrder
): SessionItem[] =>
  list.map(({ id, count, text, group }) => ({
    id,
    target: count,
    texts: (group ? group.texts : [text]).map(keyText),
    itemsPerRound: group ? group.itemsPerRound : 1,
    groupOrder,
  }));

export const toCounts = (progress: readonly AthkarProgress[]): Counts =>
  Object.fromEntries(progress.map(({ athkarId, currentCount }) => [athkarId, currentCount]));

const countOf = (counts: Counts, item: SessionItem) => counts[item.id] ?? 0;

const isDone = (counts: Counts, item: SessionItem) => countOf(counts, item) >= item.target;

/** The counts a text shows; the first texts take the rounds' remainder. */
const turnsOf = (item: SessionItem, index: number) =>
  Math.ceil((item.target - index) / item.itemsPerRound);

/** A count's text and its turn of that text's turns, from 1; a done group stays last. */
const turnAt = (item: SessionItem, count: number) => {
  const at = Math.max(0, Math.min(count, item.target - 1));
  switch (item.groupOrder) {
    case ATHKAR_GROUP_ORDER.BY_ROUND: {
      const index = at % item.itemsPerRound;
      return { index, turn: Math.floor(at / item.itemsPerRound) + 1, of: turnsOf(item, index) };
    }
    case ATHKAR_GROUP_ORDER.EACH_IN_FULL: {
      // Each text keeps its count from by round, its repeats in one run.
      let index = 0;
      let start = 0;
      while (index < item.itemsPerRound - 1 && at >= start + turnsOf(item, index)) {
        start += turnsOf(item, index);
        index += 1;
      }
      return { index, turn: at - start + 1, of: turnsOf(item, index) };
    }
  }
};

/** Which text a count shows. A finished group stays on its last text. */
export const textIndexAt = (item: SessionItem, count: number) => turnAt(item, count).index;

/** How far the text a count shows is into its own turns. */
export const textTurnAt = (item: SessionItem, count: number): { turn: number; of: number } => {
  const { turn, of } = turnAt(item, count);
  return { turn, of };
};

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
