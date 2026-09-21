import React from "react";
import renderer, { act } from "react-test-renderer";

import { CompassDial } from "@/components/compass/CompassDial";

jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: { View },
    // A shared value is a box with a getter and a setter; the setter accepts an updater.
    useSharedValue: (value: unknown) => {
      const sv = {
        value,
        get: () => sv.value,
        set: (next: unknown) => {
          sv.value = typeof next === "function" ? next(sv.value) : next;
        },
      };
      return sv;
    },
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

// The host component react-native-svg renders a <G> as. react-test-renderer
// types a node's `type` as ElementType, which does not admit a host string.
const SVG_GROUP = "RNSVGGroup" as unknown as React.ElementType;

const baseProps = {
  heading: 0,
  qiblaDirection: 150,
  proximityState: "searching" as const,
  reduceMotion: true,
  accessibilityLabel: "dial",
  translateDirection: (key: string) => key,
};

// react-native-svg composes every transform prop into a single `matrix` prop on
// the native element (extractProps). Reading it back is the drawing itself, as
// six numbers, so a change in transform syntax or in the library's composition
// order fails here instead of silently moving the Kaaba marker on screen.
const markerMatrices = (heading: number) => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<CompassDial {...baseProps} heading={heading} />);
  });
  const marker = tree.root.findAll(
    (node) => node.type === SVG_GROUP && node.props?.testID === "kaaba-ring-marker"
  )[0];
  // Outer group first, then the counter-rotating inner group.
  const matrices = marker
    .findAllByType(SVG_GROUP)
    .map((node) => node.props?.matrix as number[] | undefined)
    .filter((matrix): matrix is number[] => Array.isArray(matrix))
    // `+ 0` folds the -0 that Math.sin/Math.cos produce at the axes onto 0.
    .map((matrix) => matrix.map((value) => value + 0));
  act(() => tree.unmount());
  return matrices;
};

// [a, b, c, d, tx, ty], column-major. The outer group only positions the marker
// on the ring, so it is heading-independent. The inner group carries the
// counter-rotation and the 0.6 scale about the glyph centre.
const EXPECTED: Record<number, number[][]> = {
  0: [
    [1, 0, 0, 1, 188.2, 227.26279441628827],
    [0.6, 0, 0, 0.6, 6.720000000000001, 7.200000000000001],
  ],
  123: [
    [1, 0, 0, 1, 188.2, 227.26279441628827],
    [
      -0.32678342100901625, 0.5032023407672545, -0.5032023407672545, -0.32678342100901625,
      31.347603606762053, 15.428302253272417,
    ],
  ],
  359: [
    [1, 0, 0, 1, 188.2, 227.26279441628827],
    [
      0.5999086170938347, -0.010471443862370136, 0.010471443862370136, 0.5999086170938347,
      6.533049243300914, 7.377565149198794,
    ],
  ],
};

describe("CompassDial ring-marker transform", () => {
  it.each([0, 123, 359])("composes the same matrix at heading %i", (heading) => {
    const actual = markerMatrices(heading);
    const expected = EXPECTED[heading];
    expect(actual).toHaveLength(expected.length);
    actual.forEach((matrix, group) => {
      expect(matrix).toHaveLength(6);
      matrix.forEach((value, term) => {
        expect([group, term, value]).toEqual([
          group,
          term,
          expect.closeTo(expected[group][term], 9),
        ]);
      });
    });
  });
});
