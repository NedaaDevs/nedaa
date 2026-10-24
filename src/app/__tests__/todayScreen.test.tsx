// First, before expo-router's testing library: that library re-mocks Reanimated
// as it loads, and the screen must bind to the mock below, not to its empty one.
import TodayScreen from "@/app/(tabs)/index";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { act, fireEvent, userEvent, within } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { BOWL_PART } from "@/components/today/Bowl";
import { BOWL_FRAME_PART, RHYTHM_PART } from "@/components/today/CelestialRhythm";
import { PRAYER_GRID_PART } from "@/components/today/PrayerGrid";
import { FOCUS_COUNTDOWN_PART } from "@/components/today/FocusCountdown";
import { SKY_PART } from "@/components/ui/sky-background";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { AppLocale, AppMode } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePreferencesStore } from "@/stores/preferences";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { controlProblems } from "@/test-helpers/controls";
import { ThemeProvider } from "@/test-helpers/theme";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import type { HijriDate } from "@/utils/date";
import { TODAY_SCREEN_PART, TODAY_STYLE } from "@/constants/Today";
import config from "../../../tamagui.config";

// Renders the whole Today screen under a router; a full parallel run passes 5 s.
jest.setTimeout(20_000);
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("@/utils/date", () => {
  // A 30-day-month calendar, enough for the occasions to count their days.
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

const hidden = { includeHiddenElements: true };
const SRC = join(__dirname, "../..");

/** Every .tsx under src/, tests excluded. */
const skySources = (dir = SRC): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : skySources(path);
    return entry.name.endsWith(".tsx") ? [readFileSync(path, "utf8")] : [];
  });

const renderToday = () =>
  renderRouter(
    { [BACK_DESTINATION.HOME.route]: () => <TodayScreen /> },
    {
      initialUrl: BACK_DESTINATION.HOME.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

describe("Today", () => {
  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T14:02:00.000Z") });
    await act(() => i18n.changeLanguage(AppLocale.EN));
    useAppStore.setState({ mode: AppMode.LIGHT, locale: AppLocale.EN, hijriDaysOffset: 0 });
    usePreferencesStore.setState({
      showImportantDaysOnHome: false,
      todayStyle: TODAY_STYLE.BOWL,
    });
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

    expect(screen.getByRole("header", { name: `12 ${i18n.t("hijriMonths.3")} 1448` })).toBeTruthy();
  });

  it.each([
    [false, 0],
    [true, 1],
  ])("lists the coming occasions only when asked (on: %s)", async (on, shown) => {
    usePreferencesStore.setState({ showImportantDaysOnHome: on });
    await renderToday();

    expect(
      screen.queryAllByRole("header", { name: i18n.t("importantDays.upcoming") })
    ).toHaveLength(shown);
  });

  it("names the next prayer above its countdown", async () => {
    await renderToday();

    expect(screen.getByText(i18n.t("today.focus.next"))).toBeTruthy();
    expect(screen.getAllByText(i18n.t("prayerTimes.asr")).length).toBeGreaterThan(0);
  });

  it("opens a prayer's sheet from its card, keeping the card chosen", async () => {
    await renderToday();
    const card = screen.getByRole("button", {
      name: new RegExp(`^${i18n.t("prayerTimes.maghrib")},`),
    });

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.press(card);

    expect(
      screen.getByRole("header", { name: i18n.t("prayerTimes.maghrib"), hidden: true })
    ).toBeTruthy();
    expect(card.props.accessibilityState).toMatchObject({ selected: true });
  });

  // Sunrise shows once: the quiet sixth cell, not again under other times.
  it("shows sunrise once, beside the prayers", async () => {
    await renderToday();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await user.press(screen.getByRole("button", { name: i18n.t("otherTimings.title") }));

    expect(
      screen.getAllByText(i18n.t("otherTimings.sunrise"), { includeHiddenElements: true })
    ).toHaveLength(1);
  });

  // The air does the separating: a wide gutter, more room around what matters.
  it("sets the gutter, the hero's air and the day's tighter rhythm", async () => {
    await renderToday();
    const space = config.tokens.space;

    expect(screen.getByTestId(TODAY_SCREEN_PART.CONTENT)).toHaveStyle({
      paddingLeft: space.screen.val,
      paddingRight: space.screen.val,
      gap: space.heroGap.val,
    });
    expect(screen.getByTestId(TODAY_SCREEN_PART.DAY)).toHaveStyle({ gap: space["3.5"].val });
  });

  // The countdown and the arc are one hero: the countdown sits in the bowl.
  it("sets the countdown inside the bowl, first in the day", async () => {
    await renderToday();
    const day = screen.getByTestId(TODAY_SCREEN_PART.DAY);
    const bowl = screen.getByTestId(BOWL_FRAME_PART.INSIDE);

    expect(day.children[0]).toBe(screen.getByTestId(TODAY_SCREEN_PART.FOCUS));
    expect(within(bowl).getByText(i18n.t("today.focus.next"))).toBeTruthy();
    expect(within(bowl).getByTestId(FOCUS_COUNTDOWN_PART.ROOT)).toHaveStyle({
      alignItems: "center",
    });
  });

  // One sun: the sky draws no body on Today; the bowl draws it on its rim.
  it("draws one sun, on the bowl", async () => {
    await renderToday();
    await act(() =>
      fireEvent(screen.getByTestId(BOWL_FRAME_PART.FRAME), "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 160 } },
      })
    );

    expect(screen.queryAllByTestId(SKY_PART.BODIES, hidden)).toHaveLength(0);
    expect(screen.getAllByTestId(SKY_PART.SUN, hidden)).toHaveLength(1);
    expect(
      within(screen.getByTestId(BOWL_PART.ROOT, hidden)).getAllByTestId(SKY_PART.SUN, hidden)
    ).toHaveLength(1);
  });

  // Every other sky screen keeps the sky's own sun and moon.
  it("is the only screen that hides the sky's bodies", () => {
    const hiding = /<SkyBackground\b[^>]*bodies=\{(?!true\})/;
    const hiders = skySources().filter((text) => hiding.test(text));

    expect(hiders).toHaveLength(1);
    expect(readFileSync(join(SRC, "app/(tabs)/index.tsx"), "utf8")).toMatch(hiding);
  });

  it("draws no progress bar in the bowl style", async () => {
    await renderToday();

    expect(screen.queryAllByTestId(PRAYER_GRID_PART.BAR, hidden)).toHaveLength(0);
  });

  // The simple style: no bowl, the countdown in its row, a bar on the lit card.
  describe("in the simple style", () => {
    beforeEach(() => usePreferencesStore.setState({ todayStyle: TODAY_STYLE.SIMPLE }));

    it("draws no bowl, the countdown first in the day in its row", async () => {
      await renderToday();
      const day = screen.getByTestId(TODAY_SCREEN_PART.DAY);
      const focus = screen.getByTestId(TODAY_SCREEN_PART.FOCUS);

      expect(screen.queryByTestId(RHYTHM_PART.ROOT, hidden)).toBeNull();
      expect(screen.queryByTestId(BOWL_FRAME_PART.FRAME, hidden)).toBeNull();
      expect(day.children[0]).toBe(focus);
      expect(within(focus).getByText(i18n.t("today.focus.next"))).toBeTruthy();
      expect(within(focus).getByTestId(FOCUS_COUNTDOWN_PART.ROOT)).not.toHaveStyle({
        alignItems: "center",
      });
    });

    it("keeps the sky's own sun", async () => {
      await renderToday();

      expect(screen.getAllByTestId(SKY_PART.BODIES, hidden)).not.toHaveLength(0);
      expect(screen.getAllByTestId(SKY_PART.SUN, hidden)).toHaveLength(1);
    });

    // 14:02 is between Dhuhr (12:00) and Asr (15:20): Asr's card is lit.
    it("draws one bar, in the lit card", async () => {
      await renderToday();
      const asr = screen.getByRole("button", {
        name: new RegExp(`^${i18n.t("prayerTimes.asr")},`),
      });

      expect(screen.getAllByTestId(PRAYER_GRID_PART.BAR, hidden)).toHaveLength(1);
      expect(within(asr).getByTestId(PRAYER_GRID_PART.BAR, hidden)).toBeTruthy();
    });

    it("gives every control a role, a name and a 44pt target", async () => {
      await renderToday();

      expect(controlProblems()).toEqual([]);
    });
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    usePreferencesStore.setState({ showImportantDaysOnHome: true });
    await renderToday();

    expect(controlProblems()).toEqual([]);
  });
});
