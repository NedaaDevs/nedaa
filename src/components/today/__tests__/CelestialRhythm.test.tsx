import { processColor } from "react-native";
import { act, fireEvent, screen } from "@testing-library/react-native";

import config from "../../../../tamagui.config";
import { CelestialRhythm, RHYTHM_PART } from "@/components/today/CelestialRhythm";
import { RHYTHM_ARC_PART, markTestId } from "@/components/today/RhythmArc";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import i18n from "@/localization/i18n";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { renderWithTheme } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import type { RhythmTimingId } from "@/utils/rhythm";
import { controlProblems } from "@/test-helpers/controls";

const LIGHT = config.themes.light;
const hidden = { includeHiddenElements: true };
/** A colour as react-native-svg hands it to the native view. */
const paint = (hex: string) => ({ type: 0, payload: processColor(hex) });

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

const renderAt = async (date: string, time: string, props = {}) => {
  jest.useFakeTimers({ now: new Date(`${date}T${time}:00.000Z`) });
  usePrayerTimesStore.setState({
    yesterdayTimings: null,
    todayTimings: day(date),
    tomorrowTimings: null,
  });
  await renderWithTheme(<CelestialRhythm {...props} />);
  await act(() =>
    fireEvent(screen.getByTestId(RHYTHM_ARC_PART.ROOT, hidden), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 340, height: 60 } },
    })
  );
};
const mark = (id: RhythmTimingId) => screen.getByTestId(markTestId(id), hidden);

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

  // The store rolls days only on launch or foreground, never at midnight.
  it("follows the clock into the next stored day", async () => {
    jest.useFakeTimers({ now: new Date("2026-09-24T13:00:00.000Z") });
    usePrayerTimesStore.setState({
      todayTimings: day("2026-09-23"),
      tomorrowTimings: day("2026-09-24"),
    });
    await renderWithTheme(<CelestialRhythm />);

    expect(summary()).toBe(i18n.t("a11y.rhythm.current", { prayer: name("prayerTimes.dhuhr") }));
  });

  // The existing prayer list names Friday's Dhuhr as Jumuah; the rhythm agrees.
  it("names Dhuhr as Jumuah on a Friday", async () => {
    await renderAt("2026-09-25", "13:00");

    expect(summary()).toBe(i18n.t("a11y.rhythm.current", { prayer: name("prayerTimes.jumuah") }));
  });

  // The cards carry the names; the arc marks each timing without them.
  it("marks every timing on the arc, writing no names", async () => {
    await renderAt("2026-09-23", "16:00");

    for (const id of [
      PRAYER_ID.FAJR,
      OTHER_TIMING.SUNRISE,
      PRAYER_ID.DHUHR,
      PRAYER_ID.ASR,
      PRAYER_ID.MAGHRIB,
      PRAYER_ID.ISHA,
    ]) {
      expect(mark(id)).toBeTruthy();
    }
    expect(screen.queryAllByText(/./, hidden)).toEqual([]);
  });

  // One gold for what is coming: the focus block and the cards mark it too.
  it("draws the next prayer's mark in the accent", async () => {
    await renderAt("2026-09-23", "16:00");

    expect(mark(PRAYER_ID.MAGHRIB).props.fill).toEqual(paint(LIGHT.accent.val));
    expect(mark(PRAYER_ID.ASR).props.fill).not.toEqual(paint(LIGHT.accent.val));
  });

  it("lights the selected prayer's mark", async () => {
    await renderAt("2026-09-23", "10:00", { selected: PRAYER_ID.MAGHRIB });

    expect(mark(PRAYER_ID.MAGHRIB).props.stroke).toEqual(paint(LIGHT.accent.val));
  });

  // Nothing leads anywhere after Isha, so the arc stays matte.
  it("fills nothing after Isha", async () => {
    await renderAt("2026-09-23", "22:00");

    expect(screen.queryAllByTestId(RHYTHM_ARC_PART.DONE, hidden)).toEqual([]);
  });

  it("fades back while a state panel covers the day", async () => {
    await renderAt("2026-09-23", "16:00", { dimmed: true });

    expect(screen.getByTestId(RHYTHM_PART.ROOT)).toHaveStyle({ opacity: 0.35 });
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    await renderAt("2026-09-23", "14:02");

    expect(controlProblems()).toEqual([]);
  });
});
