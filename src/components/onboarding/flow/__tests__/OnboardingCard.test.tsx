import { screen } from "@testing-library/react-native";

import { OnboardingCard } from "@/components/onboarding/flow/OnboardingCard";
import { Text } from "@/components/ui/text";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { renderWithTheme } from "@/test-helpers/theme";

const CARD = "onboarding-card";
const LABEL = "the whole card";

it("draws the shared glass card with no border, padded by default", async () => {
  await renderWithTheme(
    <OnboardingCard testID={CARD}>
      <Text>inside</Text>
    </OnboardingCard>
  );

  expect(screen.getByText("inside")).toBeTruthy();
  expect(screen.getByTestId(CARD)).not.toHaveStyle({ borderTopWidth: 1 });
  expect(screen.getByTestId(CARD)).toHaveStyle({
    backgroundColor: NEDAA_LIGHT.surfaceGlass.hex,
    borderTopLeftRadius: 16,
    paddingTop: 16,
  });
});

it("takes the caller's padding and gap, and reads as one element when asked", async () => {
  await renderWithTheme(
    <OnboardingCard testID={CARD} padding="$3" gap="$2" accessible accessibilityLabel={LABEL}>
      <Text>inside</Text>
    </OnboardingCard>
  );

  const card = screen.getByTestId(CARD);
  expect(card).toHaveStyle({ paddingTop: 12, gap: 8 });
  expect(card.props.accessible).toBe(true);
  expect(card.props.accessibilityLabel).toBe(LABEL);
});
