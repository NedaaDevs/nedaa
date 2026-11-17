import {
  FOCUS_GESTURE,
  FOCUS_MODE,
  FOCUS_OUTCOME,
  STEP,
  type FocusMode,
  type FocusOutcome,
  type StepDirection,
} from "@/constants/AthkarFocus";

/** The direction a moving touch locks; PENDING while it is still a press. */
export const lockMode = (dx: number, dy: number): FocusMode => {
  if (Math.hypot(dx, dy) < FOCUS_GESTURE.SLOP) return FOCUS_MODE.PENDING;
  if (Math.abs(dx) > Math.abs(dy)) return FOCUS_MODE.SIDE;
  return dy > 0 ? FOCUS_MODE.DOWN : FOCUS_MODE.DEAD;
};

/** The sign of a drag that opens the next dhikr: toward the start edge. */
export const nextSign = (rtl: boolean): 1 | -1 => (rtl ? 1 : -1);

/** Where dhikr `i` sits in the row: `i` widths toward the end edge. */
export const slotX = (i: number, width: number, rtl: boolean): number => -nextSign(rtl) * i * width;

/** A side drag's step: toward the start edge is next. Null: stay. */
export const sideStep = (
  dx: number,
  vx: number,
  width: number,
  rtl: boolean
): StepDirection | null => {
  const far = Math.abs(dx) > width * FOCUS_GESTURE.SWIPE_COMMIT;
  const flick =
    Math.abs(vx) > FOCUS_GESTURE.FLICK_VELOCITY &&
    Math.abs(dx) > FOCUS_GESTURE.FLICK_MIN &&
    Math.sign(vx) === Math.sign(dx);
  if (!far && !flick) return null;
  return Math.sign(dx) === nextSign(rtl) ? STEP.NEXT : STEP.PREVIOUS;
};

export const undoArmed = (dy: number): boolean => {
  return dy >= FOCUS_GESTURE.UNDO_AT;
};

export const undoCommits = (dy: number, vy: number): boolean => {
  return undoArmed(dy) || (vy > FOCUS_GESTURE.FLICK_VELOCITY && dy > FOCUS_GESTURE.UNDO_FLICK_MIN);
};

/** What a hold adds: ten, or what is left to the target. */
export const holdAmount = (count: number, target: number): number =>
  Math.max(0, Math.min(FOCUS_GESTURE.HOLD_ADD, target - count));

export type Release = {
  mode: FocusMode;
  dx: number;
  dy: number;
  vx: number;
  vy: number;
  elapsedMs: number;
  width: number;
  rtl: boolean;
  canPrevious: boolean;
  canNext: boolean;
  /** False while audio owns the count. */
  canTap: boolean;
  canUndo: boolean;
};

/** What a lifted touch does. */
export const releaseOutcome = (release: Release): FocusOutcome => {
  const { mode, dx, dy, vx, vy, elapsedMs, width, rtl, canPrevious, canNext, canTap, canUndo } =
    release;
  if (mode === FOCUS_MODE.PENDING) {
    return canTap && elapsedMs <= FOCUS_GESTURE.TAP_MAX_MS ? FOCUS_OUTCOME.TAP : FOCUS_OUTCOME.NONE;
  }
  if (mode === FOCUS_MODE.SIDE) {
    const step = sideStep(dx, vx, width, rtl);
    if (step === null) return FOCUS_OUTCOME.NONE;
    if (step === STEP.NEXT) return canNext ? FOCUS_OUTCOME.NEXT : FOCUS_OUTCOME.EDGE_NEXT;
    return canPrevious ? FOCUS_OUTCOME.PREVIOUS : FOCUS_OUTCOME.EDGE_PREVIOUS;
  }
  if (mode === FOCUS_MODE.DOWN) {
    return canUndo && undoCommits(dy, vy) ? FOCUS_OUTCOME.UNDO : FOCUS_OUTCOME.NONE;
  }
  return FOCUS_OUTCOME.NONE;
};
