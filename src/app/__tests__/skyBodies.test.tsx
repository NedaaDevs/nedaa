// First, before expo-router's testing library: it re-mocks Reanimated as it
// loads, and the screens must bind to the mock below, not to its empty one.
import TodayScreen from "@/app/(tabs)/index";
import PreferencesScreen from "@/app/settings/preferences";
import { act, fireEvent, within } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { AppearanceStep } from "@/components/onboarding/flow/steps/AppearanceStep";
import { BOWL_PART } from "@/components/today/Bowl";
import { BOWL_FRAME_PART } from "@/components/today/CelestialRhythm";
import { SKY_PART, SkyBackground } from "@/components/ui/sky-background";
import { BACK_DESTINATION, type BackDestination } from "@/constants/BackDestinations";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { TODAY_STYLE } from "@/constants/Today";
import { AppLocale, AppMode } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { usePreferencesStore } from "@/stores/preferences";
import { stepProps } from "@/test-helpers/onboardingStepProps";
import { ThemeProvider, renderWithTheme } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import type { HijriDate } from "@/utils/date";

// Renders whole screens under a router.
jest.setTimeout(20_000);
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("@/utils/date", () => {
  // A 30-day-month calendar, enough for the header and its occasions.
  const serial = ({ year, month, day }: HijriDate) => year * 360 + (month - 1) * 30 + day;
  return {
    ...jest.requireActual("@/utils/date"),
    HijriNative: {
      fromTimestamp: () => ({ year: 1448, month: 4, day: 12 }),
      addDays: (date: { day: number }, days: number) => ({ ...date, day: date.day + days }),
      toGregorian: () => ({ year: 2026, month: 9, day: 23 }),
      differenceInDays: (a: HijriDate, b: HijriDate) => serial(b) - serial(a),
    },
  };
});
// The sky dims its bodies behind measured text; nothing is measured here.
jest.mock("@/utils/measureInWindow", () => ({ measureInWindow: () => Promise.resolve(null) }));

/** Fajr 04:30, sunrise 05:50, Isha 19:25, in UTC. */
const DAY: DayPrayerTimes = {
  date: 20260923,
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: "2026-09-23T04:30:00.000Z",
    [PRAYER_ID.DHUHR]: "2026-09-23T12:00:00.000Z",
    [PRAYER_ID.ASR]: "2026-09-23T15:20:00.000Z",
    [PRAYER_ID.MAGHRIB]: "2026-09-23T18:05:00.000Z",
    [PRAYER_ID.ISHA]: "2026-09-23T19:25:00.000Z",
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: "2026-09-23T05:50:00.000Z",
    [OTHER_TIMING.SUNSET]: "2026-09-23T18:05:00.000Z",
    [OTHER_TIMING.IMSAK]: "2026-09-23T04:20:00.000Z",
    [OTHER_TIMING.MIDNIGHT]: "2026-09-23T23:57:00.000Z",
    [OTHER_TIMING.FIRST_THIRD]: "2026-09-23T22:00:00.000Z",
    [OTHER_TIMING.LAST_THIRD]: "2026-09-24T01:55:00.000Z",
  },
};

const hidden = { includeHiddenElements: true } as const;

const onRoute = (destination: BackDestination, Screen: () => React.JSX.Element) =>
  renderRouter(
    { [destination.route]: () => <Screen /> },
    {
      initialUrl: destination.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

/** Each screen that draws a bowl over its own sky. */
const HOSTS = [
  { host: "Today", render: () => onRoute(BACK_DESTINATION.HOME, TodayScreen) },
  {
    host: "Preferences",
    render: () => onRoute(BACK_DESTINATION.SETTINGS_PREFERENCES, PreferencesScreen),
  },
  {
    host: "the onboarding Appearance step",
    render: () =>
      renderWithTheme(
        <SkyBackground>
          <AppearanceStep {...stepProps()} />
        </SkyBackground>
      ),
  },
] as const;

/** The day under a light sky, and the night under a dark one. */
const TIMES = [
  { time: "14:02", mode: AppMode.LIGHT },
  { time: "21:00", mode: AppMode.DARK },
] as const;

const CASES = HOSTS.flatMap((host) => TIMES.map((time) => ({ ...host, ...time })));

/** The suns and moons drawn inside each view with `id`. */
const bodiesIn = (id: string) =>
  screen
    .queryAllByTestId(id, hidden)
    .flatMap((root) => [
      ...within(root).queryAllByTestId(SKY_PART.SUN, hidden),
      ...within(root).queryAllByTestId(SKY_PART.MOON, hidden),
    ]);

describe("A screen with a bowl over its sky", () => {
  afterEach(() => jest.useRealTimers());

  it.each(CASES)("draws one sun or moon on $host at $time", async ({ render, time, mode }) => {
    jest.useFakeTimers({ now: new Date(`2026-09-23T${time}:00.000Z`) });
    await act(() => i18n.changeLanguage(AppLocale.EN));
    useAppStore.setState({ mode, locale: AppLocale.EN, hijriDaysOffset: 0 });
    usePreferencesStore.setState({ todayStyle: TODAY_STYLE.BOWL, showImportantDaysOnHome: false });
    usePrayerTimesStore.setState({
      yesterdayTimings: null,
      todayTimings: DAY,
      tomorrowTimings: null,
      usingDefaultLocation: false,
    });

    await render();
    // The bowl draws once its frame has a size.
    await act(() =>
      fireEvent(screen.getByTestId(BOWL_FRAME_PART.FRAME, hidden), "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 160 } },
      })
    );

    // The bowl carries the body; the page sky draws none behind it.
    expect(bodiesIn(SKY_PART.CANVAS)).toHaveLength(0);
    expect(bodiesIn(BOWL_PART.ROOT)).toHaveLength(1);
  });
});
