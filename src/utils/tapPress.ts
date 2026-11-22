import { TAP_PRESS_MIN_GAP_MS } from "@/constants/WakeTaskBoards";

/** A press counts unless it comes sooner than the gap after the last counted one. */
export const countsPress = (lastCounted: number | null, now: number): boolean =>
  lastCounted === null || now - lastCounted >= TAP_PRESS_MIN_GAP_MS;
