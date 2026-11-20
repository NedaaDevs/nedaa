import { StyleSheet } from "react-native";
import { screen } from "@testing-library/react-native";

import { NextDhikr } from "@/components/athkar/session/NextDhikr";
import i18n from "@/localization/i18n";
import { useAthkarStore } from "@/stores/athkar";
import { renderWithTheme } from "@/test-helpers/theme";
import { keyText } from "@/utils/athkarText";

// The store's logger starts a flush timer that outlives the suite.
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));

const ARABIC = "سبحان الله";
const TRANSLATION = "Glory be to Allah";
const NEXT = { text: keyText(`${TRANSLATION}\n${ARABIC}`) };

const showTranslation = (show: boolean) =>
  useAthkarStore.setState((s) => ({ settings: { ...s.settings, showTranslation: show } }));

describe("NextDhikr", () => {
  it("names the next dhikr by its translation where translations show", async () => {
    showTranslation(true);
    await renderWithTheme(<NextDhikr next={NEXT} color="$muted" />);
    expect(screen.getByText(i18n.t("athkar.focus.next"))).toBeOnTheScreen();
    expect(screen.getByText(TRANSLATION)).toBeOnTheScreen();
  });

  it("names it by its Arabic where translations are hidden", async () => {
    showTranslation(false);
    await renderWithTheme(<NextDhikr next={NEXT} color="$muted" />);
    expect(screen.getByText(ARABIC)).toBeOnTheScreen();
  });

  it("gives the dhikr a line box that clears Arabic marks", async () => {
    showTranslation(false);
    await renderWithTheme(<NextDhikr next={NEXT} color="$muted" />);
    const { fontSize, lineHeight } = StyleSheet.flatten(screen.getByText(ARABIC).props.style);
    expect(lineHeight).toBeGreaterThanOrEqual(2 * fontSize);
  });

  it("says the last open dhikr is the last", async () => {
    await renderWithTheme(<NextDhikr next={null} color="$muted" />);
    expect(screen.getByText(i18n.t("athkar.session.lastThikr"))).toBeOnTheScreen();
    expect(screen.queryByText(i18n.t("athkar.focus.next"))).toBeNull();
  });
});
