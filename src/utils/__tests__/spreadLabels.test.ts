import { spreadLabels } from "@/utils/spreadLabels";

const SPACE = 8;

describe("spreadLabels", () => {
  it("leaves names with room at their marks", () => {
    expect(spreadLabels([50, 150, 250], [40, 40, 40], 300, SPACE)).toEqual([50, 150, 250]);
  });

  // Two names 10 apart need 48: each moves 19, the least either can.
  it("moves crowded names apart evenly about their midpoint", () => {
    const [a, b] = spreadLabels([100, 110], [40, 40], 300, SPACE);

    expect(a).toBeCloseTo(81);
    expect(b).toBeCloseTo(129);
  });

  it("keeps each name at least its neighbours' half widths and the space apart", () => {
    const widths = [30, 70, 40, 36];
    const placed = spreadLabels([40, 60, 200, 215], widths, 300, SPACE);

    placed.slice(1).forEach((x, i) => {
      expect(x - placed[i]).toBeGreaterThanOrEqual((widths[i] + widths[i + 1]) / 2 + SPACE - 1e-9);
    });
  });

  it("keeps names inside the line's edges", () => {
    const placed = spreadLabels([5, 15], [40, 40], 300, SPACE);

    expect(placed[0]).toBeGreaterThanOrEqual(20);
    expect(placed[1] - placed[0]).toBeCloseTo(48);
  });

  // With no room for all of them, the names share what there is evenly.
  it("centres the names when they cannot all fit", () => {
    const placed = spreadLabels([10, 20, 30], [60, 60, 60], 100, SPACE);

    expect(placed[1]).toBeCloseTo(50);
    expect(placed[2] - placed[1]).toBeCloseTo(placed[1] - placed[0]);
  });
});
