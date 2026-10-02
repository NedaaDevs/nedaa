import { Text } from "react-native";
import { usePathname } from "expo-router";
import { userEvent, within } from "@testing-library/react-native";
import { act, renderRouter, screen } from "expo-router/testing-library";

import config from "../../../../tamagui.config";
import { TODAY_HEADER_PART, TodayHeader } from "@/components/today/TodayHeader";
import { ROLE_RATIO } from "@/components/ui/text/sizing";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { AppLocale, AppMode, TextSize } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePreferencesStore } from "@/stores/preferences";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";
import { controlProblems } from "@/test-helpers/controls";
import { fontSizeOf, lineRatioOf } from "@/test-helpers/text";

// hijri-native is a native module; the header reads today's Hijri date from it.
const mockFromTimestamp = jest.fn((_seconds: number, _timezone: string) => ({
  year: 1448,
  month: 4,
  day: 12,
}));
jest.mock("@/utils/date", () => ({
  ...jest.requireActual("@/utils/date"),
  HijriNative: {
    fromTimestamp: (seconds: number, timezone: string) => mockFromTimestamp(seconds, timezone),
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
      [BACK_DESTINATION.HOME.route]: () => (
        <>
          <TodayHeader />
          <Pathname />
        </>
      ),
      [BACK_DESTINATION.SETTINGS_LOCATION.route]: () => <Pathname />,
    },
    {
      initialUrl: BACK_DESTINATION.HOME.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

describe("TodayHeader", () => {
  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T09:00:00.000Z") });
    await act(() => i18n.changeLanguage(AppLocale.EN));
    useAppStore.setState({ mode: AppMode.LIGHT, locale: AppLocale.EN, hijriDaysOffset: 0 });
    usePreferencesStore.setState({ useWesternNumerals: false, textSize: TextSize.DEFAULT });
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

  // 22:00 UTC is already Thursday in Makkah; the header reads the city's day.
  it("dates the day in the location's timezone, asking Hijri in seconds", async () => {
    const now = new Date("2026-09-23T22:00:00.000Z");
    jest.setSystemTime(now);
    useLocationStore.setState({
      locationDetails: { ...useLocationStore.getState().locationDetails, timezone: "Asia/Riyadh" },
    });
    await renderHeader();

    expect(
      screen.getByText(
        i18n.t("today.gregorianDate", { day: "Thursday", date: "24 September 2026" })
      )
    ).toBeTruthy();
    expect(mockFromTimestamp).toHaveBeenCalledWith(Math.floor(now.getTime() / 1000), "Asia/Riyadh");
  });

  // The date can be Arabic, so its display size needs the Arabic line floor.
  it("sets the Hijri date at display size, on a line box Arabic fits", async () => {
    await renderHeader();
    const date = screen.getByRole("header");

    expect(date).toHaveStyle({ fontSize: fontSizeOf("4xl") });
    expect(lineRatioOf(date)).toBeGreaterThanOrEqual(ROLE_RATIO.display);
  });

  it("sets the Gregorian date and the place at reading size", async () => {
    await renderHeader();

    expect(
      screen.getByText(
        i18n.t("today.gregorianDate", { day: "Wednesday", date: "23 September 2026" })
      )
    ).toHaveStyle({ fontSize: fontSizeOf("md") });
    expect(screen.getByText(CITY)).toHaveStyle({ fontSize: fontSizeOf("md") });
    expect(screen.getByText(COUNTRY)).toHaveStyle({ fontSize: fontSizeOf("sm") });
  });

  // Jest lays nothing out, so this pins the rule: the row wraps, no part shrinks.
  it.each(Object.values(TextSize))(
    "at text size %s wraps the place under the dates rather than truncate it",
    async (textSize) => {
      usePreferencesStore.setState({ textSize });
      await renderHeader();

      expect(screen.getByTestId(TODAY_HEADER_PART.DATE_ROW)).toHaveStyle({
        flexDirection: "row",
        flexWrap: "wrap",
      });
      expect(screen.getByTestId(TODAY_HEADER_PART.DATES)).toHaveStyle({ flexShrink: 0 });
      expect(screen.getByTestId(TODAY_HEADER_PART.PLACE)).toHaveStyle({ flexShrink: 0 });
    }
  );

  // The store starts the localized name empty, not missing.
  it("names the place from the device address until the localized name lands", async () => {
    useLocationStore.setState({
      localizedLocation: { city: "", country: "" },
      locationDetails: {
        ...useLocationStore.getState().locationDetails,
        address: { city: CITY, country: COUNTRY },
      },
    });
    await renderHeader();

    expect(within(screen.getByTestId(TODAY_HEADER_PART.PLACE)).getByText(CITY)).toBeOnTheScreen();
    expect(within(screen.getByTestId(TODAY_HEADER_PART.PLACE)).getByText(COUNTRY)).toBeTruthy();
  });

  // Beside the dates or under them, the city and country share a start edge.
  it("starts the city and country at the place's start edge", async () => {
    await renderHeader();

    expect(
      screen.getByRole("button", { name: i18n.t("a11y.location.currentCity", { city: CITY }) })
    ).toHaveStyle({ alignItems: "flex-start" });
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

  it("gives every control a role, a name and a 44pt target", async () => {
    await renderHeader();

    expect(controlProblems()).toEqual([]);
  });
});
