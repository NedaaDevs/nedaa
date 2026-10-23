import { RHYTHM_ARC } from "@/constants/Timeline";
import { arcPath, arcPoint } from "@/utils/rhythmArc";

const WIDTH = 340;
const { inset, base } = RHYTHM_ARC;

/** The last point a path draws to. */
const endOf = (path: string) => path.trim().split(/[ML]/).filter(Boolean).at(-1)?.trim();
const xy = ({ x, y }: { x: number; y: number }) => `${x.toFixed(2)} ${y.toFixed(2)}`;

describe("arcPoint", () => {
  it("starts at the start edge's foot and ends at the end edge's foot", () => {
    expect(arcPoint(0, WIDTH, false)).toEqual({ x: inset, y: base });
    expect(arcPoint(1, WIDTH, false).x).toBeCloseTo(WIDTH - inset);
    expect(arcPoint(1, WIDTH, false).y).toBeCloseTo(base);
  });

  it("crests at the middle of the day's share", () => {
    const middle = arcPoint(0.5, WIDTH, false);

    expect(middle.x).toBeCloseTo(WIDTH / 2);
    for (const share of [0.1, 0.3, 0.7, 0.9]) {
      expect(arcPoint(share, WIDTH, false).y).toBeGreaterThan(middle.y);
    }
  });

  // Placed by length along the curve, so equal shares are equal walks.
  it("spaces equal shares as equal lengths along the curve", () => {
    const step = (from: number, to: number) => {
      const [a, b] = [arcPoint(from, WIDTH, false), arcPoint(to, WIDTH, false)];
      return Math.hypot(b.x - a.x, b.y - a.y);
    };

    expect(step(0, 0.1)).toBeCloseTo(step(0.45, 0.55), 0);
  });

  it("runs from the end edge in RTL, mirrored", () => {
    for (const share of [0, 0.25, 0.6, 1]) {
      const ltr = arcPoint(share, WIDTH, false);
      const rtl = arcPoint(share, WIDTH, true);

      expect(rtl.x).toBeCloseTo(WIDTH - ltr.x);
      expect(rtl.y).toBeCloseTo(ltr.y);
    }
  });
});

describe("arcPath", () => {
  it("draws the whole day from the start point to the end point", () => {
    const path = arcPath(0, 1, WIDTH, false);

    expect(path.startsWith(`M${xy(arcPoint(0, WIDTH, false))}`)).toBe(true);
    expect(endOf(path)).toBe(xy(arcPoint(1, WIDTH, false)));
  });

  it("draws a part of the day between its two shares", () => {
    const path = arcPath(0, 0.4, WIDTH, true);

    expect(path.startsWith(`M${xy(arcPoint(0, WIDTH, true))}`)).toBe(true);
    expect(endOf(path)).toBe(xy(arcPoint(0.4, WIDTH, true)));
  });
});
