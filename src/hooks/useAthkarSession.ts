import { useEffect } from "react";

import { ATHKAR_TYPE } from "@/constants/Athkar";
import { SESSION_STATUS, type SessionStatus } from "@/constants/AthkarSession";
import { useAppVisibility } from "@/hooks/useAppVisibility";
import { useAthkarStore } from "@/stores/athkar";
import { PLAYER_STATE } from "@/types/athkar-audio";
import {
  nextOpenIndex,
  positionMarks,
  textIndexAt,
  toCounts,
  toSessionItems,
  type Counts,
  type PositionMark,
  type SessionItem,
} from "@/utils/athkarSession";

export type AthkarSession = {
  status: SessionStatus;
  items: readonly SessionItem[];
  counts: Counts;
  /** Null when the session is not ready. */
  index: number | null;
  current: {
    item: SessionItem;
    /** Locale key of the text the count has reached. */
    textKey: string;
    count: number;
    target: number;
    done: boolean;
    /** Audio plays this dhikr and counts it; taps do not. */
    audioOwnsCount: boolean;
  } | null;
  /** The dhikr the session opens after this one; null on the last open one. */
  next: { textKey: string } | null;
  marks: readonly PositionMark[];
  canUndo: boolean;
  advancePending: boolean;
  add: () => void;
  undo: () => void;
  jumpTo: (index: number) => void;
};

const textKeyAt = (item: SessionItem, counts: Counts) =>
  item.textKeys[textIndexAt(item, counts[item.id] ?? 0)];

/** The period's session: the place, the counts and the three things a person does. */
export const useAthkarSession = (): AthkarSession => {
  const type = useAthkarStore((s) => s.currentType);
  const list = useAthkarStore((s) =>
    type === ATHKAR_TYPE.MORNING ? s.morningAthkarList : s.eveningAthkarList
  );
  const progress = useAthkarStore((s) => s.currentProgress);
  const storedIndex = useAthkarStore((s) => s.currentAthkarIndex);
  const advancePending = useAthkarStore((s) => s.advancePending);
  const loaded = useAthkarStore((s) => s.progressDay !== null);
  const playerState = useAthkarStore((s) => s.playerState);
  const playingId = useAthkarStore((s) => s.currentAthkarId);
  const incrementCount = useAthkarStore((s) => s.incrementCount);
  const decrementCount = useAthkarStore((s) => s.decrementCount);
  const jumpToIndex = useAthkarStore((s) => s.jumpToIndex);
  const findOptimalAthkarIndex = useAthkarStore((s) => s.findOptimalAthkarIndex);
  const flushCounts = useAthkarStore((s) => s.flushCounts);
  const syncDay = useAthkarStore((s) => s.syncDay);

  const { isActive, becameActiveAt } = useAppVisibility();
  const hasSession = loaded && list.length > 0;

  // A period opens on its first unfinished dhikr, from where the person last was.
  useEffect(() => {
    if (hasSession) jumpToIndex(findOptimalAthkarIndex(type));
  }, [hasSession, type, jumpToIndex, findOptimalAthkarIndex]);

  // The count write waits for taps to settle; the app may not get that long.
  useEffect(() => {
    if (!isActive) void flushCounts();
  }, [isActive, flushCounts]);
  useEffect(() => () => void flushCounts(), [flushCounts]);

  // The day may have changed while the app was away.
  useEffect(() => {
    if (becameActiveAt) void syncDay();
  }, [becameActiveAt, syncDay]);

  const items = toSessionItems(list);
  const counts = toCounts(progress);
  const allDone = items.every((item) => (counts[item.id] ?? 0) >= item.target);

  const status = !hasSession
    ? SESSION_STATUS.LOADING
    : allDone && !advancePending
      ? SESSION_STATUS.DONE
      : SESSION_STATUS.READY;

  const index =
    status === SESSION_STATUS.READY ? (storedIndex < items.length ? storedIndex : 0) : null;
  const item = index === null ? null : items[index];
  const count = item ? Math.min(counts[item.id] ?? 0, item.target) : 0;
  const nextIndex = index === null ? null : nextOpenIndex(items, counts, index);

  return {
    status,
    items,
    counts,
    index,
    current: item && {
      item,
      textKey: textKeyAt(item, counts),
      count,
      target: item.target,
      done: count >= item.target,
      audioOwnsCount: playerState === PLAYER_STATE.PLAYING && playingId === item.id,
    },
    next: nextIndex === null ? null : { textKey: textKeyAt(items[nextIndex], counts) },
    marks: positionMarks(items, counts, index),
    canUndo: count > 0,
    advancePending,
    add: () => item && incrementCount(item.id),
    undo: () => item && decrementCount(item.id),
    jumpTo: jumpToIndex,
  };
};
