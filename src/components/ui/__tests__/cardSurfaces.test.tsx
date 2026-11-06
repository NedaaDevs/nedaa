import { Compass, Heart } from "lucide-react-native";
import { screen } from "@testing-library/react-native";

import { OnboardingCard } from "@/components/onboarding/flow/OnboardingCard";
import { SupportTile } from "@/components/settings/SupportTile";
import { ChoiceGroup, ChoiceRow } from "@/components/ui/choice-row";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { Tile } from "@/components/ui/tile";
import { ReleaseNoteCard } from "@/components/whats-new/ReleaseNoteCard";
import { WHATS_NEW_ENTRIES } from "@/constants/WhatsNew";
import i18n from "@/localization/i18n";
import { expectOnRestingSurface } from "@/test-helpers/surface";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

// Every card surface draws the one card: glass tone, e1 lift, lit edge.
describe("card surfaces", () => {
  it("draws a tool tile as a card", async () => {
    await renderWithTheme(<Tile icon={Compass} label="Qibla" onPress={jest.fn()} />);

    expectOnRestingSurface(screen.getByRole("button", { name: "Qibla" }));
  });

  it("draws an onboarding step's card as a card", async () => {
    await renderWithTheme(
      <OnboardingCard>
        <Text>inside</Text>
      </OnboardingCard>
    );

    expectOnRestingSurface(screen.getByText("inside"));
  });

  it("draws a state panel's card variant as a card", async () => {
    await renderWithTheme(<StatePanel title="Title" body="Body." />);

    expectOnRestingSurface(screen.getByText("Title"));
  });

  it("draws a support tile as a card", async () => {
    await renderWithTheme(
      <SupportTile
        icon={Heart}
        ink="$accent"
        label="Rate"
        thanksLabel="Thanks"
        thanked={false}
        hint="Opens the store"
        onPress={jest.fn()}
      />
    );

    expectOnRestingSurface(screen.getByRole("button", { name: "Rate" }));
  });

  it("draws a release note as a card", async () => {
    const [entry] = WHATS_NEW_ENTRIES;
    await renderWithTheme(
      <ReleaseNoteCard entry={entry} ordinal={1} onNavigate={jest.fn()} onSettled={jest.fn()} />
    );

    expectOnRestingSurface(screen.getByText(i18n.t(entry.titleKey)));
  });

  it("draws a choice that stands alone as a card", async () => {
    await renderWithTheme(
      <ChoiceGroup label="Theme">
        <ChoiceRow title="Light" selected={false} onPress={jest.fn()} />
        <ChoiceRow title="Dark" selected onPress={jest.fn()} />
      </ChoiceGroup>
    );

    expectOnRestingSurface(screen.getByRole("radio", { name: "Light" }));
  });
});
