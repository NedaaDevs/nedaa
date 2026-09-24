// First, before expo-router's testing library: that library re-mocks Reanimated
// as it loads, and the screen must bind to the mock below, not to its empty one.
import TodayScreen from "@/app/(tabs)/index";
import { act } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { SKY_PART } from "@/components/ui/sky-background";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { AppLocale, AppMode } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { controlProblems } from "@/test-helpers/controls";
import { ThemeProvider } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/utils/date", () => ({
  ...jest.requireActual("@/utils/date"),
  HijriNative: {
    fromTimestamp: () => ({ year: 1448, month: 4, day: 12 }),
    addDays: (date: { day: number }, days: number) => ({ ...date, day: date.day + days }),
  },
}));

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

const renderToday = () =>
  renderRouter(
    { "(tabs)/index": () => <TodayScreen /> },
    {
      initialUrl: "/",
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

describe("Today", () => {
  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T14:02:00.000Z") });
    await act(() => i18n.changeLanguage(AppLocale.EN));
    useAppStore.setState({ mode: AppMode.LIGHT, locale: AppLocale.EN, hijriDaysOffset: 0 });
    useLocationStore.setState({ localizedLocation: { city: "Makkah", country: "Saudi Arabia" } });
    usePrayerTimesStore.setState({
      yesterdayTimings: null,
      todayTimings: DAY,
      tomorrowTimings: null,
      hasError: false,
      isLoading: false,
      usingDefaultLocation: false,
    });
  });
  afterEach(() => jest.useRealTimers());

  it("draws the sky behind its content", async () => {
    await renderToday();

    expect(
      screen.getAllByTestId(SKY_PART.CANVAS, { includeHiddenElements: true })
    ).not.toHaveLength(0);
  });

  it("heads the screen with the Hijri date", async () => {
    await renderToday();

    expect(screen.getByRole("header")).toBeTruthy();
  });

  it("names the next prayer above its countdown", async () => {
    await renderToday();

    expect(screen.getByText(i18n.t("today.focus.next"))).toBeTruthy();
    expect(screen.getAllByText(i18n.t("prayerTimes.asr")).length).toBeGreaterThan(0);
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    await renderToday();

    expect(controlProblems()).toEqual([]);
  });
});
