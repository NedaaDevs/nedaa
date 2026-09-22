import { readFileSync } from "fs";
import { join } from "path";

const frame = (name: string) => readFileSync(join(__dirname, `../${name}/index.tsx`), "utf8");

const FRAMES = ["hstack", "vstack", "box"];

/** Both axes name what they separate, so a screen never picks a number. */
const SPACING = ["tight", "inline", "stack", "group", "section"];

/**
 * Tamagui drops a prop whose name is in skipProps BEFORE it looks up variants, so
 * an axis named for a reserved prop compiles, reads correctly and never runs.
 * Read from the shipped list, which changes with the version. Parsed rather than
 * imported because `tamagui` ships ESM that jest cannot transform.
 */
const reserved = (): string[] => {
  const source = readFileSync(
    join(__dirname, "../../../../node_modules/@tamagui/web/dist/cjs/helpers/skipProps.native.js"),
    "utf8"
  );
  const block = source.match(/skipProps = \{([\s\S]*?)\n\}/);
  if (!block) throw new Error("skipProps not found");
  return [...block[1].matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
};

/** The variant group names, which sit one level above the steps. */
const axes = (name: string): string[] => {
  const block = frame(name).match(/variants: \{([\s\S]*?)\n  \} as const/);
  if (!block) throw new Error(`${name}: variants block not found`);
  return [...block[1].matchAll(/^ {4}(\w+): \{$/gm)].map((m) => m[1]);
};

describe("stack frames", () => {
  it("finds the reserved prop list", () => {
    expect(reserved()).toContain("space");
    expect(reserved().length).toBeGreaterThan(5);
  });

  it.each(FRAMES)("%s declares two axes", (name) => {
    expect(axes(name).sort()).toEqual(["inset", "spacing"]);
  });

  // The axis was named `space` and silently never ran.
  it.each(FRAMES)("%s names no axis Tamagui would drop", (name) => {
    const dropped = axes(name).filter((axis) => reserved().includes(axis));

    expect(dropped).toEqual([]);
  });

  it.each(FRAMES)("%s is a styled frame, not an alias", (name) => {
    expect(frame(name)).toMatch(/export const \w+ = styled\(/);
  });

  it.each(FRAMES)("%s maps every step on both axes", (name) => {
    const source = frame(name);

    for (const step of SPACING) {
      expect(source).toContain(`${step}: { gap: "$${step}" }`);
      expect(source).toContain(`${step}: { padding: "$${step}" }`);
    }
  });

  it.each(FRAMES)("%s spells its steps only in the vocabulary", (name) => {
    const steps = [...frame(name).matchAll(/^ {6}(\w+): \{ (?:gap|padding)/gm)].map((m) => m[1]);

    expect([...new Set(steps)].sort()).toEqual([...SPACING].sort());
  });
});
