import type { ComponentProps } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { act, fireEvent, screen, userEvent, within } from "@testing-library/react-native";
import { withTiming } from "react-native-reanimated";

import { FOCUS_COUNTDOWN_PART, FocusCountdown } from "@/components/today/FocusCountdown";
import config from "../../../../tamagui.config";
import { COUNTDOWN_PART } from "@/components/ui/countdown";
import { ROLE_RATIO } from "@/components/ui/text/sizing";
import { A11Y_ACTION } from "@/constants/Accessibility";
import { APP_STATE } from "@/constants/AppState";
import { FOCUS_LAYOUT } from "@/constants/Countdown";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { TextSize } from "@/enums/app";
import i18n from "@/localization/i18n";
import { usePreferencesStore } from "@/stores/preferences";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { renderWithTheme } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { controlProblems } from "@/test-helpers/controls";
import { fontSizeOf, lineRatioOf } from "@/test-helpers/text";

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

const renderAt = (
  date: string,
  time: string,
  props: ComponentProps<typeof FocusCountdown> = {}
) => {
  jest.useFakeTimers({ now: new Date(`${date}T${time}:00.000Z`) });
  usePrayerTimesStore.setState({
    yesterdayTimings: null,
    todayTimings: day(date),
    tomorrowTimings: null,
  });
  return renderWithTheme(<FocusCountdown {...props} />);
};
const name = (key: string) => i18n.t(key);

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const hidden = { includeHiddenElements: true };

/** The spoken figure at 14:02, 1 hour 18 minutes before Asr. */
const untilAsr = () =>
  i18n.t("a11y.today.untilSpoken", {
    prayer: name("prayerTimes.asr"),
    duration: i18n.t("a11y.today.durationBoth", {
      hours: i18n.t("common.hour", { count: 1 }),
      minutes: i18n.t("common.minute", { count: 18 }),
    }),
  });

describe("FocusCountdown", () => {
  beforeEach(() => {
    usePreferencesStore.setState({
      showSeconds: false,
      useWesternNumerals: true,
      textSize: TextSize.DEFAULT,
    });
  });
  afterEach(() => jest.useRealTimers());

  // Jest lays nothing out, so this pins the rule: the row wraps, no part shrinks.
  it.each(Object.values(TextSize))(
    "at text size %s wraps the figure under the name rather than squeeze either",
    async (textSize) => {
      usePreferencesStore.setState({ textSize });
      await renderAt("2026-09-23", "14:02");

      expect(screen.getByTestId(FOCUS_COUNTDOWN_PART.ROW)).toHaveStyle({
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "baseline",
      });
      expect(screen.getByTestId(FOCUS_COUNTDOWN_PART.NAME)).toHaveStyle({ flexShrink: 0 });
      expect(screen.getByTestId(FOCUS_COUNTDOWN_PART.FIGURE)).toHaveStyle({ flexShrink: 0 });
    }
  );

  // Beside the name or under it, the figure and its caption share a start edge.
  it("starts the caption at the figure's start edge", async () => {
    await renderAt("2026-09-23", "14:02");

    expect(screen.getByLabelText(untilAsr())).toHaveStyle({ alignItems: "flex-start" });
  });

  it("names the next prayer on a button that flips the figure", async () => {
    await renderAt("2026-09-23", "14:02");

    const button = screen.getByRole("togglebutton", { name: name("prayerTimes.asr") });
    expect(button.props.accessibilityState).toMatchObject({ checked: false });
    expect(button.props.accessibilityHint).toBe(name("a11y.today.showElapsed"));
  });

  // The name alone is the toggle: no mark beside it, the flip one tap away.
  it("draws the name alone on its toggle, with no swap mark", async () => {
    await renderAt("2026-09-23", "14:02");
    const button = screen.getByRole("togglebutton", { name: name("prayerTimes.asr") });

    expect(button.children).toEqual([screen.getByText(name("prayerTimes.asr"))]);
  });

  it("flips the figure from the screen reader's activate action", async () => {
    await renderAt("2026-09-23", "14:10");
    const button = screen.getByRole("togglebutton", { name: name("prayerTimes.asr") });

    expect(button.props.accessibilityActions).toEqual([{ name: A11Y_ACTION.ACTIVATE }]);
    await act(() =>
      fireEvent(button, "accessibilityAction", {
        nativeEvent: { actionName: A11Y_ACTION.ACTIVATE },
      })
    );

    expect(
      screen.getAllByText(
        i18n.t("today.focus.since", { prayer: name("prayerTimes.dhuhr") }),
        hidden
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("togglebutton", { name: name("prayerTimes.asr") }).props.accessibilityState
    ).toMatchObject({ checked: true });
  });

  // Level 1: the name and the figure at full ink; the label above in accent.
  it("draws the name and the figure at full ink", async () => {
    await renderAt("2026-09-23", "14:02");
    const ink = config.themes.light.fg.val;

    expect(screen.getByText(name("prayerTimes.asr"))).toHaveStyle({ color: ink });
    for (const separator of screen.getAllByText(":", hidden)) {
      expect(separator).toHaveStyle({ color: ink });
    }
    expect(screen.getByText(i18n.t("today.focus.next"))).toHaveStyle({
      color: config.themes.light.accentText.val,
    });
  });

  it("counts down to it by default", async () => {
    await renderAt("2026-09-23", "14:02");

    expect(
      screen.getAllByText(i18n.t("today.focus.until", { prayer: name("prayerTimes.asr") }), hidden)
        .length
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText(untilAsr())).toBeTruthy();
  });

  it("counts up from the last prayer once pressed", async () => {
    await renderAt("2026-09-23", "14:10");
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await user.press(screen.getByRole("togglebutton", { name: name("prayerTimes.asr") }));

    expect(
      screen.getAllByText(
        i18n.t("today.focus.since", { prayer: name("prayerTimes.dhuhr") }),
        hidden
      ).length
    ).toBeGreaterThan(0);
    const button = screen.getByRole("togglebutton", { name: name("prayerTimes.asr") });
    expect(button.props.accessibilityState).toMatchObject({ checked: true });
    expect(button.props.accessibilityHint).toBe(name("a11y.today.showRemaining"));
  });

  // For a while after its time comes in, the prayer is named and counted up from.
  it("stays on a prayer just come in, as the current one, counting up", async () => {
    await renderAt("2026-09-23", "15:32");

    expect(screen.getByText(i18n.t("today.focus.current"))).toBeTruthy();
    expect(screen.getByRole("togglebutton", { name: name("prayerTimes.asr") })).toBeTruthy();
    expect(
      screen.getAllByText(i18n.t("today.focus.since", { prayer: name("prayerTimes.asr") }), hidden)
        .length
    ).toBeGreaterThan(0);
  });

  it("names the next prayer when flipped during that time", async () => {
    await renderAt("2026-09-23", "15:32");
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await user.press(screen.getByRole("togglebutton", { name: name("prayerTimes.asr") }));

    expect(screen.getByText(i18n.t("today.focus.next"))).toBeTruthy();
    expect(screen.getByRole("togglebutton", { name: name("prayerTimes.maghrib") })).toBeTruthy();
  });

  // The prayer list names Friday's Dhuhr as Jumuah; the focus block agrees.
  it("names Dhuhr as Jumuah on a Friday", async () => {
    await renderAt("2026-09-25", "10:00");

    expect(screen.getByRole("togglebutton", { name: name("prayerTimes.jumuah") })).toBeTruthy();
  });

  describe("with seconds", () => {
    beforeEach(() => usePreferencesStore.setState({ showSeconds: true }));

    /** The digits the figure's reels show. */
    const drawnDigits = () =>
      within(screen.getByTestId(FOCUS_COUNTDOWN_PART.FIGURE))
        .getAllByTestId(COUNTDOWN_PART.SHAPE, hidden)
        .map((shape) => within(shape).getByText(/./, hidden).props.children);

    it.each([
      { paused: false, ticks: true },
      { paused: true, ticks: false },
    ])("paused $paused, moves each second: $ticks", async ({ paused, ticks }) => {
      await renderAt("2026-09-23", "14:02", { paused });
      const before = drawnDigits();

      await act(() => jest.advanceTimersByTime(1000));

      expect(drawnDigits().join("") !== before.join("")).toBe(ticks);
    });
  });

  it("shows nothing until the day's times are known", async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T14:02:00.000Z") });
    usePrayerTimesStore.setState({
      yesterdayTimings: null,
      todayTimings: null,
      tomorrowTimings: null,
    });
    await renderWithTheme(<FocusCountdown />);

    expect(screen.root).toBeEmptyElement();
  });

  it("whirls the figure when flipped", async () => {
    await renderAt("2026-09-23", "14:10");
    jest.mocked(withTiming).mockClear();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await user.press(screen.getByRole("togglebutton", { name: name("prayerTimes.asr") }));

    expect(withTiming).toHaveBeenCalled();
  });

  it("whirls the figure up again when the app comes back", async () => {
    let onChange: ((state: AppStateStatus) => void) | undefined;
    jest.spyOn(AppState, "addEventListener").mockImplementation((_, listener) => {
      onChange = listener as (state: AppStateStatus) => void;
      return { remove: () => {} };
    });
    await renderAt("2026-09-23", "14:02");
    jest.mocked(withTiming).mockClear();

    await act(() => onChange?.(APP_STATE.ACTIVE));

    expect(withTiming).toHaveBeenCalled();
  });

  // The name can be Arabic, so its display size needs the Arabic line floor.
  it("names the prayer at display size, on a line box Arabic fits", async () => {
    await renderAt("2026-09-23", "14:02");
    const named = screen.getByText(name("prayerTimes.asr"));

    expect(named).toHaveStyle({ fontSize: fontSizeOf("display") });
    expect(lineRatioOf(named)).toBeGreaterThanOrEqual(ROLE_RATIO.display);
  });

  // Beside the countdown a long name has little room; it wraps.
  it("lets a long name wrap, never truncating", async () => {
    await renderAt("2026-09-23", "14:02");
    const named = screen.getByText(name("prayerTimes.asr"));

    expect(named).toHaveStyle({ flexShrink: 1 });
    expect(named.props.numberOfLines).toBeUndefined();
  });

  it("sets the figure to balance the name, its words at reading size", async () => {
    await renderAt("2026-09-23", "14:02");

    for (const separator of screen.getAllByText(":", hidden)) {
      expect(separator).toHaveStyle({ fontSize: fontSizeOf("figure") });
    }
    for (const label of screen.getAllByText(
      i18n.t("today.focus.until", { prayer: name("prayerTimes.asr") }),
      hidden
    )) {
      expect(label).toHaveStyle({ fontSize: fontSizeOf("helper") });
    }
    expect(screen.getByText(i18n.t("today.focus.next"))).toHaveStyle({
      fontSize: fontSizeOf("md"),
    });
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    await renderAt("2026-09-23", "14:02");

    expect(controlProblems()).toEqual([]);
  });

  // In the bowl the block stands centred: label, name, figure, caption.
  describe("centred, in the bowl", () => {
    it("stacks and centres its four lines", async () => {
      await renderAt("2026-09-23", "14:02", { layout: FOCUS_LAYOUT.CENTRED });

      expect(screen.getByTestId(FOCUS_COUNTDOWN_PART.ROOT)).toHaveStyle({ alignItems: "center" });
      expect(screen.getByTestId(FOCUS_COUNTDOWN_PART.ROW)).toHaveStyle({
        flexDirection: "column",
        alignItems: "center",
      });
      expect(screen.getByLabelText(untilAsr())).toHaveStyle({ alignItems: "center" });
      expect(screen.getByText(i18n.t("today.focus.next"))).toHaveStyle({ textAlign: "center" });
      expect(screen.getByText(name("prayerTimes.asr"))).toHaveStyle({ textAlign: "center" });
    });

    it("keeps the row everywhere else", async () => {
      await renderAt("2026-09-23", "14:02");

      expect(screen.getByTestId(FOCUS_COUNTDOWN_PART.ROW)).toHaveStyle({ flexDirection: "row" });
    });

    it("flips the figure from a tap and from the screen reader", async () => {
      await renderAt("2026-09-23", "14:10", { layout: FOCUS_LAYOUT.CENTRED });
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const since = i18n.t("today.focus.since", { prayer: name("prayerTimes.dhuhr") });

      await user.press(screen.getByRole("togglebutton", { name: name("prayerTimes.asr") }));
      expect(screen.getAllByText(since, hidden).length).toBeGreaterThan(0);

      await act(() =>
        fireEvent(
          screen.getByRole("togglebutton", { name: name("prayerTimes.asr") }),
          "accessibilityAction",
          { nativeEvent: { actionName: A11Y_ACTION.ACTIVATE } }
        )
      );
      expect(screen.queryAllByText(since, hidden)).toHaveLength(0);
    });

    // A long name wraps under itself; neither it nor the figure shrinks away.
    it.each(Object.values(TextSize))("at text size %s never clips the name", async (textSize) => {
      usePreferencesStore.setState({ textSize });
      await renderAt("2026-09-23", "14:02", { layout: FOCUS_LAYOUT.CENTRED });
      const named = screen.getByText(name("prayerTimes.asr"));

      expect(named.props.numberOfLines).toBeUndefined();
      expect(screen.getByTestId(FOCUS_COUNTDOWN_PART.FIGURE)).toHaveStyle({ flexShrink: 0 });
    });

    it("gives every control a role, a name and a 44pt target", async () => {
      await renderAt("2026-09-23", "14:02", { layout: FOCUS_LAYOUT.CENTRED });

      expect(controlProblems()).toEqual([]);
    });
  });
});
