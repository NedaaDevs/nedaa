// First: expo-router's testing library re-mocks Reanimated as it loads, and
// the screen must bind to the mock below, not to its empty one.
import HijriCalendar from "@/app/hijri-calendar";
import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, Text } from "react-native";
import { usePathname } from "expo-router";
import { act, userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { HIJRI_YEAR_MAX, HIJRI_YEAR_MIN, RAMADAN_MONTH } from "@/constants/Hijri";
import { HIJRI_CALENDAR_TEST_ID } from "@/constants/HijriCalendar";
import { AppLocale } from "@/enums/app";
import { SimulatedClockContext } from "@/hooks/useTodayClock";
import i18n, { I18N_NAMESPACE } from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { controlProblems } from "@/test-helpers/controls";
import { gregorianOf } from "@/test-helpers/hijriCalendarModel";
import { ThemeProvider } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
// hijri-native is a native module; the model gives every month a fixed length.
jest.mock("@/utils/date", () => ({
  ...jest.requireActual("@/utils/date"),
  HijriNative: jest.requireActual("@/test-helpers/hijriCalendarModel").hijriCalendarModel,
}));

const t = i18n.t.bind(i18n);
const SUNDAY = 0;
const SATURDAY = 6;
const JUMADA_THANI = 6;
const RAJAB = 7;
const DHUL_HIJJAH = 12;

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

/** Moves the rendered screen's clock, as midnight would. */
const clock = { set: (_now: Date) => {} };

const Clock = ({ start, children }: { start: Date; children: ReactNode }) => {
  const [now, setNow] = useState(start);
  useEffect(() => {
    clock.set = setNow;
  }, []);
  return <SimulatedClockContext value={now}>{children}</SimulatedClockContext>;
};

const renderAt = (now: Date, { isRTL = false } = {}) =>
  renderRouter(
    {
      [BACK_DESTINATION.HIJRI_CALENDAR.route]: () => (
        <>
          <HijriCalendar />
          <Pathname />
        </>
      ),
      [BACK_DESTINATION.SETTINGS_HIJRI.route]: () => <Pathname />,
    },
    {
      initialUrl: BACK_DESTINATION.HIJRI_CALENDAR.href as string,
      wrapper: ({ children }) => (
        <ThemeProvider isRTL={isRTL}>
          <Clock start={now}>{children}</Clock>
        </ThemeProvider>
      ),
    }
  );

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const monthName = (month: number) => t(`hijriMonths.${month - 1}`);
const marked = (mark: string, name: string) =>
  t("hijriCalendar.markedAs", { mark: t(mark), name: t(name) });
/** A day's button, by the start of its spoken name. */
const dayButton = (weekday: string, day: number, month: number) =>
  screen.getByRole("button", { name: new RegExp(`^${weekday} ${day} ${monthName(month)},`) });
const selectedDays = () => screen.queryAllByRole("button", { selected: true });
/** The one selected day's spoken name. */
const selectedLabel = () => {
  const [day] = selectedDays();
  expect(selectedDays()).toHaveLength(1);
  return day.props.accessibilityLabel as string;
};
const todayAction = () => screen.queryByRole("button", { name: t("a11y.hijriCalendar.today") });

/** 14 Jumada al-Thani 1448, a Tuesday and a White Day. */
const TODAY = gregorianOf(1448, JUMADA_THANI, 14);
/** The model's Jumada al-Thani runs 29 days. */
const MONTH_END = gregorianOf(1448, JUMADA_THANI, 29);
const NEXT_MONTH_START = gregorianOf(1448, RAJAB, 1);

describe("Hijri calendar", () => {
  beforeEach(() => {
    useAppStore.setState({ locale: AppLocale.EN, hijriDaysOffset: 0 });
    usePreferencesStore.setState({ weekStartsOn: SUNDAY });
  });
  afterEach(() => act(() => i18n.changeLanguage(AppLocale.EN)));

  it("opens on today's month with today selected and its detail shown", async () => {
    await renderAt(TODAY);

    expect(screen.getByRole("header", { name: monthName(JUMADA_THANI) })).toBeTruthy();
    expect(dayButton("Tuesday", 14, JUMADA_THANI).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(selectedDays()).toHaveLength(1);
    expect(
      screen.getByText(
        t("hijriCalendar.dayTitle", {
          weekday: "Tuesday",
          day: "14",
          month: monthName(JUMADA_THANI),
          year: t("hijriCalendar.yearAh", { year: "1448" }),
        })
      )
    ).toBeTruthy();
    expect(screen.getByText(t("hijriCalendar.observances.whiteDays"))).toBeTruthy();
    expect(screen.queryByRole("button", { name: t("a11y.hijriCalendar.today") })).toBeNull();
    expect(controlProblems()).toEqual([]);
  });

  it("selects nothing in another month and comes back to today", async () => {
    await renderAt(TODAY);

    await userEvent.press(screen.getByRole("button", { name: t("a11y.hijriCalendar.nextMonth") }));

    expect(screen.getByRole("header", { name: monthName(JUMADA_THANI + 1) })).toBeTruthy();
    expect(selectedDays()).toHaveLength(0);
    expect(screen.queryByText(t("hijriCalendar.nothingMarked"))).toBeNull();

    await userEvent.press(screen.getByRole("button", { name: t("a11y.hijriCalendar.today") }));

    expect(dayButton("Tuesday", 14, JUMADA_THANI).props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it("shows the day a reader picks", async () => {
    await renderAt(TODAY);

    await userEvent.press(dayButton("Wednesday", 1, JUMADA_THANI));

    expect(dayButton("Wednesday", 1, JUMADA_THANI).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(selectedDays()).toHaveLength(1);
    expect(screen.getByText(t("hijriCalendar.nothingMarked"))).toBeTruthy();
  });

  it("drops a pick when midnight turns the month and selects the new today", async () => {
    await renderAt(MONTH_END);
    await userEvent.press(dayButton("Tuesday", 28, JUMADA_THANI));

    await act(() => clock.set(NEXT_MONTH_START));

    expect(screen.getByRole("header", { name: monthName(RAJAB) })).toBeTruthy();
    expect(selectedLabel()).toMatch(new RegExp(` 1 ${monthName(RAJAB)},`));
  });

  it("shows today once today moves into the month on screen", async () => {
    await renderAt(MONTH_END);
    await userEvent.press(screen.getByRole("button", { name: t("a11y.hijriCalendar.nextMonth") }));
    expect(todayAction()).toBeTruthy();

    await act(() => clock.set(NEXT_MONTH_START));

    expect(selectedLabel()).toMatch(new RegExp(` 1 ${monthName(RAJAB)},`));
    expect(todayAction()).toBeNull();
  });

  it("opens at the table's first month when the clock is before it", async () => {
    await renderAt(gregorianOf(HIJRI_YEAR_MIN - 1, JUMADA_THANI, 1));

    expect(screen.getByRole("header", { name: monthName(1) })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: t("a11y.hijriCalendar.nextMonth") }).props
        .accessibilityState
    ).toMatchObject({ disabled: false });
    expect(
      screen.getByText(
        t("hijriCalendar.rangeStart", {
          year: t("hijriCalendar.yearAh", { year: String(HIJRI_YEAR_MIN) }),
        })
      )
    ).toBeTruthy();
    expect(selectedDays()).toHaveLength(0);
    expect(todayAction()).toBeNull();
  });

  it("says the month's span in words", async () => {
    await renderAt(TODAY);

    expect(
      screen.getByLabelText(
        t("a11y.join", {
          first: t("a11y.hijriCalendar.yearAh", { year: "1448" }),
          second: t("a11y.hijriCalendar.monthSpan", { from: "November", to: "December 2026" }),
        })
      )
    ).toBeTruthy();
  });

  it("announces a picked day once, and not the day it opens on", async () => {
    // React Native's test setup already mocks it, so earlier tests' calls count.
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockClear();
    await renderAt(TODAY);
    expect(announce).not.toHaveBeenCalled();

    await userEvent.press(dayButton("Wednesday", 1, JUMADA_THANI));

    expect(announce).toHaveBeenCalledTimes(1);
    const [said] = announce.mock.calls[0];
    expect(said).toContain(t("hijriCalendar.nothingMarked"));

    await userEvent.press(dayButton("Monday", 13, JUMADA_THANI));

    expect(announce).toHaveBeenCalledTimes(2);
    expect(announce.mock.calls[1][0]).not.toMatch(/\.\./);
  });

  it("names the weekly marks once, before the grid", async () => {
    await renderAt(TODAY);

    expect(
      screen.getByLabelText(
        t("a11y.sentences", {
          first: marked(
            "hijriCalendar.legend.recommendedFast",
            "hijriCalendar.observances.mondayThursday"
          ),
          second: marked("hijriCalendar.legend.blessedDay", "hijriCalendar.observances.friday"),
        })
      )
    ).toBeTruthy();
    for (const [mark, name] of [
      ["hijriCalendar.legend.recommendedFast", "hijriCalendar.observances.mondayThursday"],
      ["hijriCalendar.legend.blessedDay", "hijriCalendar.observances.friday"],
    ]) {
      expect(
        screen.queryAllByRole("button", {
          name: new RegExp(escapeRegExp(marked(mark, name))),
        })
      ).toHaveLength(0);
    }
  });

  it("drops the weekly fast in Ramadan and marks the last ten nights", async () => {
    await renderAt(gregorianOf(1448, RAMADAN_MONTH, 9));

    expect(
      screen.getByLabelText(
        marked("hijriCalendar.legend.blessedDay", "hijriCalendar.observances.friday")
      )
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: new RegExp(
          `21 ${monthName(RAMADAN_MONTH)},.*${marked("hijriCalendar.legend.nightWorship", "hijriCalendar.observances.ramadanLastTen")}`
        ),
      })
    ).toBeTruthy();
    expect(screen.queryByText(t("hijriCalendar.legend.recommendedFast"))).toBeNull();
  });

  it("lets Tashreeq clear the White Day on the 13th of Dhu al-Hijjah", async () => {
    await renderAt(gregorianOf(1448, DHUL_HIJJAH, 13));

    expect(screen.getByText(t("hijriCalendar.observances.ayyamAlTashreeq"))).toBeTruthy();
    expect(screen.queryByText(t("hijriCalendar.observances.whiteDays"))).toBeNull();
  });

  it("stops at the first month of the table", async () => {
    await renderAt(gregorianOf(HIJRI_YEAR_MIN, 1, 1));

    const previous = screen.getByRole("button", { name: t("a11y.hijriCalendar.previousMonth") });
    expect(previous.props.accessibilityState).toMatchObject({ disabled: true });
    expect(
      screen.getByText(
        t("hijriCalendar.rangeStart", {
          year: t("hijriCalendar.yearAh", { year: String(HIJRI_YEAR_MIN) }),
        })
      )
    ).toBeTruthy();
  });

  it("stops at the last month of the table", async () => {
    await renderAt(gregorianOf(HIJRI_YEAR_MAX, DHUL_HIJJAH, 1));

    const next = screen.getByRole("button", { name: t("a11y.hijriCalendar.nextMonth") });
    expect(next.props.accessibilityState).toMatchObject({ disabled: true });
    expect(
      screen.getByText(
        t("hijriCalendar.rangeEnd", {
          year: t("hijriCalendar.yearAh", { year: String(HIJRI_YEAR_MAX) }),
        })
      )
    ).toBeTruthy();
  });

  it("moves every date by the offset and leads to its setting", async () => {
    useAppStore.setState({ hijriDaysOffset: 1 });
    await renderAt(TODAY);

    expect(dayButton("Tuesday", 15, JUMADA_THANI).props.accessibilityLabel).toMatch(
      /, 24 November/
    );
    expect(dayButton("Tuesday", 15, JUMADA_THANI).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(
      screen.getByText(
        t("hijriCalendar.offsetLine", {
          value: t("settings.hijri.date.adjustments.plusDays", { count: 1 }),
        })
      )
    ).toBeTruthy();

    const change = screen.getByRole("button", { name: t("a11y.hijriCalendar.changeOffset") });
    expect(change.props.accessibilityHint).toBe(
      t("a11y.opens", { name: t(BACK_DESTINATION.SETTINGS_HIJRI.title) })
    );
    await userEvent.press(change);

    expect(screen.getByTestId("pathname").props.children).toBe(
      BACK_DESTINATION.SETTINGS_HIJRI.href
    );
  });

  it("hides the offset line when no offset is set", async () => {
    await renderAt(TODAY);

    expect(screen.queryByRole("button", { name: t("a11y.hijriCalendar.changeOffset") })).toBeNull();
  });

  // The renderer does not mirror, so logical order is what the props hold.
  it.each([
    [AppLocale.AR, "hijriMonthsInDate"],
    [AppLocale.UR, "hijriMonths"],
  ] as const)("writes a %s date with the month name from %s", async (locale, list) => {
    await act(() => i18n.changeLanguage(locale));
    useAppStore.setState({ locale });
    usePreferencesStore.setState({ useWesternNumerals: true });
    await renderAt(gregorianOf(1448, DHUL_HIJJAH, 20));

    const name = i18n.getResource(locale, I18N_NAMESPACE, list)[DHUL_HIJJAH - 1];
    expect(name).not.toBe(t(`hijriMonths.${DHUL_HIJJAH - 1}`, { lng: AppLocale.EN }));
    expect(screen.getByText(new RegExp(` 20 ${name} `))).toBeTruthy();
    expect(screen.getByRole("header", { name: t(`hijriMonths.${DHUL_HIJJAH - 1}`) })).toBeTruthy();
  });

  it("runs the Arabic week from Saturday in logical order", async () => {
    await act(() => i18n.changeLanguage(AppLocale.AR));
    useAppStore.setState({ locale: AppLocale.AR });
    usePreferencesStore.setState({ weekStartsOn: SATURDAY });
    await renderAt(TODAY, { isRTL: true });

    const names = t("weekdaysShort", { returnObjects: true }) as string[];
    const expected = Array.from({ length: 7 }, (_, i) => names[(SATURDAY + i) % 7]);
    const header = screen
      .getAllByTestId(HIJRI_CALENDAR_TEST_ID.WEEKDAY)
      .map((node) => node.props.children);
    expect(header).toEqual(expected);
    expect(controlProblems()).toEqual([]);
  });
});
