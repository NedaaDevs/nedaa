// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import HelpScreen from "@/app/settings/help";
import { renderRouter, screen } from "expo-router/testing-library";

import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { ThemeProvider } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));

const t = i18n.t.bind(i18n);

const renderHelp = () =>
  renderRouter(
    { [BACK_DESTINATION.SETTINGS_HELP.route]: () => <HelpScreen /> },
    {
      initialUrl: BACK_DESTINATION.SETTINGS_HELP.href,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

describe("Help", () => {
  beforeEach(() => {
    useAppStore.setState({ locale: AppLocale.EN });
  });

  it("heads the screen with its name", async () => {
    await renderHelp();

    expect(screen.getByRole("header", { name: t("settings.help.title") })).toBeOnTheScreen();
  });

  // A reader jumps between sections by heading; the title draws upper-cased.
  it("titles its contact section as a heading", async () => {
    await renderHelp();

    const title = new RegExp(`^${t("settings.help.contactUs")}$`, "i");
    expect(screen.getByRole("header", { name: title })).toBeOnTheScreen();
  });

  it("offers email as a button", async () => {
    await renderHelp();

    expect(
      screen.getByRole("button", { name: t("settings.help.contact.email") })
    ).toBeOnTheScreen();
  });
});
