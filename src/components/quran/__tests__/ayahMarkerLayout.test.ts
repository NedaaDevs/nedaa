import { medallionBox } from "@/utils/quranOrnaments";

describe("medallionBox", () => {
  it("scales height by the multiplier and derives width from the native aspect", () => {
    const box = medallionBox(40, 40, 0.728, 1.1);
    expect(box.height).toBeCloseTo(44, 3); // 40 * 1.1
    expect(box.width).toBeCloseTo(44 * 0.728, 3); // height * aspect (portrait → narrower)
  });
  it("derives the interim circle's box the same way", () => {
    const box = medallionBox(40, 40, 0.75, 1.1);
    expect(box.width).toBeCloseTo(33, 3);
    expect(box.height).toBeCloseTo(44, 3);
  });
});
