import { Text } from "react-native";
import { usePathname } from "expo-router";
import { fireEvent, userEvent, within } from "@testing-library/react-native";
import { act, renderRouter, screen } from "expo-router/testing-library";

import config from "../../../../tamagui.config";
import { TODAY_HEADER_PART, TodayHeader } from "@/components/today/TodayHeader";
import { ROLE_RATIO } from "@/components/ui/text/sizing";
import { A11Y_ACTION } from "@/constants/Accessibility";
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
const PLACE = i18n.t("place.name", { city: CITY, country: COUNTRY });

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

  // The date can be Arabic, so its title size needs the Arabic line floor.
  it("sets the Hijri date at its title size, on a line box Arabic fits", async () => {
    await renderHeader();
    const date = screen.getByRole("header");

    expect(date).toHaveStyle({ fontSize: fontSizeOf("headline"), color: LIGHT.fg.val });
    expect(lineRatioOf(date)).toBeGreaterThanOrEqual(ROLE_RATIO.title);
  });

  it("sets the Gregorian date and the place at reading size", async () => {
    await renderHeader();

    expect(
      screen.getByText(
        i18n.t("today.gregorianDate", { day: "Wednesday", date: "23 September 2026" })
      )
    ).toHaveStyle({ fontSize: fontSizeOf("md") });
    expect(screen.getByText(PLACE)).toHaveStyle({ fontSize: fontSizeOf("md") });
  });

  // Level 3: the brand, the Gregorian line and the place wait for the eye.
  it("keeps the brand and the place at the quiet level", async () => {
    await renderHeader();

    expect(screen.getByText(i18n.t("brand.name"))).toHaveStyle({
      fontSize: fontSizeOf("md"),
      color: LIGHT.mutedSky.val,
    });
    expect(screen.getByText(PLACE)).toHaveStyle({ color: LIGHT.mutedSky.val });
  });

  // One quiet line under the Gregorian date: city and country together.
  it("names the city and country in one line under the dates", async () => {
    await renderHeader();
    const dates = screen.getByTestId(TODAY_HEADER_PART.DATES);
    const line = screen.getByTestId(TODAY_HEADER_PART.PLACE);

    expect(within(line).getByText(PLACE)).toBeOnTheScreen();
    expect(within(dates).getByTestId(TODAY_HEADER_PART.PLACE)).toBe(line);
    expect(line).toHaveStyle({ flexDirection: "row" });
  });

  // Jest lays nothing out, so this pins the rule: the line wraps, never cut.
  it.each(Object.values(TextSize))(
    "at text size %s wraps the place rather than truncate it",
    async (textSize) => {
      usePreferencesStore.setState({ textSize });
      await renderHeader();
      const place = screen.getByText(PLACE);

      expect(place.props.numberOfLines).toBeUndefined();
      expect(place).toHaveStyle({ flexShrink: 1 });
      expect(screen.getByTestId(TODAY_HEADER_PART.DATES)).toHaveStyle({ flexShrink: 0 });
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

    expect(within(screen.getByTestId(TODAY_HEADER_PART.PLACE)).getByText(PLACE)).toBeTruthy();
  });

  it("names the city alone when the country is not known", async () => {
    useLocationStore.setState({ localizedLocation: { city: CITY, country: "" } });
    await renderHeader();

    expect(within(screen.getByTestId(TODAY_HEADER_PART.PLACE)).getByText(CITY)).toBeTruthy();
  });

  // The line is no control of its own: the whole date block takes the tap.
  it("opens the location settings from the date block", async () => {
    await renderHeader();

    await userEvent
      .setup({ advanceTimers: jest.advanceTimersByTime })
      .press(screen.getByTestId(TODAY_HEADER_PART.DATES));

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.SETTINGS_LOCATION.href)
    );
  });

  it("leaves the place line without a touch handler of its own", async () => {
    await renderHeader();

    expect(screen.getByTestId(TODAY_HEADER_PART.PLACE).props.onResponderRelease).toBeUndefined();
  });

  // The reader keeps the date a heading and reaches Location from the place.
  it("lets a screen reader open the location settings from the place", async () => {
    await renderHeader();
    const place = screen.getByRole("button", {
      name: i18n.t("a11y.location.currentCity", { city: PLACE }),
    });

    expect(place.props.accessibilityHint).toBe(i18n.t("a11y.today.locationHint"));
    await act(() =>
      fireEvent(place, "accessibilityAction", { nativeEvent: { actionName: A11Y_ACTION.ACTIVATE } })
    );

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.SETTINGS_LOCATION.href)
    );
  });

  it("keeps the date block out of the reader, its parts read one by one", async () => {
    await renderHeader();

    expect(screen.getByTestId(TODAY_HEADER_PART.DATES).props.accessible).toBe(false);
    expect(screen.getByRole("header")).toBeOnTheScreen();
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    await renderHeader();

    expect(controlProblems()).toEqual([]);
  });
});
