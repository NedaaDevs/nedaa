import { readFileSync } from "fs";
import { join } from "path";

const frame = (name: string) => readFileSync(join(__dirname, `../${name}/index.tsx`), "utf8");

const FRAMES = ["hstack", "vstack", "box"];

/** Both axes name what they separate, so a screen never picks a number. */
const SPACING = ["tight", "inline", "stack", "group", "section"];

describe("stack frames", () => {
  // A bare re-export makes any import rule enforce a spelling, not a component.
  it.each(FRAMES)("%s is a styled frame, not an alias", (name) => {
    expect(frame(name)).toMatch(/export const \w+ = styled\(/);
  });

  it.each(FRAMES)("%s offers every spacing on both axes", (name) => {
    const source = frame(name);

    for (const step of SPACING) {
      expect(source).toContain(`${step}: { gap: "$${step}" }`);
      expect(source).toContain(`${step}: { padding: "$${step}" }`);
    }
  });

  it.each(FRAMES)("%s spells its variants only in the vocabulary", (name) => {
    const named = [...frame(name).matchAll(/^\s{6}(\w+): \{ (?:gap|padding)/gm)].map((m) => m[1]);

    expect([...new Set(named)].sort()).toEqual([...SPACING].sort());
  });
});
