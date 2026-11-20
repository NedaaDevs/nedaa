import { SUBHA_BEAD_INK } from "@/constants/AthkarSubha";
import { BRIGHTNESS } from "@/constants/Palette";
import { oklchToHex } from "@/test-helpers/oklch";

const inks = Object.entries(SUBHA_BEAD_INK).flatMap(([brightness, ink]) =>
  Object.entries(ink).map(([stop, entry]) => [`${brightness} ${stop}`, entry] as const)
);

describe("SUBHA_BEAD_INK", () => {
  it.each(inks)("%s converts from its oklch source", (_name, entry) => {
    expect(oklchToHex(entry.oklch)).toBe(entry.hex);
  });

  it("colours a bead in both brightnesses", () => {
    expect(Object.keys(SUBHA_BEAD_INK).sort()).toEqual(Object.values(BRIGHTNESS).sort());
  });
});
