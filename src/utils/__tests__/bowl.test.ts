import { BOWL } from "@/constants/Timeline";
import { bowlPath, bowlPoint } from "@/utils/bowl";

/** The concept's frame: 320 wide, 160 tall. */
const [WIDTH, HEIGHT] = [320, 160];
const horizon = HEIGHT - BOWL.footRoom;
const point = (share: number, isRTL = false, height = HEIGHT) =>
  bowlPoint(share, WIDTH, height, isRTL);

describe("bowlPoint", () => {
  it("stands its feet on the horizon, inset from each edge", () => {
    expect(point(0).x).toBeCloseTo(BOWL.inset);
    expect(point(0).y).toBeCloseTo(horizon);
    expect(point(1).x).toBeCloseTo(WIDTH - BOWL.inset);
    expect(point(1).y).toBeCloseTo(horizon);
  });

  it("matches the concept's numbers: half-chord 138, horizon 136, crest 22", () => {
    expect((point(1).x - point(0).x) / 2).toBeCloseTo(138);
    expect(horizon).toBe(136);
    expect(point(0.5)).toMatchObject({ x: WIDTH / 2, y: BOWL.crest });
  });

  // Equal shares of the day are equal angles, so equal walks along the rim.
  it("spaces equal shares as equal lengths along the rim", () => {
    const step = (from: number, to: number) => {
      const [a, b] = [point(from), point(to)];
      return Math.hypot(b.x - a.x, b.y - a.y);
    };

    expect(step(0, 0.1)).toBeCloseTo(step(0.45, 0.55), 5);
  });

  it("starts at the end edge in RTL, mirrored", () => {
    for (const share of [0, 0.25, 0.6, 1]) {
      const [ltr, rtl] = [point(share), point(share, true)];

      expect(rtl.x).toBeCloseTo(WIDTH - ltr.x);
      expect(rtl.y).toBeCloseTo(ltr.y);
      expect(rtl.nx).toBeCloseTo(-ltr.nx);
    }
  });

  it("points its normal out of the rim", () => {
    expect(point(0.5).ny).toBeCloseTo(-1);
    expect(point(0).nx).toBeLessThan(0);
  });

  // Large text can make the bowl taller than wide.
  it("keeps the feet and crest when the bowl grows taller than it is wide", () => {
    const tall = 260;

    expect(point(0, false, tall).y).toBeCloseTo(tall - BOWL.footRoom);
    expect(point(0, false, tall).x).toBeCloseTo(BOWL.inset);
    expect(point(0.5, false, tall).y).toBeCloseTo(BOWL.crest);
  });
});

describe("bowlPath", () => {
  const ends = (path: string) => path.match(/-?\d+(\.\d+)?/g)!.map(Number);

  it("draws an arc from one share to another", () => {
    const [a, b] = [point(0.2), point(0.7)];
    const numbers = ends(bowlPath(0.2, 0.7, WIDTH, HEIGHT, false));

    expect(numbers.slice(0, 2)).toEqual([a.x, a.y].map((v) => Number(v.toFixed(2))));
    expect(numbers.slice(-2)).toEqual([b.x, b.y].map((v) => Number(v.toFixed(2))));
  });

  it("turns clockwise in LTR and the other way in RTL", () => {
    expect(bowlPath(0, 1, WIDTH, HEIGHT, false)).toMatch(/ 0 0 1 [\d.]+ [\d.]+$/);
    expect(bowlPath(0, 1, WIDTH, HEIGHT, true)).toMatch(/ 0 0 0 [\d.]+ [\d.]+$/);
  });

  it("takes the large arc once the stretch passes half a turn", () => {
    expect(bowlPath(0, 1, WIDTH, 260, false)).toMatch(/ 0 1 1 [\d.]+ [\d.]+$/);
  });
});
