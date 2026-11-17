import { hexAlpha } from "@/utils/hexAlpha";

describe("hexAlpha", () => {
  it("writes a colour at an alpha as #RRGGBBAA", () => {
    expect(hexAlpha("#FFFFFF", 0.5)).toBe("#FFFFFF80");
    expect(hexAlpha("#DBBB56", 1)).toBe("#DBBB56FF");
    expect(hexAlpha("#DBBB56", 0)).toBe("#DBBB5600");
  });

  it("replaces an alpha the colour already has", () => {
    expect(hexAlpha("#FFFFFFCC", 0.3)).toBe("#FFFFFF4D");
  });
});
