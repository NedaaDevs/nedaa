import { Text } from "react-native";
import { act, fireEvent, screen } from "@testing-library/react-native";

import { BOWL_PART, bowlMarkTestId } from "@/components/today/Bowl";
import { BOWL_FRAME_PART, CelestialRhythm, RHYTHM_PART } from "@/components/today/CelestialRhythm";
import { SKY_PART, SkyBackground } from "@/components/ui/sky-background";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { BOWL } from "@/constants/Timeline";
import { AppMode } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { renderWithTheme } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { controlProblems } from "@/test-helpers/controls";

// hijri-native is a native module; the moon needs a Hijri day.
jest.mock("@/utils/date", () => ({
  ...jest.requireActual("@/utils/date"),
  HijriNative: {
    fromTimestamp: () => ({ year: 1448, month: 4, day: 12 }),
    addDays: (date: { day: number }, days: number) => ({ ...date, day: date.day + days }),
  },
}));
jest.mock("@/utils/measureInWindow", () => ({
  measureInWindow: () => Promise.resolve({ x: 0, y: 0, width: 0, height: 0 }),
}));

const hidden = { includeHiddenElements: true };

/** Wednesday 23 September 2026; the 25th is a Friday. */
const day = (date: string, next: string): DayPrayerTimes => ({
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
    [OTHER_TIMING.MIDNIGHT]: `${date}T23:57:00.000Z`,
    [OTHER_TIMING.LAST_THIRD]: `${next}T01:55:00.000Z`,
  } as DayPrayerTimes["otherTimings"],
});

type Props = Parameters<typeof CelestialRhythm>[0];

const renderAt = async (iso: string, props: Props = {}, isRTL = false) => {
  jest.useFakeTimers({ now: new Date(iso) });
  usePrayerTimesStore.setState({
    yesterdayTimings: null,
    todayTimings: day("2026-09-23", "2026-09-24"),
    tomorrowTimings: day("2026-09-24", "2026-09-25"),
  });
  await renderWithTheme(
    <SkyBackground>
      <CelestialRhythm {...props} />
    </SkyBackground>,
    { isRTL }
  );
  await act(() =>
    fireEvent(screen.getByTestId(BOWL_FRAME_PART.FRAME, hidden), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 320, height: BOWL.leastHeight } },
    })
  );
};
const at = (time: string) => `2026-09-23T${time}:00.000Z`;

const summary = () => screen.getByTestId(RHYTHM_PART.ROOT).props.accessibilityLabel;
const name = (key: string) => i18n.t(key);
const part = (id: string) => screen.queryAllByTestId(id, hidden);

describe("CelestialRhythm", () => {
  beforeEach(() => {
    useAppStore.setState({ mode: AppMode.LIGHT, hijriDaysOffset: 0 });
    usePreferencesStore.setState({ useWesternNumerals: true });
  });
  afterEach(() => jest.useRealTimers());

  it("draws nothing until the day's times are known", async () => {
    usePrayerTimesStore.setState({ todayTimings: null });
    await renderWithTheme(
      <SkyBackground>
        <CelestialRhythm />
      </SkyBackground>
    );

    expect(screen.queryByTestId(RHYTHM_PART.ROOT)).toBeNull();
  });

  it.each([
    [
      "during a prayer",
      "16:00",
      "a11y.rhythm.currentNext",
      "prayerTimes.asr",
      "prayerTimes.maghrib",
    ],
    ["after sunrise", "09:00", "a11y.rhythm.afterSunrise", "prayerTimes.dhuhr", undefined],
    ["before Fajr", "03:00", "a11y.rhythm.beforeFajr", "prayerTimes.fajr", undefined],
  ])("tells the screen reader where the day is %s", async (_when, time, key, prayer, next) => {
    await renderAt(at(time));

    expect(summary()).toBe(
      i18n.t(key, { prayer: name(prayer), ...(next ? { next: name(next) } : {}) })
    );
  });

  // By night the summary is how much of the night has gone, Fajr ahead.
  it("tells the screen reader how far the night has gone", async () => {
    await renderAt("2026-09-24T00:00:00.000Z");
    const night = (Date.parse("2026-09-24T04:30:00.000Z") - Date.parse(at("19:25"))) / 60_000;
    const gone = Math.round(((24 * 60 - (19 * 60 + 25)) / night) * 100);

    expect(summary()).toBe(
      i18n.t("a11y.rhythm.night", { percent: String(gone), prayer: name("prayerTimes.fajr") })
    );
  });

  it("is one element for the screen reader, a summary", async () => {
    await renderAt(at("16:00"));
    const root = screen.getByTestId(RHYTHM_PART.ROOT);

    expect(root.props.accessible).toBe(true);
    expect(root.props.accessibilityRole).toBe("summary");
  });

  // The store rolls days only on launch or foreground, never at midnight.
  it("follows the clock into the next stored day", async () => {
    await renderAt("2026-09-24T13:00:00.000Z");

    expect(summary()).toBe(
      i18n.t("a11y.rhythm.currentNext", {
        prayer: name("prayerTimes.dhuhr"),
        next: name("prayerTimes.asr"),
      })
    );
  });

  // The existing prayer list names Friday's Dhuhr as Jumuah; the rhythm agrees.
  it("names Dhuhr as Jumuah on a Friday", async () => {
    jest.useFakeTimers({ now: new Date("2026-09-25T13:00:00.000Z") });
    usePrayerTimesStore.setState({
      yesterdayTimings: null,
      todayTimings: day("2026-09-25", "2026-09-26"),
      tomorrowTimings: null,
    });
    await renderWithTheme(
      <SkyBackground>
        <CelestialRhythm />
      </SkyBackground>
    );

    expect(summary()).toBe(
      i18n.t("a11y.rhythm.currentNext", {
        prayer: name("prayerTimes.jumuah"),
        next: name("prayerTimes.asr"),
      })
    );
  });

  it("names only the feet: Fajr at the start, Isha at the end", async () => {
    await renderAt(at("16:00"));

    expect(screen.getByTestId(BOWL_PART.FOOT_START, hidden)).toHaveTextContent(
      name("prayerTimes.fajr")
    );
    expect(screen.getByTestId(BOWL_PART.FOOT_END, hidden)).toHaveTextContent(
      name("prayerTimes.isha")
    );
  });

  it("ticks the day's timings by day and the night's by night", async () => {
    await renderAt(at("16:00"));
    expect(part(bowlMarkTestId(PRAYER_ID.ASR))).toHaveLength(1);
    expect(part(bowlMarkTestId(OTHER_TIMING.MIDNIGHT))).toHaveLength(0);

    await act(() => jest.advanceTimersByTime(6 * 60 * 60_000));
    expect(part(bowlMarkTestId(PRAYER_ID.ASR))).toHaveLength(0);
    expect(part(bowlMarkTestId(OTHER_TIMING.MIDNIGHT))).toHaveLength(1);
  });

  it("keeps the chosen prayer ringed on the arc", async () => {
    await renderAt(at("10:00"), { selected: PRAYER_ID.MAGHRIB });

    expect(part(BOWL_PART.SELECTED)).toHaveLength(1);
  });

  // One sun: the light sky's body rides the rim by day, the moon by night.
  it.each([
    ["16:00", SKY_PART.SUN],
    ["22:00", SKY_PART.MOON],
  ])("draws the body at %s on the rim", async (time, body) => {
    await renderAt(at(time));

    expect(part(body)).toHaveLength(1);
  });

  it("draws the moon on a dark sky by day", async () => {
    useAppStore.setState({ mode: AppMode.DARK });
    await renderAt(at("16:00"));

    expect(part(SKY_PART.MOON)).toHaveLength(1);
    expect(part(SKY_PART.SUN)).toHaveLength(0);
  });

  it("holds its least height and sets what it holds inside the bowl", async () => {
    jest.useFakeTimers({ now: new Date(at("16:00")) });
    usePrayerTimesStore.setState({ todayTimings: day("2026-09-23", "2026-09-24") });
    await renderWithTheme(
      <SkyBackground>
        <CelestialRhythm>
          <Text>inside</Text>
        </CelestialRhythm>
      </SkyBackground>
    );

    expect(screen.getByTestId(BOWL_FRAME_PART.FRAME)).toHaveStyle({ minHeight: BOWL.leastHeight });
    expect(screen.getByTestId(BOWL_FRAME_PART.INSIDE)).toHaveStyle({
      paddingTop: BOWL.insideTop,
      alignItems: "center",
    });
    expect(screen.getByText("inside")).toBeTruthy();
  });

  // Large text makes the countdown taller; the bowl grows with it.
  it("draws the bowl at the height it is laid out to", async () => {
    await renderAt(at("16:00"));
    await act(() =>
      fireEvent(screen.getByTestId(BOWL_FRAME_PART.FRAME, hidden), "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 240 } },
      })
    );
    const svg = screen.container.queryAll((node) => node.type === "RNSVGSvgView")[0];

    expect(svg.props.bbHeight ?? svg.props.height).toBe(240);
  });

  it("fades back while a state panel covers the day", async () => {
    await renderAt(at("16:00"), { dimmed: true });

    expect(screen.getByTestId(RHYTHM_PART.ROOT)).toHaveStyle({ opacity: 0.35 });
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    await renderAt(at("14:02"));

    expect(controlProblems()).toEqual([]);
  });
});
