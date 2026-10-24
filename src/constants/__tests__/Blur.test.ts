import { BLUR, BLUR_INTENSITY, BLUR_REDUCTION, type BlurLevel } from "@/constants/Blur";

describe("blur", () => {
  it("steps 24, 28 and 40", () => {
    expect(BLUR).toEqual({ REST: 24, FLOAT: 28, SHEET: 40 });
  });
});

describe("blur intensity", () => {
  it.each(Object.keys(BLUR) as BlurLevel[])(
    "gives %s its blur points as an Android radius",
    (level) => {
      expect(BLUR_INTENSITY[level] / BLUR_REDUCTION).toBeCloseTo(BLUR[level]);
    }
  );

  it.each(Object.keys(BLUR) as BlurLevel[])("keeps %s within expo-blur's 1 to 100", (level) => {
    expect(BLUR_INTENSITY[level]).toBeGreaterThanOrEqual(1);
    expect(BLUR_INTENSITY[level]).toBeLessThanOrEqual(100);
  });
});
