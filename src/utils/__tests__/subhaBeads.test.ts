import { SUBHA_BEADS, SUBHA_STRING, SUBHA_STRING_KIND } from "@/constants/AthkarSubha";
import {
  BEAD_MOVE,
  beadGradient,
  beadMove,
  beadPoint,
  beadsAcross,
  beadsOn,
  stringPath,
  tensOf,
} from "@/utils/subhaBeads";

const { ROUND } = SUBHA_BEADS;
const READER = SUBHA_STRING[SUBHA_STRING_KIND.READER];
const FOCUS = SUBHA_STRING[SUBHA_STRING_KIND.FOCUS];

describe("beadsOn", () => {
  it("strings one bead per repeat, up to a round", () => {
    expect(beadsOn(1)).toBe(1);
    expect(beadsOn(3)).toBe(3);
    expect(beadsOn(ROUND)).toBe(ROUND);
    expect(beadsOn(33)).toBe(ROUND);
    expect(beadsOn(0)).toBe(0);
  });
});

describe("beadsAcross", () => {
  it("moves one bead across for each repeat", () => {
    expect(beadsAcross(0, 3)).toBe(0);
    expect(beadsAcross(2, 3)).toBe(2);
  });

  it("starts a new round after each ten of a long count", () => {
    expect(beadsAcross(9, 33)).toBe(9);
    expect(beadsAcross(10, 33)).toBe(0);
    expect(beadsAcross(14, 33)).toBe(4);
  });

  it("rests every bead across once the target is reached", () => {
    expect(beadsAcross(3, 3)).toBe(3);
    expect(beadsAcross(33, 33)).toBe(ROUND);
    expect(beadsAcross(100, 100)).toBe(ROUND);
  });

  it("draws nothing across with no beads", () => {
    expect(beadsAcross(0, 0)).toBe(0);
  });
});

describe("tensOf", () => {
  it("gives a long count one dot per round, lit as each round passes", () => {
    expect(tensOf(33, 33)).toEqual({ dots: 3, lit: 3 });
    expect(tensOf(42, 100)).toEqual({ dots: 10, lit: 4 });
  });

  it("gives a count of a round or less no dots", () => {
    expect(tensOf(3, ROUND)).toEqual({ dots: 0, lit: 0 });
    expect(tensOf(1, 3)).toEqual({ dots: 0, lit: 0 });
  });
});

describe("beadPoint", () => {
  const step = READER.BEAD + SUBHA_BEADS.GAP;

  it("rests waiting beads together at the start side", () => {
    // Three beads, none counted: packed against the far end in the drawn frame.
    const xs = [0, 1, 2].map((i) => beadPoint(i, 0, 3, READER, true).x);
    expect(xs).toEqual([
      READER.WIDTH - READER.BEAD - 2 * step,
      READER.WIDTH - READER.BEAD - step,
      READER.WIDTH - READER.BEAD,
    ]);
  });

  it("crosses a counted bead to the other end", () => {
    expect(beadPoint(0, 1, 3, READER, true).x).toBe(0);
    expect(beadPoint(1, 2, 3, READER, true).x).toBe(step);
  });

  it("starts from the right in Arabic and from the left otherwise", () => {
    const rtl = beadPoint(2, 0, 3, READER, true).x;
    const ltr = beadPoint(2, 0, 3, READER, false).x;
    expect(rtl).toBe(READER.WIDTH - READER.BEAD);
    expect(ltr).toBe(0);
  });

  it("hangs a bead on a sagging string, lowest in the middle", () => {
    const n = ROUND;
    const ends = beadPoint(0, 0, n, FOCUS, true).y;
    const middle = Math.max(...[...Array(n).keys()].map((i) => beadPoint(i, 5, n, FOCUS, true).y));
    expect(middle).toBeGreaterThan(ends);
    expect(middle).toBeLessThanOrEqual(FOCUS.SAG);
  });

  it("keeps every bead level on a straight string", () => {
    expect(beadPoint(4, 2, ROUND, READER, true).y).toBe(0);
  });
});

describe("stringPath", () => {
  // The path is "M x0 y0 Q cx cy x1 y1"; its x runs evenly from end to end.
  const curve = (box: typeof FOCUS | typeof READER) => {
    const [x0, y0, cx, cy, x1, y1] = (stringPath(box).match(/-?[\d.]+/g) ?? []).map(Number);
    return (x: number) => {
      const t = (x - x0) / (x1 - x0);
      expect(cx).toBeCloseTo((x0 + x1) / 2);
      return (1 - t) ** 2 * y0 + 2 * t * (1 - t) * cy + t ** 2 * y1;
    };
  };

  it.each([
    ["reader", READER],
    ["focus", FOCUS],
  ])("threads every bead's centre on the %s string", (_, box) => {
    const yAt = curve(box);
    for (const rtl of [true, false]) {
      for (let across = 0; across <= ROUND; across++) {
        for (let index = 0; index < ROUND; index++) {
          const { x, y } = beadPoint(index, across, ROUND, box, rtl);
          expect(y + box.BEAD / 2).toBeCloseTo(yAt(x + box.BEAD / 2));
        }
      }
    }
  });
});

describe("beadMove", () => {
  const LONG = 33;
  // Beads whose place differs between a full round and `count`.
  const shifted = (count: number) =>
    [...Array(ROUND).keys()].filter(
      (i) =>
        beadPoint(i, ROUND, ROUND, READER, true).x !==
        beadPoint(i, beadsAcross(count, LONG), ROUND, READER, true).x
    ).length;

  it("places the beads on the first draw", () => {
    expect(beadMove(null, 4, LONG)).toBe(BEAD_MOVE.PLACE);
  });

  it("sweeps the round when a repeat ends it", () => {
    expect(beadMove(9, 10, LONG)).toBe(BEAD_MOVE.SWEEP);
    expect(beadMove(19, 20, LONG)).toBe(BEAD_MOVE.SWEEP);
  });

  it("undoes a round's end by sliding one bead back from a full round", () => {
    expect(beadMove(10, 9, LONG)).toBe(BEAD_MOVE.UNWIND);
    expect(beadMove(20, 19, LONG)).toBe(BEAD_MOVE.UNWIND);
    expect(shifted(9)).toBe(1);
    expect(shifted(19)).toBe(1);
  });

  it("slides within a round, and at a reached target", () => {
    expect(beadMove(3, 4, LONG)).toBe(BEAD_MOVE.SLIDE);
    expect(beadMove(4, 3, LONG)).toBe(BEAD_MOVE.SLIDE);
    expect(beadMove(32, 33, LONG)).toBe(BEAD_MOVE.SLIDE);
    expect(beadMove(3, 2, 3)).toBe(BEAD_MOVE.SLIDE);
  });
});

describe("beadGradient", () => {
  it("lights a bead from its upper left with three colours", () => {
    const image = beadGradient(16, { light: "#FFFFFF", mid: "#D4EDF7", edge: "#9AC4E0" });
    expect(image).toMatch(/^radial-gradient\(/);
    expect(image).toContain("at 5.6px 4.8px");
    expect(image).toContain("#FFFFFF 0%");
    expect(image).toContain(`#D4EDF7 ${SUBHA_BEADS.MID_STOP * 100}%`);
    expect(image).toContain("#9AC4E0 100%");
  });
});
