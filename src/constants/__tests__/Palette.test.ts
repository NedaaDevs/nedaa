import { NEDAA_DARK, NEDAA_LIGHT, COLOR_TOKENS } from "@/constants/Palette";
import { oklchToHex } from "@/test-helpers/oklch";

/** Each palette carries the least forgiving surface its tokens sit on. */
const PALETTES = [
  { name: "light", tokens: NEDAA_LIGHT, worstSurface: NEDAA_LIGHT.bg.hex },
  { name: "dark", tokens: NEDAA_DARK, worstSurface: NEDAA_DARK.surface2.hex },
] as const;

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

describe("palette", () => {
  describe.each(PALETTES)("$name", ({ tokens }) => {
    it.each(Object.entries(tokens))("%s converts from its oklch source", (_token, entry) => {
      expect(oklchToHex(entry.oklch)).toBe(entry.hex);
    });

    it("declares every token, so neither palette silently inherits", () => {
      expect(Object.keys(tokens).sort()).toEqual([...COLOR_TOKENS].sort());
    });
  });

  // 4.5:1 for text, 3:1 for a graphical object. `warn` is icon-only in the design.
  const MINIMUM: Record<string, number> = {
    fg: 4.5,
    muted: 4.5,
    accent: 4.5,
    danger: 4.5,
    success: 4.5,
    warn: 3,
  };

  describe.each(PALETTES)("$name contrast", ({ tokens, worstSurface }) => {
    it.each(Object.keys(MINIMUM))("%s clears its bar", (token) => {
      const hex = tokens[token as keyof typeof tokens].hex;

      expect(contrast(hex, worstSurface)).toBeGreaterThanOrEqual(MINIMUM[token]);
    });
  });

  it("keeps alpha tokens at 8 digits and the rest at 6", () => {
    for (const { tokens } of PALETTES) {
      for (const [token, entry] of Object.entries(tokens)) {
        const digits = entry.oklch.includes("/") ? 9 : 7;
        expect(`${token}:${entry.hex.length}`).toBe(`${token}:${digits}`);
      }
    }
  });
});
