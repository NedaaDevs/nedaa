import type { PaletteEntry } from "@/constants/Palette";
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
    ["sun", LIGHT_SKY.sun.stops],
    ["edge wash", LIGHT_SKY.edgeWash],
  ])("%s stops run forward within the gradient", (_name, stops) => {
    const offsets = stops.map((s) => s.offset);

    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    expect(Math.min(...offsets)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...offsets)).toBeLessThanOrEqual(1);
  });
});
