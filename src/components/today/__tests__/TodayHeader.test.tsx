import { Text } from "react-native";
import { usePathname } from "expo-router";
import { userEvent } from "@testing-library/react-native";
import { act, renderRouter, screen } from "expo-router/testing-library";

import config from "../../../../tamagui.config";
import { TodayHeader } from "@/components/today/TodayHeader";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { AppLocale, AppMode } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePreferencesStore } from "@/stores/preferences";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";

// hijri-native is a native module; the header reads today's Hijri date from it.
jest.mock("@/utils/date", () => ({
  ...jest.requireActual("@/utils/date"),
  HijriNative: {
    fromTimestamp: () => ({ year: 1448, month: 4, day: 12 }),
    addDays: (date: { day: number }, days: number) => ({ ...date, day: date.day + days }),
  },
}));

const LIGHT = config.themes.light;
const CITY = "Makkah";
const COUNTRY = "Saudi Arabia";

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const renderHeader = () =>
  renderRouter(
    {
      "(tabs)/index": () => (
        <>
          <TodayHeader />
          <Pathname />
        </>
      ),
      [BACK_DESTINATION.SETTINGS_LOCATION.route]: () => <Pathname />,
    },
    {
      initialUrl: "/",
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

describe("TodayHeader", () => {
  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T09:00:00.000Z") });
    await act(() => i18n.changeLanguage(AppLocale.EN));
    useAppStore.setState({ mode: AppMode.LIGHT, locale: AppLocale.EN, hijriDaysOffset: 0 });
    usePreferencesStore.setState({ useWesternNumerals: false });
    useLocationStore.setState({
      localizedLocation: { city: CITY, country: COUNTRY },
      locationDetails: {
        ...useLocationStore.getState().locationDetails,
        timezone: "UTC",
      },
    });
  });
  afterEach(() => jest.useRealTimers());

  it("heads the day with its Hijri date", async () => {
    await renderHeader();

    expect(
      screen.getByRole("header", { name: `12 ${i18n.t("hijriMonths.3")} 1448` })
    ).toBeOnTheScreen();
  });

  // The user's Hijri correction moves the date the whole app shows.
  it("applies the user's Hijri correction", async () => {
    useAppStore.setState({ hijriDaysOffset: 1 });
    await renderHeader();

    expect(screen.getByRole("header", { name: `13 ${i18n.t("hijriMonths.3")} 1448` })).toBeTruthy();
  });

  it("gives the Gregorian date with its day name, muted for the sky", async () => {
    await renderHeader();

    const line = screen.getByText(
      i18n.t("today.gregorianDate", { day: "Wednesday", date: "23 September 2026" })
    );

    expect(line).toHaveStyle({ color: LIGHT.mutedSky.val });
  });

  it("opens the location settings from the city", async () => {
    await renderHeader();

    await userEvent
      .setup({ advanceTimers: jest.advanceTimersByTime })
      .press(
        screen.getByRole("button", { name: i18n.t("a11y.location.currentCity", { city: CITY }) })
      );

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.SETTINGS_LOCATION.href)
    );
  });
});
