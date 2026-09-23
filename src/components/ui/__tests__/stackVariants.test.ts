import { readFileSync } from "fs";
import { join } from "path";
import { stylePropsAll } from "@tamagui/helpers";
import { View, XStack, YStack } from "tamagui";

import config from "../../../../tamagui.config";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";

/**
 * Props Tamagui drops before it looks up variants. The package's export map hides
 * the module, so the shipped file is read; the floor test below catches a miss.
 */
const skipProps = (): string[] => {
  const source = readFileSync(
    join(__dirname, "../../../../node_modules/@tamagui/web/dist/cjs/helpers/skipProps.native.js"),
    "utf8"
  );
  const block = source.match(/skipProps = \{([\s\S]*?)\n\}/);
  if (!block) throw new Error("skipProps not found");
  return [...block[1].matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
};

const FRAMES = [
  ["HStack", HStack, XStack],
  ["VStack", VStack, YStack],
  ["Box", Box, View],
] as const;

const variantsOf = (frame: { staticConfig: { variants?: Record<string, object> } }) =>
  frame.staticConfig.variants ?? {};

/** The axes a frame adds, without the ones it inherits. */
const ownAxes = (frame: (typeof FRAMES)[number][1], parent: (typeof FRAMES)[number][2]) =>
  Object.keys(variantsOf(frame)).filter((axis) => !(axis in variantsOf(parent)));

/** Every name Tamagui already reads as a prop: a variant under one of these never runs. */
const TAKEN = [...skipProps(), ...Object.keys(stylePropsAll), ...Object.keys(config.shorthands)];

describe("stack frames", () => {
  it("finds the names Tamagui reads", () => {
    expect(TAKEN).toEqual(expect.arrayContaining(["space", "inset", "p"]));
  });

  it.each(FRAMES)("%s adds a gap axis and a padding axis", (_, frame, parent) => {
    expect(ownAxes(frame, parent).sort()).toEqual(["pad", "spacing"]);
  });

  // `space` and then `inset` compiled, read correctly, and never ran.
  it.each(FRAMES)("%s names no axis Tamagui would take", (_, frame, parent) => {
    expect(ownAxes(frame, parent).filter((axis) => TAKEN.includes(axis))).toEqual([]);
  });

  it.each(FRAMES)("%s sets each step's own space token", (_, frame) => {
    const { spacing, pad } = variantsOf(frame) as Record<string, Record<string, object>>;

    for (const step of Object.keys(spacing)) {
      expect(config.tokens.space).toHaveProperty(step);
      expect(spacing[step]).toEqual({ gap: `$${step}` });
      expect(pad[step]).toEqual({ padding: `$${step}` });
    }
  });

  it("gives all three frames one vocabulary of at least five steps", () => {
    const vocabularies = FRAMES.map(([, frame]) =>
      Object.keys((variantsOf(frame) as Record<string, object>).spacing).sort()
    );

    expect(vocabularies[0].length).toBeGreaterThanOrEqual(5);
    expect(new Set(vocabularies.map((steps) => steps.join()))).toEqual(
      new Set([vocabularies[0].join()])
    );
  });
});
