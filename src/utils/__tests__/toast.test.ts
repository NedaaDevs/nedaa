import { TOAST_KIND, TOAST_SWIPE } from "@/constants/Toast";
import { announcementFor, swipeOutcome, SWIPE, toastDwellMs } from "@/utils/toast";

const RETRY = { label: "Retry", onPress: jest.fn() };

describe("toastDwellMs", () => {
  it.each([
    [TOAST_KIND.SUCCESS, 3000],
    [TOAST_KIND.INFO, 4000],
    [TOAST_KIND.PROGRESS, 8000],
    [TOAST_KIND.WARNING, 6000],
    [TOAST_KIND.ERROR, 8000],
  ])("holds a %s toast for %ims", (kind, ms) => {
    expect(toastDwellMs({ kind, message: "m" }, false)).toBe(ms);
  });

  it("gives a toast with an action two more seconds to reach it", () => {
    expect(toastDwellMs({ kind: TOAST_KIND.ERROR, message: "m", action: RETRY }, false)).toBe(
      10_000
    );
  });

  it("doubles the time while a screen reader is running", () => {
    expect(toastDwellMs({ kind: TOAST_KIND.SUCCESS, message: "m" }, true)).toBe(6000);
  });

  it("takes the caller's time for a toast that waits on a known timeout", () => {
    expect(
      toastDwellMs({ kind: TOAST_KIND.PROGRESS, message: "m", durationMs: 12_000 }, false)
    ).toBe(12_000);
  });
});

describe("swipeOutcome", () => {
  it.each([
    [0, SWIPE.RETURN],
    [TOAST_SWIPE.dismissAt, SWIPE.RETURN],
    [TOAST_SWIPE.dismissAt + 1, SWIPE.DISMISS],
    [-40, SWIPE.RETURN],
  ])("a %ipt downward drag ends in %s", (dy, outcome) => {
    expect(swipeOutcome(dy)).toBe(outcome);
  });
});

describe("announcementFor", () => {
  it("interrupts for an error", () => {
    expect(announcementFor(TOAST_KIND.ERROR)).toEqual({ queue: false, priority: "high" });
  });

  it("waits its turn for everything else", () => {
    expect(announcementFor(TOAST_KIND.SUCCESS)).toEqual({ queue: true });
  });
});
