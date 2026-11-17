import {
  FOCUS_GESTURE,
  FOCUS_MODE,
  FOCUS_OUTCOME,
  STEP,
  type FocusMode,
} from "@/constants/AthkarFocus";
import {
  holdAmount,
  lockMode,
  nextSign,
  releaseOutcome,
  sideStep,
  slotX,
  undoArmed,
  undoCommits,
  type Release,
} from "@/utils/focusGesture";

const WIDTH = 400;
const FLICK = FOCUS_GESTURE.FLICK_VELOCITY + 1;

const release = (over: Partial<Release>): Release => ({
  mode: FOCUS_MODE.PENDING,
  dx: 0,
  dy: 0,
  vx: 0,
  vy: 0,
  elapsedMs: 100,
  width: WIDTH,
  rtl: false,
  canPrevious: true,
  canNext: true,
  canUndo: true,
  canTap: true,
  ...over,
});

describe("lockMode", () => {
  it.each<[string, number, number, FocusMode]>([
    ["stays open under the slop", 6, 6, FOCUS_MODE.PENDING],
    ["locks sideways on a wider move", 11, 2, FOCUS_MODE.SIDE],
    ["locks sideways toward either edge", -11, 2, FOCUS_MODE.SIDE],
    ["locks down on a taller downward move", 2, 11, FOCUS_MODE.DOWN],
    ["goes dead on an upward move", 2, -11, FOCUS_MODE.DEAD],
    ["locks at the slop", FOCUS_GESTURE.SLOP, 0, FOCUS_MODE.SIDE],
    ["stays open just under the slop", FOCUS_GESTURE.SLOP - 0.1, 0, FOCUS_MODE.PENDING],
  ])("%s", (_name, dx, dy, mode) => {
    expect(lockMode(dx, dy)).toBe(mode);
  });
});

describe("sideStep", () => {
  it("steps to the next dhikr on a drag toward the start edge past 30% of the width", () => {
    expect(sideStep(-0.31 * WIDTH, 0, WIDTH, false)).toBe(STEP.NEXT);
    expect(sideStep(0.31 * WIDTH, 0, WIDTH, false)).toBe(STEP.PREVIOUS);
  });

  it("reads a drag to the right as next in a right-to-left layout", () => {
    expect(sideStep(0.31 * WIDTH, 0, WIDTH, true)).toBe(STEP.NEXT);
    expect(sideStep(-0.31 * WIDTH, 0, WIDTH, true)).toBe(STEP.PREVIOUS);
  });

  it("stays on a slow drag under 30% of the width", () => {
    expect(sideStep(-0.29 * WIDTH, 0, WIDTH, false)).toBeNull();
  });

  it("steps on a short flick", () => {
    expect(sideStep(-(FOCUS_GESTURE.FLICK_MIN + 1), -FLICK, WIDTH, false)).toBe(STEP.NEXT);
  });

  it("ignores a flick shorter than the flick minimum", () => {
    expect(sideStep(-(FOCUS_GESTURE.FLICK_MIN - 1), -FLICK, WIDTH, false)).toBeNull();
  });

  it("needs a flick faster than the flick speed", () => {
    const dx = -(FOCUS_GESTURE.FLICK_MIN + 1);
    expect(sideStep(dx, -FOCUS_GESTURE.FLICK_VELOCITY, WIDTH, false)).toBeNull();
    expect(sideStep(dx, -FLICK, WIDTH, false)).toBe(STEP.NEXT);
  });

  it("ignores a flick against the drag", () => {
    expect(sideStep(-(FOCUS_GESTURE.FLICK_MIN + 1), FLICK, WIDTH, false)).toBeNull();
  });
});

describe("the row's direction", () => {
  it.each([false, true])("puts the next dhikr where a next drag uncovers it, rtl %s", (rtl) => {
    const drag = nextSign(rtl) * 0.5 * WIDTH;
    expect(sideStep(drag, 0, WIDTH, rtl)).toBe(STEP.NEXT);
    // A row dragged by `drag` shows the slot that sat at `-drag`.
    expect(Math.sign(slotX(STEP.NEXT, WIDTH, rtl))).toBe(-Math.sign(drag));
    expect(slotX(2, WIDTH, rtl)).toBe(2 * slotX(1, WIDTH, rtl));
    expect(Math.abs(slotX(1, WIDTH, rtl))).toBe(WIDTH);
  });
});

describe("undo", () => {
  it("arms at the undo distance", () => {
    expect(undoArmed(FOCUS_GESTURE.UNDO_AT - 1)).toBe(false);
    expect(undoArmed(FOCUS_GESTURE.UNDO_AT)).toBe(true);
  });

  it("commits when armed, or on a downward flick past its minimum", () => {
    expect(undoCommits(FOCUS_GESTURE.UNDO_AT, 0)).toBe(true);
    expect(undoCommits(FOCUS_GESTURE.UNDO_AT - 1, 0)).toBe(false);
    expect(undoCommits(FOCUS_GESTURE.UNDO_FLICK_MIN + 1, FLICK)).toBe(true);
    expect(undoCommits(FOCUS_GESTURE.UNDO_FLICK_MIN - 1, FLICK)).toBe(false);
  });
});

describe("holdAmount", () => {
  it.each([
    [0, 100, FOCUS_GESTURE.HOLD_ADD],
    [97, 100, 3],
    [100, 100, 0],
    [120, 100, 0],
  ])("from %i of %i adds %i", (count, target, amount) => {
    expect(holdAmount(count, target)).toBe(amount);
  });
});

describe("releaseOutcome", () => {
  it("counts a still touch lifted within the tap time", () => {
    expect(releaseOutcome(release({ dx: 6, dy: 6, elapsedMs: 240 }))).toBe(FOCUS_OUTCOME.TAP);
  });

  it("adds nothing for a still touch lifted after the tap time", () => {
    expect(releaseOutcome(release({ elapsedMs: FOCUS_GESTURE.TAP_MAX_MS }))).toBe(
      FOCUS_OUTCOME.TAP
    );
    expect(releaseOutcome(release({ elapsedMs: FOCUS_GESTURE.TAP_MAX_MS + 1 }))).toBe(
      FOCUS_OUTCOME.NONE
    );
  });

  it("never counts a touch that locked a direction", () => {
    const quick = { dx: 0, dy: 0, elapsedMs: 50 };
    expect(releaseOutcome(release({ ...quick, mode: FOCUS_MODE.SIDE }))).toBe(FOCUS_OUTCOME.NONE);
    expect(releaseOutcome(release({ ...quick, mode: FOCUS_MODE.DOWN }))).toBe(FOCUS_OUTCOME.NONE);
    expect(releaseOutcome(release({ ...quick, mode: FOCUS_MODE.DEAD }))).toBe(FOCUS_OUTCOME.NONE);
    expect(releaseOutcome(release({ ...quick, mode: FOCUS_MODE.HELD }))).toBe(FOCUS_OUTCOME.NONE);
  });

  it("moves to the next or the previous dhikr on a committed side drag", () => {
    const side = { mode: FOCUS_MODE.SIDE, elapsedMs: 300 };
    expect(releaseOutcome(release({ ...side, dx: -0.5 * WIDTH }))).toBe(FOCUS_OUTCOME.NEXT);
    expect(releaseOutcome(release({ ...side, dx: 0.5 * WIDTH }))).toBe(FOCUS_OUTCOME.PREVIOUS);
  });

  it("hits the edge when the session has no dhikr that way", () => {
    const side = { mode: FOCUS_MODE.SIDE, elapsedMs: 300 };
    expect(releaseOutcome(release({ ...side, dx: -0.5 * WIDTH, canNext: false }))).toBe(
      FOCUS_OUTCOME.EDGE_NEXT
    );
    expect(releaseOutcome(release({ ...side, dx: 0.5 * WIDTH, canPrevious: false }))).toBe(
      FOCUS_OUTCOME.EDGE_PREVIOUS
    );
  });

  it("undoes on a committed downward drag", () => {
    const down = { mode: FOCUS_MODE.DOWN, elapsedMs: 300 };
    expect(releaseOutcome(release({ ...down, dy: FOCUS_GESTURE.UNDO_AT }))).toBe(
      FOCUS_OUTCOME.UNDO
    );
    expect(releaseOutcome(release({ ...down, dy: FOCUS_GESTURE.UNDO_AT - 1 }))).toBe(
      FOCUS_OUTCOME.NONE
    );
  });

  it("has nothing to undo at a count of zero", () => {
    expect(
      releaseOutcome(release({ mode: FOCUS_MODE.DOWN, dy: FOCUS_GESTURE.UNDO_AT, canUndo: false }))
    ).toBe(FOCUS_OUTCOME.NONE);
  });

  it("keeps the steps when the count cannot change by hand", () => {
    const closed = { canTap: false, canUndo: false };
    expect(releaseOutcome(release(closed))).toBe(FOCUS_OUTCOME.NONE);
    expect(
      releaseOutcome(release({ ...closed, mode: FOCUS_MODE.DOWN, dy: FOCUS_GESTURE.UNDO_AT }))
    ).toBe(FOCUS_OUTCOME.NONE);
    expect(releaseOutcome(release({ ...closed, mode: FOCUS_MODE.SIDE, dx: -0.5 * WIDTH }))).toBe(
      FOCUS_OUTCOME.NEXT
    );
  });
});
