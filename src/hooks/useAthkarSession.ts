import { useEffect } from "react";

import { ATHKAR_TYPE } from "@/constants/Athkar";
import type { StepDirection } from "@/constants/AthkarFocus";
import { SESSION_STATUS, type SessionStatus } from "@/constants/AthkarSession";
import { useAppVisibility } from "@/hooks/useAppVisibility";
import { useAthkarStore } from "@/stores/athkar";
import {
  audioOwnsCount,
  nextOpenIndex,
  positionMarks,
  textKeyAt,
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
    /** Audio is on this dhikr and counts it; taps do not. */
    audioOwnsCount: boolean;
  } | null;
  /** The dhikr the session opens after this one; null on the last open one. */
  next: { textKey: string } | null;
  marks: readonly PositionMark[];
  canUndo: boolean;
  advancePending: boolean;
  /** Whether the session has a dhikr on each side of the place. */
  canStep: { previous: boolean; next: boolean };
  add: () => void;
  /** Adds up to `by`, stopping at the target. */
  addMany: (by: number) => void;
  undo: () => void;
  jumpTo: (index: number) => void;
  /** Moves one dhikr in session order, finished ones included. */
  step: (by: StepDirection) => void;
};

const useHasSession = () =>
  useAthkarStore((s) => {
    const list = s.currentType === ATHKAR_TYPE.MORNING ? s.morningAthkarList : s.eveningAthkarList;
    return s.progressDay !== null && list.length > 0;
  });

/** Opens the period on its first unfinished dhikr, from the last place. */
export const useSessionOpening = () => {
  const type = useAthkarStore((s) => s.currentType);
  const jumpToIndex = useAthkarStore((s) => s.jumpToIndex);
  const findOptimalAthkarIndex = useAthkarStore((s) => s.findOptimalAthkarIndex);
  const hasSession = useHasSession();

  useEffect(() => {
    if (hasSession) jumpToIndex(findOptimalAthkarIndex(type));
  }, [hasSession, type, jumpToIndex, findOptimalAthkarIndex]);
};

/** The period's session: the place, the counts and the three things a person does. */
export const useAthkarSession = (): AthkarSession => {
  const type = useAthkarStore((s) => s.currentType);
  const list = useAthkarStore((s) =>
    type === ATHKAR_TYPE.MORNING ? s.morningAthkarList : s.eveningAthkarList
  );
  const progress = useAthkarStore((s) => s.currentProgress);
  const storedIndex = useAthkarStore((s) => s.currentAthkarIndex);
  const advancePending = useAthkarStore((s) => s.advancePending);
  const playerState = useAthkarStore((s) => s.playerState);
  const playingId = useAthkarStore((s) => s.currentAthkarId);
  const loadingId = useAthkarStore((s) => s.loadingAthkarId);
  const incrementCount = useAthkarStore((s) => s.incrementCount);
  const incrementCountBy = useAthkarStore((s) => s.incrementCountBy);
  const decrementCount = useAthkarStore((s) => s.decrementCount);
  const jumpToIndex = useAthkarStore((s) => s.jumpToIndex);
  const flushCounts = useAthkarStore((s) => s.flushCounts);
  const syncDay = useAthkarStore((s) => s.syncDay);

  const { isActive, becameActiveAt } = useAppVisibility();
  const hasSession = useHasSession();

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
      audioOwnsCount: audioOwnsCount(
        { playerState, currentAthkarId: playingId, loadingAthkarId: loadingId },
        item.id
      ),
    },
    next: nextIndex === null ? null : { textKey: textKeyAt(items[nextIndex], counts) },
    marks: positionMarks(items, counts, index),
    canUndo: count > 0,
    advancePending,
    canStep: {
      previous: index !== null && index > 0,
      next: index !== null && index < items.length - 1,
    },
    add: () => item && incrementCount(item.id),
    addMany: (by) => item && incrementCountBy(item.id, by),
    undo: () => item && decrementCount(item.id),
    jumpTo: jumpToIndex,
    // The store refuses an index outside the session.
    step: (by) => index !== null && jumpToIndex(index + by),
  };
};
