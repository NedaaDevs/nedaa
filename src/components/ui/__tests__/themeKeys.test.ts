import { readFileSync } from "fs";
import { join } from "path";

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
  [...tokenBlock(name).matchAll(/^\s{4}"?([a-zA-Z0-9]+)"?:/gm)].map((m) => m[1]);

const themeKeys = (name: string): string[] => {
  const block = source().match(new RegExp(`\\nconst ${name} = \\{([\\s\\S]*?)\\n\\};`));
  if (!block) throw new Error(`${name} not found`);
  return [...block[1].matchAll(/^\s{2}([a-zA-Z0-9]+):/gm)].map((m) => m[1]);
};

const THEMES = ["lightTheme", "darkTheme"];

describe("theme keys", () => {
  it("finds the blocks it compares", () => {
    expect(blockKeys("color").length).toBeGreaterThan(40);
    for (const theme of THEMES) expect(themeKeys(theme).length).toBeGreaterThan(30);
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

  // `size` and `space` resolve by the same lookup, so a theme key named for one
  // of their steps would answer a width or a padding.
  it.each(THEMES)("%s shares no name with a size or space step", (theme) => {
    const scales = new Set([...blockKeys("space"), ...blockKeys("radius")]);
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
