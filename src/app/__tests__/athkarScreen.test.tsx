// First: expo-router's testing library re-mocks Reanimated as it loads, and
// the screen must bind to the mock below, not to its empty one.
import Athkar from "@/app/(tabs)/athkar";
import { Text } from "react-native";
import { router, Stack, usePathname } from "expo-router";
import { act, userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { BACK_DESTINATION } from "@/constants/BackDestinations";
import i18n from "@/localization/i18n";
import { controlProblems } from "@/test-helpers/controls";
import { ThemeProvider } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
// The header sits above the tabs and the look, so the tabs are stubbed.
jest.mock("@/components/athkar/AthkarTabs", () => ({ __esModule: true, default: () => null }));

const t = i18n.t.bind(i18n);
const SETTINGS_LABEL = t("a11y.athkar.settings");

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const renderAthkar = () =>
  renderRouter(
    {
      // The root stack the settings screens push onto.
      _layout: () => <Stack screenOptions={{ headerShown: false }} />,
      [BACK_DESTINATION.ATHKAR.route]: () => (
        <>
          <Athkar />
          <Pathname />
        </>
      ),
      [BACK_DESTINATION.SETTINGS_ATHKAR.route]: Pathname,
    },
    {
      initialUrl: BACK_DESTINATION.ATHKAR.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

describe("Athkar screen header", () => {
  it("offers Athkar settings as a labelled button with a full target", async () => {
    await renderAthkar();

    expect(await screen.findByRole("button", { name: SETTINGS_LABEL })).toBeOnTheScreen();
    expect(controlProblems()).toEqual([]);
  });

  it("pushes the Athkar settings screen, so back returns here", async () => {
    await renderAthkar();

    await userEvent.press(await screen.findByRole("button", { name: SETTINGS_LABEL }));

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      BACK_DESTINATION.SETTINGS_ATHKAR.href as string
    );

    await act(() => router.back());

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      BACK_DESTINATION.ATHKAR.href as string
    );
  });
});
