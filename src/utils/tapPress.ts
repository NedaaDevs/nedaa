import {
  TAP_OUTCOME,
  TAP_PRESSES,
  TAP_PRESS_MIN_GAP_MS,
  type TapOutcome,
} from "@/constants/WakeTaskBoards";

/** A press counts unless it comes sooner than the gap after the last counted one. */
export const countsPress = (lastCounted: number | null, now: number): boolean =>
  lastCounted === null || now - lastCounted >= TAP_PRESS_MIN_GAP_MS;

/** Presses counted so far, and when the last of them landed. */
export type TapBoardState = { readonly done: number; readonly lastCounted: number | null };

export const startTapBoard = (): TapBoardState => ({ done: 0, lastCounted: null });

/** A press counts, solves on the TAP_PRESSES-th count, or is ignored once solved or too soon. */
export const pressTap = (
  state: TapBoardState,
  now: number
): { outcome: TapOutcome; state: TapBoardState } => {
  if (state.done >= TAP_PRESSES || !countsPress(state.lastCounted, now)) {
    return { outcome: TAP_OUTCOME.IGNORED, state };
  }
  const done = state.done + 1;
  return {
    outcome: done < TAP_PRESSES ? TAP_OUTCOME.COUNTED : TAP_OUTCOME.SOLVED,
    state: { done, lastCounted: now },
  };
};

/** The count a screen reader hears: each one between none and the last. */
export const tapStatusOf = (done: number): number | null =>
  done > 0 && done < TAP_PRESSES ? done : null;
