import { screen, userEvent } from "@testing-library/react-native";

import ReciterCard from "@/components/athkar/ReciterCard";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";
import type { ReciterCatalogEntry } from "@/types/athkar-audio";

const RECITER: ReciterCatalogEntry = {
  id: "reciter-1",
  name: { en: "Reciter One" },
  avatar: "",
  type: "clips",
  totalSize: 1_000_000,
  thikrCount: 10,
  sampleUrl: "https://example.com/sample.mp3",
  manifestUrl: "https://example.com/manifest.json",
  isDefault: false,
};
const NAME = RECITER.name.en;

const renderCard = (selected: boolean, onSelect = jest.fn()) =>
  renderWithTheme(
    <ReciterCard
      reciter={RECITER}
      selected={selected}
      onSelect={onSelect}
      onPlaySample={jest.fn()}
    />
  );

describe("ReciterCard", () => {
  // The screen reader must hear a choice, its name and whether it is chosen.
  it("reads as a radio with the reciter's name and state", async () => {
    await renderCard(true);

    expect(
      screen.getByRole("radio", {
        name: i18n.t("a11y.athkar.reciterSelected", { name: NAME }),
        selected: true,
      })
    ).toBeTruthy();
  });

  it("chooses the reciter when the radio is pressed", async () => {
    const onSelect = jest.fn();
    await renderCard(false, onSelect);

    await userEvent.press(screen.getByRole("radio", { name: NAME, selected: false }));

    expect(onSelect).toHaveBeenCalledWith(RECITER.id);
  });

  it("keeps the sample button reachable on its own", async () => {
    await renderCard(false);

    expect(screen.getByRole("button", { name: i18n.t("a11y.athkar.playSample") })).toBeTruthy();
  });
});
