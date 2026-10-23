import {
  BRIGHTNESS,
  COLOR_TOKENS,
  NEDAA_DARK,
  NEDAA_LIGHT,
  PHASE_GRADIENTS,
} from "@/constants/Palette";
import { mixOklch, oklchToHex } from "@/test-helpers/oklch";

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

  // A row tile carries an accent glyph; an icon, so the graphical bar.
  it.each(PALETTES)("$name accent glyph clears 3:1 on the row tile", ({ tokens }) => {
    expect(contrast(tokens.accent.hex, tokens.tile.hex)).toBeGreaterThanOrEqual(3);
  });

  // A filled number badge writes bg ink on an accent fill; text, so 4.5:1.
  it.each(PALETTES)("$name bg ink clears 4.5:1 on an accent fill", ({ tokens }) => {
    expect(contrast(tokens.bg.hex, tokens.accent.hex)).toBeGreaterThanOrEqual(4.5);
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

describe("premium surface tokens", () => {
  const NEW_TOKENS = {
    light: {
      hairline: "#081D3614",
      surfaceGlass: "#E7F9FFA8",
      surfaceFloat: "#E7F9FFD6",
      highlight: "#FFFFFF8C",
      accentGlow: "#0053722E",
    },
    dark: {
      hairline: "#DCEAF21A",
      surfaceGlass: "#0D23469E",
      surfaceFloat: "#071C3BD6",
      highlight: "#FFFFFF14",
      accentGlow: "#DBBB5629",
    },
  } as const;

  it.each(Object.entries(NEW_TOKENS.light))("light %s is %s", (token, hex) => {
    expect(NEDAA_LIGHT[token as keyof typeof NEDAA_LIGHT].hex).toBe(hex);
  });

  it.each(Object.entries(NEW_TOKENS.dark))("dark %s is %s", (token, hex) => {
    expect(NEDAA_DARK[token as keyof typeof NEDAA_DARK].hex).toBe(hex);
  });

  it.each(PALETTES)("$name bar is the surfaceFloat value", ({ tokens }) => {
    expect(tokens.bar).toEqual(tokens.surfaceFloat);
  });

  it("light surface2Soft is the surface2 value", () => {
    expect(NEDAA_LIGHT.surface2Soft).toEqual(NEDAA_LIGHT.surface2);
  });

  it("light surface2 runs at .60 alpha", () => {
    expect(NEDAA_LIGHT.surface2.oklch).toBe("oklch(95% 0.032 225 / .6)");
  });

  it.each([
    ["light", NEDAA_LIGHT, "#081D3612"],
    ["dark", NEDAA_DARK, "#DCEAF214"],
  ] as const)("%s pressed wash is %s", (_name, tokens, hex) => {
    expect(tokens.pressed.hex).toBe(hex);
  });
});

// A borderless pill and the segmented track are tints, not drawn lines.
describe("tint tokens", () => {
  it.each([
    ["light", NEDAA_LIGHT, "#0053721F", "#081D3612", "#9F6B1E24"],
    ["dark", NEDAA_DARK, "#DBBB561F", "#DCEAF212", "#D9AC5E24"],
  ] as const)(
    "%s tints the accent, the ink and the warn colour",
    (_n, tokens, accent, quiet, warn) => {
      expect(tokens.accentTint.hex).toBe(accent);
      expect(tokens.quietTint.hex).toBe(quiet);
      expect(tokens.warnTint.hex).toBe(warn);
    }
  );
});

describe("phase gradients", () => {
  const entries = Object.entries(PHASE_GRADIENTS).flatMap(([phase, byBrightness]) =>
    Object.entries(byBrightness)
      .filter(([, gradient]) => gradient !== null)
      .map(([brightness, gradient]) => [`${phase}/${brightness}`, brightness, gradient!] as const)
  );

  it.each(entries)("%s mixes to its stated hex", (_name, _brightness, gradient) => {
    expect(mixOklch(gradient.base.hex, gradient.tint, gradient.percent)).toBe(gradient.to);
  });

  it.each(entries)("%s starts from colours true to their oklch", (_name, _b, gradient) => {
    expect(oklchToHex(gradient.from.oklch)).toBe(gradient.from.hex);
    expect(oklchToHex(gradient.base.oklch)).toBe(gradient.base.hex);
  });

  it("declares both brightnesses for every phase", () => {
    for (const byBrightness of Object.values(PHASE_GRADIENTS)) {
      expect(Object.keys(byBrightness).sort()).toEqual(Object.values(BRIGHTNESS).sort());
    }
  });
});
