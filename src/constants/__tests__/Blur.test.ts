import { BLUR, BLUR_INTENSITY } from "@/constants/Blur";

describe("blur", () => {
  it("steps 28 and 40", () => {
    expect(BLUR).toEqual({ FLOAT: 28, SHEET: 40 });
  });
});

describe("blur intensity", () => {
  it.each(Object.entries(BLUR_INTENSITY))(
    "keeps %s within expo-blur's 1 to 100",
    (_, intensity) => {
      expect(intensity).toBeGreaterThanOrEqual(1);
      expect(intensity).toBeLessThanOrEqual(100);
    }
  );
});
