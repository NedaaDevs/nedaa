import { readerColumnWidth, READER_MEASURE_EM } from "@/utils/readerMeasure";

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
