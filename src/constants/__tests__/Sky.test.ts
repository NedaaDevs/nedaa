import { NEDAA_LIGHT, type PaletteEntry } from "@/constants/Palette";
import { DARK_SKY, LIGHT_SKY } from "@/constants/Sky";
import { oklchToHex } from "@/test-helpers/oklch";

const isEntry = (value: unknown): value is PaletteEntry =>
  typeof value === "object" && value !== null && "oklch" in value && "hex" in value;

/** Every colour in a sky, labelled by where it sits. */
const colours = (node: unknown, path: string): [string, PaletteEntry][] => {
  if (isEntry(node)) return [[path, node]];
  if (typeof node !== "object" || node === null) return [];
  return Object.entries(node).flatMap(([key, child]) => colours(child, `${path}.${key}`));
};

const ALL = [...colours(LIGHT_SKY, "light"), ...colours(DARK_SKY, "dark")];

describe("sky", () => {
  it("reads every colour", () => {
    expect(ALL.length).toBeGreaterThan(15);
  });

  it.each(ALL)("%s converts from its oklch source", (_path, entry) => {
    expect(oklchToHex(entry.oklch)).toBe(entry.hex);
  });

  it.each([
    ["base", LIGHT_SKY.base],
    ["glow", LIGHT_SKY.glow.stops],
    ["horizon", LIGHT_SKY.horizon.stops],
    ["edge wash", LIGHT_SKY.edgeWash],
  ])("%s stops run forward within the gradient", (_name, stops) => {
    const offsets = stops.map((s) => s.offset);

    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    expect(Math.min(...offsets)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...offsets)).toBeLessThanOrEqual(1);
  });
});

/** Relative luminance, then the WCAG ratio. */
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Today's date and city sit straight on the sky, in the palette's text colour.
describe("day sky", () => {
  it.each(LIGHT_SKY.base.map((s) => [s.color.hex]))("keeps title text readable on %s", (hex) => {
    expect(contrast(NEDAA_LIGHT.fg.hex, hex)).toBeGreaterThanOrEqual(4.5);
  });
});
