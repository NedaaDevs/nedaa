import { readerColumnWidth, READER_MEASURE_EM, pinchFontSize } from "@/utils/readerMeasure";
import { FONT_SIZE_MIN, FONT_SIZE_MAX } from "@/constants/Quran";

describe("readerColumnWidth", () => {
  it("scales the column with the font size", () => {
    expect(readerColumnWidth(28, 1200)).toBe(28 * READER_MEASURE_EM);
  });

  it("keeps the measure proportional across the font-size range", () => {
    const small = readerColumnWidth(20, 4000);
    const large = readerColumnWidth(48, 4000);
    expect(large / small).toBeCloseTo(48 / 20);
  });

  it("never exceeds the container", () => {
    expect(readerColumnWidth(48, 390)).toBe(390);
  });

  it("uses the container when it is the smaller of the two", () => {
    expect(readerColumnWidth(28, 320)).toBe(320);
  });

  it("returns the container width for a zero font size rather than zero", () => {
    expect(readerColumnWidth(0, 390)).toBe(390);
  });
});

describe("pinchFontSize", () => {
  it("keeps the size unchanged at a scale of 1", () => {
    expect(pinchFontSize(28, 1)).toBe(28);
  });

  it("snaps to the 2pt step rather than returning fractions", () => {
    // 28 * 1.1 = 30.8, which rounds to the 30 step.
    expect(pinchFontSize(28, 1.1)).toBe(30);
  });

  it("grows when spread apart", () => {
    expect(pinchFontSize(28, 1.5)).toBeGreaterThan(28);
  });

  it("shrinks when pinched together", () => {
    expect(pinchFontSize(28, 0.5)).toBeLessThan(28);
  });

  it("clamps to the maximum however far it is spread", () => {
    expect(pinchFontSize(28, 100)).toBe(FONT_SIZE_MAX);
  });

  it("clamps to the minimum however far it is pinched", () => {
    expect(pinchFontSize(28, 0.001)).toBe(FONT_SIZE_MIN);
  });

  it("never returns a size outside the range for any scale", () => {
    for (const scale of [0, 0.1, 0.9, 1, 1.3, 4, 50]) {
      const result = pinchFontSize(28, scale);
      expect(result).toBeGreaterThanOrEqual(FONT_SIZE_MIN);
      expect(result).toBeLessThanOrEqual(FONT_SIZE_MAX);
    }
  });

  it("treats a non-finite scale as no change", () => {
    expect(pinchFontSize(28, Number.NaN)).toBe(28);
  });
});
