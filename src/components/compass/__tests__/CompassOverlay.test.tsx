import React from "react";
import renderer, { act } from "react-test-renderer";

import { CompassOverlay } from "@/components/compass/CompassOverlay";

jest.mock("moti", () => {
  const { View } = jest.requireActual("react-native");
  return { MotiView: View };
});
jest.mock("lucide-react-native", () => ({ Smartphone: "Smartphone" }));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/components/ui/icon", () => ({ Icon: () => null }));
jest.mock("@/components/ui/text", () => {
  const { Text } = jest.requireActual("react-native");
  return { Text };
});
jest.mock("@/components/ui/vstack", () => {
  const { View } = jest.requireActual("react-native");
  return { VStack: View };
});

const renderOverlay = (variant: "holdFlat" | "calibrate") => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<CompassOverlay variant={variant} reduceMotion />);
  });
  return tree;
};

const hasText = (tree: renderer.ReactTestRenderer, text: string) =>
  tree.root.findAll((node) => node.props.children === text).length > 0;

describe("CompassOverlay", () => {
  it("shows the hold-flat hint", () => {
    const tree = renderOverlay("holdFlat");
    expect(hasText(tree, "compass.holdFlat")).toBe(true);
    expect(hasText(tree, "compass.calibrationNote")).toBe(false);
    act(() => tree.unmount());
  });

  it("shows the calibrate title and figure-8 instruction", () => {
    const tree = renderOverlay("calibrate");
    expect(hasText(tree, "compass.issue.sensor_uncalibrated.title")).toBe(true);
    expect(hasText(tree, "compass.calibrationNote")).toBe(true);
    act(() => tree.unmount());
  });
});
