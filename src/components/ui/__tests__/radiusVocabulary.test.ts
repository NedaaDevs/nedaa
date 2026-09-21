import { readFileSync } from "fs";
import { join } from "path";

// tamagui.config.ts sits outside the jest roots, so the vocabulary is read from the
// source rather than imported. Whether Tamagui accepts these keys is a type question
// and tsc answers it; this guards the values from drifting.
const radiusBlock = (): string => {
  const source = readFileSync(join(__dirname, "../../../../tamagui.config.ts"), "utf8");
  const match = source.match(/\n {2}radius: \{([\s\S]*?)\n {2}\},/);
  if (!match) throw new Error("radius token block not found in tamagui.config.ts");
  return match[1];
};

const entries = (): Record<string, number> =>
  Object.fromEntries(
    [...radiusBlock().matchAll(/^\s*([a-zA-Z0-9]+):\s*(\d+),/gm)].map((m) => [m[1], Number(m[2])])
  );

// The five intents a screen chooses between. A sixth name is a design decision, not a
// styling one, so it fails here first.
const VOCABULARY = { chip: 8, control: 12, card: 16, sheet: 18, pill: 999 } as const;

describe("radius vocabulary", () => {
  it.each(Object.entries(VOCABULARY))("%s is %ipx", (name, value) => {
    expect(entries()[name]).toBe(value);
  });

  it("carries no intent beyond the five", () => {
    const named = Object.keys(entries()).filter((k) => !/^\d+$/.test(k) && k !== "true");

    expect(named.sort()).toEqual(Object.keys(VOCABULARY).sort());
  });

  // The numeric steps stay while 157 call sites still use them; removing one is a
  // codemod, not an edit.
  it("keeps the numeric scale intact", () => {
    const scale = entries();

    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => scale[n])).toEqual([
      0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 999,
    ]);
  });
});
