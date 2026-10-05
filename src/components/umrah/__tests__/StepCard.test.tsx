import React from "react";
import { AccessibilityInfo, StyleSheet, Text as RNText, View } from "react-native";
import renderer, { act } from "react-test-renderer";

import StepCard from "@/components/umrah/StepCard";
import { UMRAH_STAGES } from "@/constants/UmrahGuide";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/stores/app", () => ({ useAppStore: () => ({ locale: "ar" }) }));
jest.mock("@/stores/umrahGuide", () => ({
  useUmrahGuideStore: () => ({ hasSeenFlipHint: true }),
}));
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => async () => {} }));
jest.mock("@/utils/number", () => ({ formatNumberToLocale: (value: string) => value }));
jest.mock("@/components/umrah/FlipHint", () => () => null);
jest.mock("@/components/umrah/HadithReference", () => () => null);
jest.mock("react-native-reanimated", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: { View },
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    useSharedValue: (value: number) => require("react").useRef({ value }).current,
    useAnimatedStyle: () => ({}),
    withTiming: (value: number) => value,
  };
});
jest.mock("@/components/ui/box", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return { Box: require("react-native").View };
});
jest.mock("@/components/ui/card", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return { Card: require("react-native").View };
});
jest.mock("@/components/ui/vstack", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return { VStack: require("react-native").View };
});
jest.mock("@/components/ui/hstack", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return { HStack: require("react-native").View };
});
jest.mock("@/components/ui/pressable", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return { Pressable: require("react-native").View };
});
jest.mock("@/components/ui/text", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return { Text: require("react-native").Text };
});
jest.mock("@/components/ui/icon", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return { Icon: require("react-native").View };
});

describe("Umrah dua card layout", () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(["tawaf-start", "tawaf-lap-1"])(
    "%s gives the visible face natural height and the Arabic text the card width",
    async (id) => {
      const step = UMRAH_STAGES.flatMap((stage) => stage.steps).find((step) => step.id === id)!;
      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(<StepCard step={step} />);
      });

      const arabic = tree.root
        .findAllByType(RNText)
        .find((text) => text.props.children === step.dua!.arabic)!;
      expect(arabic.props.width).toBe("100%");
      expect(arabic.props.numberOfLines).toBeUndefined();
      let faces = tree.root
        .findAllByType(View)
        .filter((view) => view.props.importantForAccessibility);
      expect(StyleSheet.flatten(faces[0].props.style).position).toBe("relative");
      expect(faces[1].props.accessibilityElementsHidden).toBe(true);

      await act(async () => {
        await tree.root
          .findAllByType(View)
          .find((view) => view.props.accessibilityState?.expanded === false)!
          .props.onPress();
      });
      faces = tree.root.findAllByType(View).filter((view) => view.props.importantForAccessibility);
      expect(StyleSheet.flatten(faces[1].props.style).position).toBe("relative");
      expect(faces[0].props.accessibilityElementsHidden).toBe(true);

      const nextStep = UMRAH_STAGES.flatMap((stage) => stage.steps).find(
        (step) => step.id === "tawaf-lap-2"
      )!;
      await act(async () => {
        tree.update(<StepCard step={nextStep} />);
      });
      faces = tree.root.findAllByType(View).filter((view) => view.props.importantForAccessibility);
      expect(StyleSheet.flatten(faces[0].props.style).position).toBe("relative");
      expect(faces[0].props.accessibilityElementsHidden).toBe(false);
      expect(faces[1].props.accessibilityElementsHidden).toBe(true);
      expect(
        tree.root
          .findAllByType(View)
          .some((view) => view.props.accessibilityState?.expanded === false)
      ).toBe(true);
      act(() => tree.unmount());
    }
  );
});
