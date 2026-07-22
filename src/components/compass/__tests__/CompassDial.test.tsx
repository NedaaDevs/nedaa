import React from "react";
import renderer, { act } from "react-test-renderer";

import { CompassDial } from "@/components/compass/CompassDial";

jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (value: unknown) => ({ value }),
    useAnimatedStyle: () => ({}),
    withSpring: (value: unknown) => value,
    withTiming: (value: unknown) => value,
  };
});
jest.mock("moti", () => {
  const { View } = jest.requireActual("react-native");
  return { MotiView: View };
});
jest.mock("tamagui", () => ({
  useTheme: () => new Proxy({}, { get: () => ({ val: "#123456" }) }),
}));
jest.mock("@/components/ui/box", () => {
  const { View } = jest.requireActual("react-native");
  return { Box: View };
});

const baseProps = {
  heading: 100,
  qiblaDirection: 150,
  proximityState: "searching" as const,
  reduceMotion: true,
  accessibilityLabel: "dial",
  translateDirection: (key: string) => key,
};

const renderDial = (props: Partial<React.ComponentProps<typeof CompassDial>> = {}) => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<CompassDial {...baseProps} {...props} />);
  });
  return tree;
};

const findByTestID = (tree: renderer.ReactTestRenderer, testID: string) =>
  tree.root.findAllByProps({ testID }).length > 0;

describe("CompassDial", () => {
  it("renders the Kaaba ring marker when a qibla direction exists", () => {
    const tree = renderDial();
    expect(findByTestID(tree, "kaaba-ring-marker")).toBe(true);
    act(() => tree.unmount());
  });

  it("hides qibla visuals in compass-only fallback", () => {
    const tree = renderDial({ qiblaDirection: null });
    expect(findByTestID(tree, "kaaba-ring-marker")).toBe(false);
    expect(findByTestID(tree, "kaaba-hero")).toBe(false);
    act(() => tree.unmount());
  });

  it("shows the hero Kaaba and path line only when aligned", () => {
    const tree = renderDial();
    expect(findByTestID(tree, "kaaba-hero")).toBe(false);
    expect(findByTestID(tree, "qibla-path-line")).toBe(false);

    act(() => {
      tree.update(<CompassDial {...baseProps} heading={150} proximityState="aligned" />);
    });
    expect(findByTestID(tree, "kaaba-hero")).toBe(true);
    expect(findByTestID(tree, "qibla-path-line")).toBe(true);
    expect(findByTestID(tree, "kaaba-ring-marker")).toBe(false);
    act(() => tree.unmount());
  });
});
