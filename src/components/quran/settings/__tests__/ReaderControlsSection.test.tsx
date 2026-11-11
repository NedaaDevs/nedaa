import { fireEvent, screen } from "@testing-library/react-native";

import ReaderControlsSection from "@/components/quran/settings/ReaderControlsSection";
import type { QuranChromeColors } from "@/hooks/useQuranChromeColors";
import i18n from "@/localization/i18n";
import { usePreferencesStore } from "@/stores/preferences";
import { renderWithTheme } from "@/test-helpers/theme";

const CHROME: QuranChromeColors = {
  accent: "#005372",
  accentWarning: "#9F6B1E",
  background: "#FFFFFF",
  cardBackground: "#F4F4F4",
  cardBorder: "#DDDDDD",
  text: "#081D36",
  subtleText: "#3B596E",
  progressTrack: "#EEEEEE",
};

const toggle = () => screen.getByRole("switch", { name: i18n.t("quran.settings.largeControls") });

describe("ReaderControlsSection", () => {
  beforeEach(() => usePreferencesStore.setState({ largeControls: false }));

  it("heads its switch with the section's name", async () => {
    await renderWithTheme(<ReaderControlsSection chrome={CHROME} />);

    expect(screen.getByText(i18n.t("quran.settings.controls"))).toBeOnTheScreen();
    expect(toggle()).not.toBeChecked();
  });

  it("shows the stored choice", async () => {
    usePreferencesStore.setState({ largeControls: true });
    await renderWithTheme(<ReaderControlsSection chrome={CHROME} />);

    expect(toggle()).toBeChecked();
  });

  // The platform switch reports a flip as a value change, not a press.
  it("stores the reader's choice", async () => {
    await renderWithTheme(<ReaderControlsSection chrome={CHROME} />);

    fireEvent(toggle(), "valueChange", true);

    expect(usePreferencesStore.getState().largeControls).toBe(true);
  });
});
