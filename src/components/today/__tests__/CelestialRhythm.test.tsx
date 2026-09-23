import { processColor } from "react-native";
import { screen } from "@testing-library/react-native";

import config from "../../../../tamagui.config";
import { ARC_PART } from "@/components/ui/arc";
import { CelestialRhythm, RHYTHM_PART } from "@/components/today/CelestialRhythm";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import i18n from "@/localization/i18n";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { renderWithTheme } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";

const LIGHT = config.themes.light;

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

const renderAt = (date: string, time: string, props = {}) => {
  jest.useFakeTimers({ now: new Date(`${date}T${time}:00.000Z`) });
  usePrayerTimesStore.setState({ todayTimings: day(date) });
  return renderWithTheme(<CelestialRhythm {...props} />);
};

const summary = () => screen.getByTestId(RHYTHM_PART.ROOT).props.accessibilityLabel;
const name = (key: string) => i18n.t(key);

describe("CelestialRhythm", () => {
  afterEach(() => jest.useRealTimers());

  it("draws nothing until the day's times are known", async () => {
    usePrayerTimesStore.setState({ todayTimings: null });
    await renderWithTheme(<CelestialRhythm />);

    expect(screen.queryByTestId(RHYTHM_PART.ROOT)).toBeNull();
  });

  it.each([
    ["during a prayer", "16:00", "a11y.rhythm.current", "prayerTimes.asr"],
    ["after sunrise", "09:00", "a11y.rhythm.afterSunrise", "prayerTimes.dhuhr"],
    ["before Fajr", "03:00", "a11y.rhythm.beforeFajr", "prayerTimes.fajr"],
  ])("tells the screen reader where the day is %s", async (_when, time, key, prayer) => {
    await renderAt("2026-09-23", time);

    expect(summary()).toBe(i18n.t(key, { prayer: name(prayer) }));
  });

  // The existing prayer list names Friday's Dhuhr as Jumuah; the rhythm agrees.
  it("names Dhuhr as Jumuah on a Friday", async () => {
    await renderAt("2026-09-25", "13:00");

    expect(summary()).toBe(i18n.t("a11y.rhythm.current", { prayer: name("prayerTimes.jumuah") }));
    expect(
      screen.getByText(name("prayerTimes.jumuah"), { includeHiddenElements: true })
    ).toBeTruthy();
  });

  it("labels every timing on the line", async () => {
    await renderAt("2026-09-23", "16:00");

    for (const key of [
      "prayerTimes.fajr",
      "otherTimings.sunrise",
      "prayerTimes.dhuhr",
      "prayerTimes.asr",
      "prayerTimes.maghrib",
      "prayerTimes.isha",
    ]) {
      expect(screen.getByText(name(key), { includeHiddenElements: true })).toBeTruthy();
    }
  });

  it("draws the current prayer's label in the accent", async () => {
    await renderAt("2026-09-23", "16:00");

    expect(screen.getByText(name("prayerTimes.asr"), { includeHiddenElements: true })).toHaveStyle({
      color: LIGHT.accent.val,
    });
  });

  it("lights the selected prayer's stretch of the line", async () => {
    await renderAt("2026-09-23", "10:00", { selected: PRAYER_ID.MAGHRIB });

    const strokes = screen
      .getAllByTestId(ARC_PART.SEGMENT, { includeHiddenElements: true })
      .map((node) => node.props.stroke?.payload);

    expect(strokes).toContain(processColor(LIGHT.accent.val));
  });

  it("fades back while a state panel covers the day", async () => {
    await renderAt("2026-09-23", "16:00", { dimmed: true });

    expect(screen.getByTestId(RHYTHM_PART.ROOT)).toHaveStyle({ opacity: 0.35 });
  });
});
