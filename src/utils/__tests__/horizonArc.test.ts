import { HORIZON_FOCUS_PATH } from "@/constants/AthkarHorizon";
import { MARK_SIZE, MARK_STATE } from "@/constants/AthkarSession";
import type { PositionMark } from "@/utils/athkarSession";
import {
  MARK_ROOM,
  ARC_SPAN,
  circleArc,
  litShare,
  markShares,
  quadCurve,
  type ArcCurve,
} from "@/utils/horizonArc";

const mark = (i: number, size: PositionMark["size"] = MARK_SIZE.FULL): PositionMark => ({
  id: `${i}`,
  state: MARK_STATE.REMAINING,
  size,
});
const marks = (n: number) => Array.from({ length: n }, (_, i) => mark(i));

const gap = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** Twenty equal shares of a curve are twenty equal steps along it. */
const expectEvenSteps = (curve: ArcCurve) => {
  const points = Array.from({ length: 21 }, (_, i) => curve.pointAt(i / 20));
  const steps = points.slice(1).map((point, i) => gap(point, points[i]));
  const mean = steps.reduce((sum, step) => sum + step, 0) / steps.length;
  steps.forEach((step) => expect(Math.abs(step - mean) / mean).toBeLessThan(0.02));
};

describe("quadCurve", () => {
  // The reader's arc as the design draws it, from the right end to the left.
  const curve = quadCurve({ x: 276, y: 90 }, { x: 142, y: -36 }, { x: 8, y: 90 });

  it("writes the path it measures", () => {
    expect(curve.d).toBe("M276 90 Q142 -36 8 90");
  });

  it("starts and ends on its end points, and peaks half way", () => {
    expect(curve.pointAt(0)).toEqual({ x: 276, y: 90 });
    expect(curve.pointAt(1)).toEqual({ x: 8, y: 90 });
    const top = curve.pointAt(0.5);
    expect(top.x).toBeCloseTo(142, 1);
    expect(top.y).toBeCloseTo(27, 1);
  });

  it("measures by distance along the curve, not by the curve's parameter", () => {
    expectEvenSteps(curve);
    expect(curve.length).toBeGreaterThan(gap({ x: 276, y: 90 }, { x: 8, y: 90 }));
  });

  it("holds a share outside the curve at its ends", () => {
    expect(curve.pointAt(-1)).toEqual(curve.pointAt(0));
    expect(curve.pointAt(2)).toEqual(curve.pointAt(1));
  });
});

describe("circleArc", () => {
  // Focus: over the top of a 106 circle in a 228 box, from the right foot to the left.
  const curve = circleArc({ x: 114, y: 114 }, 106, { x: 216.4, y: 86.6 }, { x: 11.6, y: 86.6 });

  it("writes the short way over the top", () => {
    expect(curve.d).toBe("M216.4 86.6 A106 106 0 0 0 11.6 86.6");
  });

  it("passes over the top of the circle half way", () => {
    const top = curve.pointAt(0.5);
    expect(top.x).toBeCloseTo(114, 1);
    expect(top.y).toBeCloseTo(8, 1);
  });

  it("keeps every point on the circle, in even steps", () => {
    [0, 0.2, 0.7, 1].forEach((share) =>
      expect(gap(curve.pointAt(share), { x: 114, y: 114 })).toBeCloseTo(106, 0)
    );
    expectEvenSteps(curve);
  });

  it("runs the other way round between swapped ends", () => {
    const back = circleArc({ x: 114, y: 114 }, 106, { x: 11.6, y: 86.6 }, { x: 216.4, y: 86.6 });
    expect(back.d).toBe("M11.6 86.6 A106 106 0 0 1 216.4 86.6");
    expect(back.pointAt(0.5).y).toBeCloseTo(8, 1);
    expect(back.pointAt(0.25).x).toBeLessThan(114);
  });
});

describe("markShares", () => {
  it("spreads the marks evenly inside the span", () => {
    const shares = markShares(marks(3));
    const width = ARC_SPAN.END - ARC_SPAN.START;
    expect(shares[0]).toBeCloseTo(ARC_SPAN.START + width / 6);
    expect(shares[1]).toBeCloseTo(0.5);
    expect(shares[2]).toBeCloseTo(ARC_SPAN.END - width / 6);
  });

  it("gives each mark the room of its size", () => {
    const shares = markShares([mark(0), mark(1, MARK_SIZE.FINE), mark(2, MARK_SIZE.FINE)]);
    const { [MARK_SIZE.FULL]: full, [MARK_SIZE.FINE]: fine } = MARK_ROOM;
    expect(fine).toBeLessThan(full / 2);
    // Centre to centre: half of each mark's room.
    expect((shares[1] - shares[0]) / (shares[2] - shares[1])).toBeCloseTo(
      (full + fine) / (2 * fine)
    );
    expect(shares[2]).toBeLessThan(ARC_SPAN.END);
  });

  it("has no share for no marks", () => {
    expect(markShares([])).toEqual([]);
  });
});

describe("litShare", () => {
  const shares = markShares(marks(4));

  it("rests on the mark before the place at a count of zero", () => {
    expect(litShare(shares, 2, 0)).toBe(shares[1]);
  });

  it("reaches the place's mark at the target", () => {
    expect(litShare(shares, 2, 1)).toBe(shares[2]);
  });

  it("grows from the arc's start on the first dhikr", () => {
    expect(litShare(shares, 0, 0)).toBe(0);
    expect(litShare(shares, 0, 0.5)).toBeCloseTo(shares[0] / 2);
  });

  it("is whole to the last mark when the session has no place", () => {
    expect(litShare(shares, null, 0)).toBe(shares[3]);
  });

  it("holds a fraction outside 0 to 1", () => {
    expect(litShare(shares, 2, 4)).toBe(shares[2]);
    expect(litShare(shares, 2, -1)).toBe(shares[1]);
  });
});

describe("Focus's arc", () => {
  it("ends on its own circle, level on both sides", () => {
    const { CENTRE, RADIUS, FROM, TO } = HORIZON_FOCUS_PATH;
    expect(gap(FROM, CENTRE)).toBeCloseTo(RADIUS, 0);
    expect(gap(TO, CENTRE)).toBeCloseTo(RADIUS, 0);
    expect(FROM.y).toBe(TO.y);
    expect(FROM.x - CENTRE.x).toBeCloseTo(CENTRE.x - TO.x, 5);
  });
});
