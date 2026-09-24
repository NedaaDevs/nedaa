import { AppState, type AppStateStatus } from "react-native";
import { act, screen, userEvent } from "@testing-library/react-native";
import { withTiming } from "react-native-reanimated";

import { FocusCountdown } from "@/components/today/FocusCountdown";
import { APP_STATE } from "@/constants/AppState";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import i18n from "@/localization/i18n";
import { usePreferencesStore } from "@/stores/preferences";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { renderWithTheme } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";

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

const renderAt = (date: string, time: string) => {
  jest.useFakeTimers({ now: new Date(`${date}T${time}:00.000Z`) });
  usePrayerTimesStore.setState({
    yesterdayTimings: null,
    todayTimings: day(date),
    tomorrowTimings: null,
  });
  return renderWithTheme(<FocusCountdown />);
};
const name = (key: string) => i18n.t(key);

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const hidden = { includeHiddenElements: true };

describe("FocusCountdown", () => {
  beforeEach(() => {
    usePreferencesStore.setState({
      showSeconds: false,
      iqamaCountUpEnabled: false,
      useWesternNumerals: true,
    });
  });
  afterEach(() => jest.useRealTimers());

  it("names the next prayer on a button that flips the figure", async () => {
    await renderAt("2026-09-23", "14:02");

    const button = screen.getByRole("togglebutton", { name: name("prayerTimes.asr") });
    expect(button.props.accessibilityState).toMatchObject({ checked: false });
    expect(button.props.accessibilityHint).toBe(name("a11y.today.showElapsed"));
  });

  it("counts down to it by default", async () => {
    await renderAt("2026-09-23", "14:02");

    expect(
      screen.getAllByText(i18n.t("today.focus.until", { prayer: name("prayerTimes.asr") }), hidden)
        .length
    ).toBeGreaterThan(0);
    expect(
      screen.getByLabelText(
        i18n.t("a11y.today.untilSpoken", {
          prayer: name("prayerTimes.asr"),
          duration: i18n.t("a11y.today.durationBoth", {
            hours: i18n.t("common.hour", { count: 1 }),
            minutes: i18n.t("common.minute", { count: 18 }),
          }),
        })
      )
    ).toBeTruthy();
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

  // The prayer list names Friday's Dhuhr as Jumuah; the focus block agrees.
  it("names Dhuhr as Jumuah on a Friday", async () => {
    await renderAt("2026-09-25", "10:00");

    expect(screen.getByRole("togglebutton", { name: name("prayerTimes.jumuah") })).toBeTruthy();
  });

  it("shows nothing until the day's times are known", async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T14:02:00.000Z") });
    usePrayerTimesStore.setState({
      yesterdayTimings: null,
      todayTimings: null,
      tomorrowTimings: null,
    });
    await renderWithTheme(<FocusCountdown />);

    expect(screen.toJSON()).toBeNull();
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
});
