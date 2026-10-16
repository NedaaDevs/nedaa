import { StyleSheet } from "react-native";
import { screen } from "@testing-library/react-native";

import { OnboardingFrame } from "@/components/onboarding/flow/OnboardingFrame";
import { FRAME_MODE, ONBOARDING_PART } from "@/constants/Onboarding";
import { renderWithTheme } from "@/test-helpers/theme";

const INSETS = { top: 47, right: 0, bottom: 34, left: 0 };

jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => INSETS,
}));

const noop = () => {};

// The flow draws on the sky like a sky screen, so it pads both of its edges.
it.each(Object.values(FRAME_MODE))("pads the %s frame by the device insets", async (mode) => {
  await renderWithTheme(
    <OnboardingFrame
      mode={mode}
      progress="1 of 6"
      fraction={0}
      canGoBack={false}
      busy={false}
      showPrimary
      primaryLabel="Continue"
      onPrimary={noop}
      onBack={noop}
      onSkip={noop}>
      {null}
    </OnboardingFrame>
  );

  const style = StyleSheet.flatten(screen.getByTestId(ONBOARDING_PART.FRAME).props.style);
  expect(style).toEqual(
    expect.objectContaining({ paddingTop: INSETS.top, paddingBottom: INSETS.bottom })
  );
});
