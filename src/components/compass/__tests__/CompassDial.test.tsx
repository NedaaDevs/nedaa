import React from "react";
import { render, screen } from "@testing-library/react-native";

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
jest.mock("@/components/ui/theme-color", () => ({
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
  fontFamily: "IBMPlexSansArabic-Regular",
};

const renderDial = (props: Partial<React.ComponentProps<typeof CompassDial>> = {}) =>
  render(<CompassDial {...baseProps} {...props} />);

// The dial face is hidden from accessibility; queries include hidden nodes.
const hasTestID = (testID: string) =>
  screen.queryAllByTestId(testID, { includeHiddenElements: true }).length > 0;

describe("CompassDial", () => {
  it("renders the Kaaba ring marker when a qibla direction exists", async () => {
    await renderDial();
    expect(hasTestID("kaaba-ring-marker")).toBe(true);
  });

  it("hides qibla visuals in compass-only fallback", async () => {
    await renderDial({ qiblaDirection: null });
    expect(hasTestID("kaaba-ring-marker")).toBe(false);
    expect(hasTestID("kaaba-hero")).toBe(false);
  });

  it("shows the hero Kaaba and path line only when aligned", async () => {
    await renderDial();
    expect(hasTestID("kaaba-hero")).toBe(false);
    expect(hasTestID("qibla-path-line")).toBe(false);

    await screen.rerender(<CompassDial {...baseProps} heading={150} proximityState="aligned" />);
    expect(hasTestID("kaaba-hero")).toBe(true);
    expect(hasTestID("qibla-path-line")).toBe(true);
    expect(hasTestID("kaaba-ring-marker")).toBe(false);
  });
});
