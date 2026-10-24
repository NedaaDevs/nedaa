import { readFileSync } from "fs";
import { join } from "path";

import { COLOR_TOKENS, NEDAA_DARK, NEDAA_LIGHT } from "@/constants/Palette";

// Importing tamagui.config.ts runs createTamagui(), so the keys are read from source.
const source = () => readFileSync(join(__dirname, "../../../../tamagui.config.ts"), "utf8");

/** The createTokens call, so a font's `size` block is not mistaken for the scale. */
const tokensSource = (): string => {
  const block = source().match(/const tokens = createTokens\(\{([\s\S]*?)\n\}\);/);
  if (!block) throw new Error("createTokens call not found");
  return block[1];
};

const tokenBlock = (name: string): string => {
  const block = tokensSource().match(new RegExp(`\\n  ${name}: \\{([\\s\\S]*?)\\n  \\},`));
  if (!block) throw new Error(`${name} token block not found`);
  return block[1];
};

const blockKeys = (name: string): string[] =>
  [...tokenBlock(name).matchAll(/^\s{4}"?([a-zA-Z0-9.]+)"?:/gm)].map((m) => m[1]);

const themeBlock = (name: string): string => {
  const block = source().match(new RegExp(`\\nconst ${name} = \\{([\\s\\S]*?)\\n\\};`));
  if (!block) throw new Error(`${name} not found`);
  return block[1];
};

const themeKeys = (name: string): string[] =>
  [...themeBlock(name).matchAll(/^\s{2}([a-zA-Z0-9]+):/gm)].map((m) => m[1]);

const THEMES = ["lightTheme", "darkTheme"];

const PALETTE_BY_THEME = { lightTheme: NEDAA_LIGHT, darkTheme: NEDAA_DARK } as const;

describe("theme keys", () => {
  // Without a floor on each scale, a reformat that breaks a regex passes vacuously.
  it.each([
    ["color", 50],
    ["size", 22],
    ["space", 19],
    ["radius", 15],
  ])("finds the %s block", (name, least) => {
    expect(blockKeys(name).length).toBeGreaterThan(least);
  });

  it.each(THEMES)("finds %s", (theme) => {
    expect(themeKeys(theme).length).toBeGreaterThan(30);
  });

  /**
   * createTamagui spreads every colour token into every theme, and the theme
   * lookup runs for each style prop. A theme key sharing a token's name captures
   * props that were never meant for it.
   */
  it.each(THEMES)("%s shares no name with a colour token", (theme) => {
    const tokens = new Set(blockKeys("color"));
    const collisions = themeKeys(theme).filter((key) => tokens.has(key));

    expect(collisions).toEqual([]);
  });

  // A repeated key silently wins on the later line, so the earlier value vanishes.
  it.each(THEMES)("%s declares each key once", (theme) => {
    const seen = new Set<string>();
    const repeated = themeKeys(theme).filter((key) => !seen.add(key));

    expect(repeated).toEqual([]);
  });

  // The config copies each palette entry by hand, so a token added to Palette.ts
  // and missed here would resolve to nothing at runtime.
  it.each(THEMES)("%s carries every palette token, from its own palette", (theme) => {
    const keys = new Set(themeKeys(theme));
    const missing = COLOR_TOKENS.filter((token) => !keys.has(token));
    const palette = PALETTE_BY_THEME[theme as keyof typeof PALETTE_BY_THEME];
    const own = palette === NEDAA_LIGHT ? "NEDAA_LIGHT" : "NEDAA_DARK";
    const wired = [
      ...themeBlock(theme).matchAll(/^\s{2}(\w+): (NEDAA_LIGHT|NEDAA_DARK)\.(\w+)\.hex,/gm),
    ];

    expect(missing).toEqual([]);
    expect(wired.length).toBeGreaterThan(30);
    expect(wired.filter(([, key, from, token]) => from !== own || key !== token)).toEqual([]);
  });

  // `size` and `space` resolve by the same lookup, so a theme key named for one
  // of their steps would answer a width or a padding.
  it.each(THEMES)("%s shares no name with a size or space step", (theme) => {
    const scales = new Set([...blockKeys("size"), ...blockKeys("space"), ...blockKeys("radius")]);
    const collisions = themeKeys(theme).filter((key) => scales.has(key));

    expect(collisions).toEqual([]);
  });
});

/** Touch targets, so a screen names the intent instead of repeating 44. */
const TARGETS = { target: 44, targetTab: 50 } as const;

describe("touch target tokens", () => {
  it.each(Object.entries(TARGETS))("$%s is %ipx", (name, px) => {
    expect(tokenBlock("size")).toMatch(new RegExp(`\\b${name}: ${px},`));
  });

  // CLAUDE.md's checklist requires 44pt; a target below it would pass unnoticed.
  it("keeps every target at or above the platform floor", () => {
    for (const px of Object.values(TARGETS)) expect(px).toBeGreaterThanOrEqual(44);
  });
});

/** The intents a stack or a screen chooses between, by what the gap separates. */
const SPACING = {
  tight: 4,
  inline: 8,
  stack: 12,
  group: 16,
  section: 24,
  screen: 20,
  cardPad: 16,
  heroGap: 22,
} as const;

describe("spacing vocabulary", () => {
  it.each(Object.entries(SPACING))("$%s is %ipx", (name, px) => {
    expect(tokenBlock("space")).toMatch(new RegExp(`\\b${name}: ${px},`));
  });

  // A new name is a design decision, so it fails here first.
  it("carries no intent beyond the eight", () => {
    const named = blockKeys("space").filter((k) => !/^-?\d/.test(k) && k !== "true");

    expect(named.sort()).toEqual(Object.keys(SPACING).sort());
  });

  // Space and radius resolve through one lookup, so a shared name is ambiguous.
  it("shares no name with a radius step", () => {
    const radius = new Set(blockKeys("radius"));

    expect(Object.keys(SPACING).filter((name) => radius.has(name))).toEqual([]);
  });
});
