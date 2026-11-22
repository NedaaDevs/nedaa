import { TAP_OUTCOME, TAP_PRESSES, TAP_PRESS_MIN_GAP_MS } from "@/constants/WakeTaskBoards";
import { pressTap, startTapBoard, tapStatusOf, type TapBoardState } from "@/utils/tapPress";

/** Presses `count` times, each a full gap after the last, from `from`. */
const pressSpaced = (state: TapBoardState, count: number, from = 0): TapBoardState => {
  let next = state;
  for (let i = 0; i < count; i += 1) next = pressTap(next, from + i * TAP_PRESS_MIN_GAP_MS).state;
  return next;
};

describe("pressTap", () => {
  it("starts at none", () => {
    expect(startTapBoard()).toEqual({ done: 0, lastCounted: null });
  });

  it("counts the first press", () => {
    expect(pressTap(startTapBoard(), 0)).toEqual({
      outcome: TAP_OUTCOME.COUNTED,
      state: { done: 1, lastCounted: 0 },
    });
  });

  it("ignores a press sooner than the gap and keeps the gap from the last counted one", () => {
    const once = pressTap(startTapBoard(), 0).state;
    const bounce = pressTap(once, TAP_PRESS_MIN_GAP_MS - 1);

    expect(bounce).toEqual({ outcome: TAP_OUTCOME.IGNORED, state: once });
    expect(pressTap(bounce.state, TAP_PRESS_MIN_GAP_MS).outcome).toBe(TAP_OUTCOME.COUNTED);
  });

  it("solves on the last press, not one sooner", () => {
    const almost = pressSpaced(startTapBoard(), TAP_PRESSES - 1);
    expect(almost.done).toBe(TAP_PRESSES - 1);

    const last = pressTap(almost, TAP_PRESSES * TAP_PRESS_MIN_GAP_MS);
    expect(last.outcome).toBe(TAP_OUTCOME.SOLVED);
    expect(last.state.done).toBe(TAP_PRESSES);
  });

  it("ignores every press once solved", () => {
    const solved = pressSpaced(startTapBoard(), TAP_PRESSES);

    expect(pressTap(solved, Number.MAX_SAFE_INTEGER)).toEqual({
      outcome: TAP_OUTCOME.IGNORED,
      state: solved,
    });
  });
});

describe("tapStatusOf", () => {
  it("says each count between none and the last", () => {
    expect(tapStatusOf(0)).toBeNull();
    expect(tapStatusOf(1)).toBe(1);
    expect(tapStatusOf(TAP_PRESSES - 1)).toBe(TAP_PRESSES - 1);
    expect(tapStatusOf(TAP_PRESSES)).toBeNull();
  });
});
