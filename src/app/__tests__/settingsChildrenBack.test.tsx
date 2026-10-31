// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screens must bind to the mock below, not to its empty one.
import HijriSettings from "@/app/settings/advance/hijri";
import ProviderSettings from "@/app/settings/advance/provider";
import type { ComponentType } from "react";
import { renderRouter, screen } from "expo-router/testing-library";

import { BACK_DESTINATION, type BackDestination } from "@/constants/BackDestinations";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { ThemeProvider } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
// hijri-native is a native module; the Hijri screen reads today's date from it.
jest.mock("@/utils/date", () => ({
  ...jest.requireActual("@/utils/date"),
  HijriNative: {
    fromTimestamp: () => ({ year: 1448, month: 4, day: 12 }),
    addDays: (date: { day: number }, days: number) => ({ ...date, day: date.day + days }),
  },
}));

/** Each Settings child and the screen it leads back to with nothing behind. */
const CHILDREN: readonly [BackDestination, ComponentType, BackDestination][] = [
  [BACK_DESTINATION.SETTINGS_PROVIDER, ProviderSettings, BACK_DESTINATION.SETTINGS],
  [BACK_DESTINATION.SETTINGS_HIJRI, HijriSettings, BACK_DESTINATION.SETTINGS_PROVIDER],
];

beforeEach(() => {
  useAppStore.setState({ locale: AppLocale.EN, hijriDaysOffset: 0 });
});

// Opened cold, as from a link, each goes back to the screen that opens it.
describe.each(CHILDREN)("$route opened with nothing behind", ({ route, href }, Screen, parent) => {
  it("goes back to its parent", async () => {
    await renderRouter(
      { [route]: () => <Screen /> },
      {
        initialUrl: href,
        wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
      }
    );

    expect(
      screen.getByRole("button", {
        name: i18n.t("a11y.backTo", { screen: i18n.t(parent.title) }),
      })
    ).toBeTruthy();
  });
});
