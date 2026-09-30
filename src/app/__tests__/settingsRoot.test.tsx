// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import SettingsScreen from "@/app/(tabs)/settings";
import { Text } from "react-native";
import { usePathname } from "expo-router";
import { userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const renderSettings = () =>
  renderRouter(
    {
      [BACK_DESTINATION.SETTINGS.route]: () => (
        <>
          <SettingsScreen />
          <Pathname />
        </>
      ),
      [BACK_DESTINATION.SETTINGS_ABOUT.route]: () => <Pathname />,
    },
    {
      initialUrl: BACK_DESTINATION.SETTINGS.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

describe("Settings root", () => {
  beforeEach(() => {
    useAppStore.setState({ locale: AppLocale.EN });
  });

  it("opens About from its row", async () => {
    await renderSettings();

    // A V2 settings row is a Link, so it reads as a link.
    await userEvent.press(screen.getByRole("link", { name: i18n.t("settings.about.title") }));

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.SETTINGS_ABOUT.href)
    );
  });

  // Help, acknowledgements, release notes and the version live in About.
  it.each(["settings.help.title", "settings.acknowledgements.title", "whatsNew.title"])(
    "leaves %s to About",
    async (key) => {
      await renderSettings();

      expect(screen.queryByLabelText(i18n.t(key))).toBeNull();
    }
  );
});
