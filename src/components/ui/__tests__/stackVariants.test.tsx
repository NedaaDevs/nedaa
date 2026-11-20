import { screen } from "@testing-library/react-native";
import { stylePropsAll } from "@tamagui/helpers";
import { View, XStack, YStack } from "tamagui";

import config from "../../../../tamagui.config";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { renderWithTheme } from "@/test-helpers/theme";

const FRAMES = [
  ["HStack", HStack, XStack],
  ["VStack", VStack, YStack],
  ["Box", Box, View],
] as const;

type Frame = (typeof FRAMES)[number][1];

const variantsOf = (frame: { staticConfig: { variants?: Record<string, object> } }) =>
  frame.staticConfig.variants ?? {};

/** The axes a frame adds, without the ones it inherits. */
const ownAxes = (frame: Frame, parent: (typeof FRAMES)[number][2]) =>
  Object.keys(variantsOf(frame)).filter((axis) => !(axis in variantsOf(parent)));

const stepsOf = (frame: Frame) => Object.keys(variantsOf(frame).spacing ?? {});

const spaceToken = (step: string) =>
  config.tokens.space[step as keyof typeof config.tokens.space].val;

describe("stack frames", () => {
  it.each(FRAMES)("%s adds a gap axis and a padding axis", (_, frame, parent) => {
    expect(ownAxes(frame, parent).sort()).toEqual(["pad", "spacing"]);
  });

  it.each(FRAMES)("%s names no axis after a style prop or a shorthand", (_, frame, parent) => {
    const taken = [...Object.keys(stylePropsAll), ...Object.keys(config.shorthands)];

    expect(ownAxes(frame, parent).filter((axis) => taken.includes(axis))).toEqual([]);
  });

  // A variant Tamagui drops before its lookup compiles and never runs; only a render shows it.
  describe.each(FRAMES)("%s", (_, frame) => {
    it("has at least five steps", () => {
      expect(stepsOf(frame).length).toBeGreaterThanOrEqual(5);
    });

    it.each(stepsOf(frame))("puts the %s token on the view", async (step) => {
      const Frame = frame;
      await renderWithTheme(<Frame testID="frame" spacing={step as never} pad={step as never} />);

      expect(screen.getByTestId("frame")).toHaveStyle({
        gap: spaceToken(step),
        paddingTop: spaceToken(step),
        paddingRight: spaceToken(step),
        paddingBottom: spaceToken(step),
        paddingLeft: spaceToken(step),
      });
    });
  });

  it("gives all three frames one vocabulary", () => {
    const vocabularies = FRAMES.map(([, frame]) => stepsOf(frame).sort().join());

    expect(new Set(vocabularies).size).toBe(1);
  });
});
