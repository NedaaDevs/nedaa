import { progressPercent } from "@/components/ui/progress/sizing";

describe("progressPercent", () => {
  // The nine existing callers pass a raw percentage against the default range.
  it("passes a 0-100 value straight through", () => {
    expect(progressPercent(37, 0, 100)).toBe(37);
  });

  it("maps a value to its position in the range", () => {
    expect(progressPercent(3, 0, 7)).toBeCloseTo(42.857, 3);
    expect(progressPercent(15, 10, 20)).toBe(50);
  });

  it("clamps outside the range", () => {
    expect(progressPercent(-5, 0, 100)).toBe(0);
    expect(progressPercent(120, 0, 100)).toBe(100);
  });

  it("yields nothing rather than NaN for an empty or inverted range", () => {
    expect(progressPercent(5, 10, 10)).toBe(0);
    expect(progressPercent(5, 20, 10)).toBe(0);
    expect(progressPercent(NaN, 0, 100)).toBe(0);
  });
});
