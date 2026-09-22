import { oklchToHex, parseOklch } from "@/test-helpers/oklch";

describe("parseOklch", () => {
  it("reads lightness, chroma and hue", () => {
    expect(parseOklch("oklch(45% 0.09 232)")).toEqual({ l: 0.45, c: 0.09, h: 232, alpha: 1 });
  });

  it("reads the slash alpha, whole and fractional", () => {
    expect(parseOklch("oklch(98.5% 0.012 235 / .72)").alpha).toBeCloseTo(0.72, 5);
    expect(parseOklch("oklch(23% 0.065 258 / 0.5)").alpha).toBeCloseTo(0.5, 5);
  });

  it("rejects anything it cannot read rather than guessing", () => {
    expect(() => parseOklch("rgb(1 2 3)")).toThrow(/oklch/i);
  });
});

describe("oklchToHex", () => {
  // The light accent sits inside sRGB.
  it("converts an in-gamut colour exactly", () => {
    expect(oklchToHex("oklch(45% 0.09 232)")).toBe("#055D7E");
  });

  // Chroma far beyond sRGB: reducing it holds the hue, clamping channels moves it.
  it("gamut-maps by reducing chroma, not by clamping channels", () => {
    const mapped = oklchToHex("oklch(45% 0.4 232)");
    const clamped = "#0060FF";

    expect(mapped).not.toBe(clamped);
    expect(mapped).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("round-trips an in-gamut colour", () => {
    // No chroma, so every channel is equal.
    const hex = oklchToHex("oklch(50% 0 0)");
    expect(hex).toMatch(/^#([0-9A-F]{2})\1\1$/);
  });

  it("emits 8-digit hex when the colour carries alpha", () => {
    expect(oklchToHex("oklch(98.5% 0.012 235 / .72)")).toMatch(/^#[0-9A-F]{8}$/);
  });

  it("clamps black and white to the ends of the range", () => {
    expect(oklchToHex("oklch(0% 0 0)")).toBe("#000000");
    expect(oklchToHex("oklch(100% 0 0)")).toBe("#FFFFFF");
  });
});
