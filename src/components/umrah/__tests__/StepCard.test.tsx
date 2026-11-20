import React from "react";
import { AccessibilityInfo, StyleSheet } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";

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
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
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

/** The card's two faces: the only views that set importantForAccessibility. */
const faces = () =>
  screen.container.queryAll((node) => Boolean(node.props.importantForAccessibility));

const collapsedToggles = () =>
  screen.container.queryAll((node) => node.props.accessibilityState?.expanded === false);

describe("Umrah dua card layout", () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(["tawaf-start", "tawaf-lap-1"])(
    "%s gives the visible face natural height and the Arabic text the card width",
    async (id) => {
      const step = UMRAH_STAGES.flatMap((stage) => stage.steps).find((step) => step.id === id)!;
      await render(<StepCard step={step} />);

      const arabic = screen.getByText(step.dua!.arabic);
      expect(arabic.props.width).toBe("100%");
      expect(arabic.props.numberOfLines).toBeUndefined();
      expect(faces()).toHaveLength(2);
      let [front, back] = faces();
      expect(StyleSheet.flatten(front.props.style).position).toBe("relative");
      expect(back.props.accessibilityElementsHidden).toBe(true);

      await fireEvent.press(collapsedToggles()[0]);
      [front, back] = faces();
      expect(StyleSheet.flatten(back.props.style).position).toBe("relative");
      expect(front.props.accessibilityElementsHidden).toBe(true);

      const nextStep = UMRAH_STAGES.flatMap((stage) => stage.steps).find(
        (step) => step.id === "tawaf-lap-2"
      )!;
      await screen.rerender(<StepCard step={nextStep} />);
      [front, back] = faces();
      expect(StyleSheet.flatten(front.props.style).position).toBe("relative");
      expect(front.props.accessibilityElementsHidden).toBe(false);
      expect(back.props.accessibilityElementsHidden).toBe(true);
      expect(collapsedToggles()).not.toHaveLength(0);
    }
  );
});
