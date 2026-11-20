import { useEffect } from "react";

import type { StepDirection } from "@/constants/AthkarFocus";
import { SESSION_STATUS, type SessionStatus } from "@/constants/AthkarSession";
import { useAppVisibility } from "@/hooks/useAppVisibility";
import {
  nextOpenIndex,
  positionMarks,
  textAt,
  type Counts,
  type PositionMark,
  type SessionItem,
} from "@/utils/athkarSession";
import type { DhikrText } from "@/utils/athkarText";

export type AthkarSession = {
  status: SessionStatus;
  items: readonly SessionItem[];
  counts: Counts;
  /** Null when the session is not ready. */
  index: number | null;
  current: {
    item: SessionItem;
    /** Names the text the count has reached; a group's next text has another. */
    textId: string;
    text: DhikrText;
    count: number;
    target: number;
    done: boolean;
    /** Audio is on this dhikr and counts it; taps do not. */
    audioOwnsCount: boolean;
  } | null;
  /** The dhikr the session opens after this one; null on the last open one. */
  next: { text: DhikrText } | null;
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

/** What the engine reads a session through: one source's dhikr, counts, place and actions. */
export type SessionPort = {
  /** The source's dhikr and the day's counts are in memory. */
  ready: boolean;
  items: readonly SessionItem[];
  counts: Counts;
  index: number;
  advancePending: boolean;
  /** Audio counts this dhikr; taps do not. */
  audioOwnsCount: (id: string) => boolean;
  add: (id: string) => void;
  addMany: (id: string, by: number) => void;
  undo: (id: string) => void;
  /** An index outside the session changes nothing. */
  jumpTo: (index: number) => void;
  flush: () => Promise<void>;
  syncDay: () => Promise<void>;
};

/** A load that ended without a session, and the way to try it again. */
export type SessionLoad = {
  settled: boolean;
  /** Absent where trying again cannot bring a session. */
  retry?: () => void;
};

/** A session over one source: the place, the counts and the three things a person does. */
export const useAthkarSession = (port: SessionPort): AthkarSession => {
  const { items, counts, advancePending, flush, syncDay } = port;
  const { isActive, becameActiveAt } = useAppVisibility();

  // The count write waits for taps to settle; the app may not get that long.
  useEffect(() => {
    if (!isActive) void flush();
  }, [isActive, flush]);
  useEffect(() => () => void flush(), [flush]);

  // The day may have changed while the app was away.
  useEffect(() => {
    if (becameActiveAt) void syncDay();
  }, [becameActiveAt, syncDay]);

  const allDone = items.every((item) => (counts[item.id] ?? 0) >= item.target);

  const status = !port.ready
    ? SESSION_STATUS.LOADING
    : allDone && !advancePending
      ? SESSION_STATUS.DONE
      : SESSION_STATUS.READY;

  const index =
    status === SESSION_STATUS.READY ? (port.index < items.length ? port.index : 0) : null;
  const item = index === null ? null : items[index];
  const count = item ? Math.min(counts[item.id] ?? 0, item.target) : 0;
  const nextIndex = index === null ? null : nextOpenIndex(items, counts, index);
  const shown = item && textAt(item, counts);

  return {
    status,
    items,
    counts,
    index,
    current: item &&
      shown && {
        item,
        textId: shown.id,
        text: shown.text,
        count,
        target: item.target,
        done: count >= item.target,
        audioOwnsCount: port.audioOwnsCount(item.id),
      },
    next: nextIndex === null ? null : { text: textAt(items[nextIndex], counts).text },
    marks: positionMarks(items, counts, index),
    canUndo: count > 0,
    advancePending,
    canStep: {
      previous: index !== null && index > 0,
      next: index !== null && index < items.length - 1,
    },
    add: () => item && port.add(item.id),
    addMany: (by) => item && port.addMany(item.id, by),
    undo: () => item && port.undo(item.id),
    jumpTo: port.jumpTo,
    step: (by) => index !== null && port.jumpTo(index + by),
  };
};
