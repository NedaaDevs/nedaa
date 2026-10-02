import { act, screen, userEvent } from "@testing-library/react-native";

import { PrayerDetailHero } from "@/components/prayer-detail/PrayerDetailHero";
import { COUNTDOWN_PART } from "@/components/ui/countdown";
import { OTHER_TIMING, PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import { AppLocale } from "@/enums/app";
import * as countdown from "@/hooks/useCountdownTimer";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { renderWithTheme } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { formatPrayerTime } from "@/utils/date";
import { localizeDigits } from "@/utils/digits";

jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

/** Wednesday 23 September 2026; the 25th is a Friday. */
const day = (date: string): DayPrayerTimes => ({
  date: Number(date.replaceAll("-", "")),
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: `${date}T04:30:00.000Z`,
    [PRAYER_ID.DHUHR]: `${date}T12:00:00.000Z`,
    [PRAYER_ID.ASR]: `${date}T15:20:00.000Z`,
    [PRAYER_ID.MAGHRIB]: `${date}T18:05:00.000Z`,
    [PRAYER_ID.ISHA]: `${date}T19:25:00.000Z`,
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: `${date}T05:50:00.000Z`,
  } as DayPrayerTimes["otherTimings"],
});

const renderAt = (date: string, time: string, id: PrayerId) => {
  jest.useFakeTimers({ now: new Date(`${date}T${time}:00.000Z`) });
  usePrayerTimesStore.setState({
    yesterdayTimings: null,
    todayTimings: day(date),
    tomorrowTimings: null,
  });
  return renderWithTheme(<PrayerDetailHero prayerId={id} />);
};

const name = (key: string) => i18n.t(key);
const title = () => screen.getByRole("header");
const toggle = () => screen.getByRole("togglebutton");

const spoken = (key: string, prayer: string, hours: number, minutes: number) =>
  i18n.t(key, {
    prayer,
    duration: i18n.t("a11y.today.durationBoth", {
      hours: i18n.t("common.hour", { count: hours }),
      minutes: i18n.t("common.minute", { count: minutes }),
    }),
  });

describe("PrayerDetailHero", () => {
  beforeEach(() => {
    useAppStore.setState({ locale: AppLocale.EN });
    usePreferencesStore.setState({
      showSeconds: false,
      use24HourTime: false,
      useWesternNumerals: true,
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("names the prayer inside the sheet's title", async () => {
    await renderAt("2026-09-23", "14:02", PRAYER_ID.ASR);

    expect(title()).toHaveTextContent(name("prayerTimes.asr"));
  });

  it("names Friday's Dhuhr as Jumuah", async () => {
    await renderAt("2026-09-25", "10:00", PRAYER_ID.DHUHR);

    expect(title()).toHaveTextContent(name("prayerTimes.jumuah"));
  });

  it("keeps Dhuhr's name on other days", async () => {
    await renderAt("2026-09-23", "10:00", PRAYER_ID.DHUHR);

    expect(title()).toHaveTextContent(name("prayerTimes.dhuhr"));
  });

  it.each([false, true])("shows the card's time with 24-hour time %s", async (use24HourTime) => {
    usePreferencesStore.setState({ use24HourTime });
    await renderAt("2026-09-23", "14:02", PRAYER_ID.ASR);

    const time = formatPrayerTime(day("2026-09-23").timings[PRAYER_ID.ASR], "UTC", {
      locale: AppLocale.EN,
      use24HourTime,
    });
    expect(screen.getByText(time)).toBeOnTheScreen();
  });

  it("shows the time in the chosen digits", async () => {
    useAppStore.setState({ locale: AppLocale.AR });
    usePreferencesStore.setState({ useWesternNumerals: false });
    await renderAt("2026-09-23", "14:02", PRAYER_ID.ASR);

    const time = formatPrayerTime(day("2026-09-23").timings[PRAYER_ID.ASR], "UTC", {
      locale: AppLocale.AR,
      use24HourTime: false,
    });
    expect(screen.getByText(localizeDigits(time, AppLocale.AR, false))).toBeOnTheScreen();
  });

  // Arabic speech rewrites clock digits, so labels speak the time in words.
  it("speaks an evening prayer's time as evening in Arabic", async () => {
    useAppStore.setState({ locale: AppLocale.AR });
    usePreferencesStore.setState({ useWesternNumerals: false });
    await act(() => i18n.changeLanguage(AppLocale.AR));
    try {
      await renderAt("2026-09-23", "14:02", PRAYER_ID.MAGHRIB);

      expect(screen.getByText("٦:٠٥ م")).toHaveAccessibleName("السادسة و٥ دقائق مساءً");
    } finally {
      await act(() => i18n.changeLanguage(AppLocale.EN));
    }
  });

  it("speaks the time until the prayer in whole minutes", async () => {
    await renderAt("2026-09-23", "14:02", PRAYER_ID.ASR);

    expect(toggle()).toHaveAccessibleName(
      spoken("a11y.today.untilSpoken", name("prayerTimes.asr"), 1, 18)
    );
    expect(toggle().props.accessibilityState).toMatchObject({ checked: false });
    expect(toggle().props.accessibilityHint).toBe(name("a11y.today.showElapsed"));
    // The same reels and rolling caption as Today's figure.
    expect(screen.getByTestId(COUNTDOWN_PART.ROW, { includeHiddenElements: true })).toBeTruthy();
    expect(
      screen.getAllByText(i18n.t("today.focus.until", { prayer: name("prayerTimes.asr") }), {
        includeHiddenElements: true,
      }).length
    ).toBeGreaterThan(0);
  });

  it("counts up from a prayer already in, and flips to its next time", async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T14:02:00.000Z") });
    usePrayerTimesStore.setState({
      yesterdayTimings: null,
      todayTimings: day("2026-09-23"),
      tomorrowTimings: day("2026-09-24"),
    });
    await renderWithTheme(<PrayerDetailHero prayerId={PRAYER_ID.DHUHR} />);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    expect(toggle()).toHaveAccessibleName(
      spoken("a11y.today.sinceSpoken", name("prayerTimes.dhuhr"), 2, 2)
    );
    expect(toggle().props.accessibilityState).toMatchObject({ checked: true });

    await user.press(toggle());

    // Tomorrow's Dhuhr at 12:00 is 21 hours 58 minutes away.
    expect(toggle()).toHaveAccessibleName(
      spoken("a11y.today.untilSpoken", name("prayerTimes.dhuhr"), 21, 58)
    );
    expect(toggle().props.accessibilityState).toMatchObject({ checked: false });
  });

  it("flips an upcoming prayer to the time since its last one", async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T14:02:00.000Z") });
    usePrayerTimesStore.setState({
      yesterdayTimings: day("2026-09-22"),
      todayTimings: day("2026-09-23"),
      tomorrowTimings: null,
    });
    await renderWithTheme(<PrayerDetailHero prayerId={PRAYER_ID.ASR} />);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await user.press(toggle());

    // Yesterday's Asr at 15:20 was 22 hours 42 minutes ago.
    expect(toggle()).toHaveAccessibleName(
      spoken("a11y.today.sinceSpoken", name("prayerTimes.asr"), 22, 42)
    );
    expect(toggle().props.accessibilityState).toMatchObject({ checked: true });
    expect(toggle().props.accessibilityHint).toBe(name("a11y.today.showRemaining"));
  });

  it("keeps the name and time but drops the row with no figure", async () => {
    jest.spyOn(countdown, "usePrayerCountdown").mockReturnValue(null);
    await renderAt("2026-09-23", "14:02", PRAYER_ID.ASR);

    expect(title()).toHaveTextContent(name("prayerTimes.asr"));
    expect(screen.queryByRole("togglebutton")).not.toBeOnTheScreen();
  });

  it("renders nothing before times load", async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T14:02:00.000Z") });
    usePrayerTimesStore.setState({
      yesterdayTimings: null,
      todayTimings: null,
      tomorrowTimings: null,
    });
    await renderWithTheme(<PrayerDetailHero prayerId={PRAYER_ID.ASR} />);

    expect(screen.queryByRole("header")).not.toBeOnTheScreen();
    expect(screen.toJSON()).toBeNull();
  });
});
