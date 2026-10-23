import { Component } from "react";
import { act, screen, userEvent, within } from "@testing-library/react-native";

import config from "../../../../tamagui.config";
import { PRAYER_GRID_PART, PrayerGrid } from "@/components/today/PrayerGrid";
import { GRID_PART } from "@/components/ui/grid";
import { ELEVATION } from "@/constants/Elevation";
import { PRAYER_CELL_HEIGHT } from "@/constants/PrayerCard";
import { OTHER_TIMING, PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { renderWithTheme } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { formatPrayerTime } from "@/utils/date";
import { spokenClockTime } from "@/utils/spokenClockTime";
import { controlProblems } from "@/test-helpers/controls";
import { fontSizeOf, styleOf } from "@/test-helpers/text";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const LIGHT = config.themes.light;
const hidden = { includeHiddenElements: true };

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
  props: { selected?: PrayerId; nextOnly?: boolean } = {}
) => {
  jest.useFakeTimers({ now: new Date(`${date}T${time}:00.000Z`) });
  usePrayerTimesStore.setState({
    yesterdayTimings: null,
    todayTimings: day(date),
    tomorrowTimings: null,
  });
  const onSelect = jest.fn();
  return { onSelect, rendered: renderWithTheme(<PrayerGrid onSelect={onSelect} {...props} />) };
};

const timeOf = (date: string, id: PrayerId) =>
  formatPrayerTime(day(date).timings[id], "UTC", { locale: AppLocale.EN, use24HourTime: false });
const label = (date: string, id: PrayerId, next = false, name = i18n.t(`prayerTimes.${id}`)) =>
  i18n.t(next ? "a11y.today.prayerCardNext" : "a11y.today.prayerCard", {
    prayer: name,
    time: timeOf(date, id),
  });
// jest's View mock hands a ref its component, props included.
const labelOf = (node: unknown) =>
  node instanceof Component && "accessibilityLabel" in node.props
    ? node.props.accessibilityLabel
    : undefined;
const cards = () => screen.getAllByRole("button").map((card) => card.props.accessibilityLabel);

describe("PrayerGrid", () => {
  beforeEach(() => {
    useAppStore.setState({ locale: AppLocale.EN });
    usePreferencesStore.setState({ use24HourTime: false, useWesternNumerals: true });
  });
  afterEach(() => jest.useRealTimers());

  // Five equal cells in the day's order; the next one says so.
  it("lists the five prayers in the day's order, naming the next", async () => {
    const { rendered } = renderAt("2026-09-23", "14:02");
    await rendered;

    expect(cards()).toEqual([
      label("2026-09-23", PRAYER_ID.FAJR),
      label("2026-09-23", PRAYER_ID.DHUHR),
      label("2026-09-23", PRAYER_ID.ASR, true),
      label("2026-09-23", PRAYER_ID.MAGHRIB),
      label("2026-09-23", PRAYER_ID.ISHA),
    ]);
  });

  it("gives every prayer an equal cell, none spanning the row", async () => {
    await renderAt("2026-09-23", "14:02").rendered;
    const cells = screen.getAllByTestId(GRID_PART.ITEM);

    expect(cells).toHaveLength(6);
    const widths = cells.map((cell) => JSON.stringify(styleOf(cell)));
    expect(new Set(widths).size).toBe(1);
  });

  it("reports a card pressed, and reads the chosen card as selected", async () => {
    const { onSelect, rendered } = renderAt("2026-09-23", "14:02", { selected: PRAYER_ID.MAGHRIB });
    await rendered;
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await user.press(screen.getByRole("button", { name: label("2026-09-23", PRAYER_ID.ISHA) }));

    expect(onSelect).toHaveBeenCalledWith(PRAYER_ID.ISHA, expect.anything());
    expect(
      screen.getByRole("button", { name: label("2026-09-23", PRAYER_ID.MAGHRIB) }).props
        .accessibilityState
    ).toMatchObject({ selected: true });
  });

  // The prayer sheet hands reader focus back to this card once it closes.
  it("hands over the pressed card itself, for focus to return to", async () => {
    const { onSelect, rendered } = renderAt("2026-09-23", "14:02");
    await rendered;
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await user.press(screen.getByRole("button", { name: label("2026-09-23", PRAYER_ID.ISHA) }));

    const [, opener] = onSelect.mock.lastCall ?? [];
    expect(labelOf(opener)).toBe(label("2026-09-23", PRAYER_ID.ISHA));
  });

  it("tells a screen reader that a card opens its prayer's sheet", async () => {
    await renderAt("2026-09-23", "14:02").rendered;

    for (const card of screen.getAllByRole("button")) {
      expect(card.props.accessibilityHint).toBe(i18n.t("a11y.today.prayerCardHint"));
    }
  });

  it("names Dhuhr as Jumuah on a Friday", async () => {
    const { rendered } = renderAt("2026-09-25", "10:00");
    await rendered;

    expect(cards()[1]).toBe(
      label("2026-09-25", PRAYER_ID.DHUHR, true, i18n.t("prayerTimes.jumuah"))
    );
  });

  it("shows tomorrow's Fajr, at tomorrow's time, once Isha is in", async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T22:00:00.000Z") });
    usePrayerTimesStore.setState({
      yesterdayTimings: null,
      todayTimings: day("2026-09-23"),
      tomorrowTimings: day("2026-09-24"),
    });
    await renderWithTheme(<PrayerGrid onSelect={jest.fn()} />);

    expect(cards()[0]).toBe(label("2026-09-24", PRAYER_ID.FAJR, true));
  });

  it("calls nothing next once Isha is in, with no tomorrow stored", async () => {
    const { rendered } = renderAt("2026-09-23", "22:00");
    await rendered;

    expect(cards()[4]).toBe(label("2026-09-23", PRAYER_ID.ISHA));
    expect(cards()).not.toContain(label("2026-09-23", PRAYER_ID.ISHA, true));
  });

  it("shows nothing until the day's times are known", async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T14:02:00.000Z") });
    usePrayerTimesStore.setState({
      yesterdayTimings: null,
      todayTimings: null,
      tomorrowTimings: null,
    });
    await renderWithTheme(<PrayerGrid onSelect={jest.fn()} />);

    expect(screen.root).toBeEmptyElement();
  });

  // A half-width cell cannot hold a name beside its time, so they stack.
  it.each([PRAYER_ID.ASR, PRAYER_ID.FAJR])("stacks %s's name over its time", async (id) => {
    await renderAt("2026-09-23", "14:02").rendered;
    const named = screen.getByText(i18n.t(`prayerTimes.${id}`));
    const time = screen.getByText(timeOf("2026-09-23", id));
    const column = named.parent;

    expect(time.parent).toBe(column);
    expect(column).not.toHaveStyle({ flexDirection: "row" });
    expect(column?.children.indexOf(named)).toBeLessThan(column?.children.indexOf(time) ?? -1);
    expect(named).toHaveStyle({ fontSize: fontSizeOf("md") });
    expect(time).toHaveStyle({ fontSize: fontSizeOf("label") });
  });

  // A long name at a large text size wraps and the card grows.
  it("lets a long name wrap, never truncating", async () => {
    await renderAt("2026-09-23", "14:02").rendered;

    for (const id of [PRAYER_ID.ASR, PRAYER_ID.FAJR]) {
      const named = screen.getByText(i18n.t(`prayerTimes.${id}`));
      expect(named.props.numberOfLines).toBeUndefined();
      expect(named.parent).toHaveStyle({ flex: 1 });
    }
  });

  it("gives each card the cell height, room for its name and time", async () => {
    await renderAt("2026-09-23", "14:02").rendered;
    const card = styleOf(screen.getByRole("button", { name: label("2026-09-23", PRAYER_ID.FAJR) }));
    const named = styleOf(screen.getByText(i18n.t(`prayerTimes.${PRAYER_ID.FAJR}`)));
    const time = styleOf(screen.getByText(timeOf("2026-09-23", PRAYER_ID.FAJR)));

    expect(card.minHeight).toBe(PRAYER_CELL_HEIGHT);
    expect(card.minHeight).toBeGreaterThanOrEqual(
      Number(card.paddingTop) +
        Number(named.lineHeight) +
        Number(time.lineHeight) +
        Number(card.paddingBottom)
    );
  });

  it("tints the next card, lifts it on an accent glow and rings it inside", async () => {
    await renderAt("2026-09-23", "14:02").rendered;
    const card = screen.getByRole("button", { name: label("2026-09-23", PRAYER_ID.ASR, true) });
    const next = styleOf(card);

    expect(next.backgroundColor).toBe(LIGHT.accentSoft.val);
    expect(String(next.boxShadow)).toContain(LIGHT.accentGlow.val);
    expect(styleOf(within(card).getByTestId(PRAYER_GRID_PART.RING, hidden))).toMatchObject({
      borderTopWidth: 1,
      borderTopColor: LIGHT.accentRing.val,
    });
  });

  // Passed and later cards share the quiet surface; a passed one reads muted.
  it("draws a passed card on the quiet surface with no lift, its words muted", async () => {
    await renderAt("2026-09-23", "14:02").rendered;
    const past = styleOf(screen.getByRole("button", { name: label("2026-09-23", PRAYER_ID.FAJR) }));

    expect(past.backgroundColor).toBe(LIGHT.surfaceQuiet.val);
    expect(past.boxShadow).toBeUndefined();
    expect(screen.getByText(i18n.t("prayerTimes.fajr"))).toHaveStyle({
      color: LIGHT.mutedSky.val,
    });
  });

  it("rests a later card on the quiet surface with a lit edge and no lift", async () => {
    await renderAt("2026-09-23", "14:02").rendered;
    const later = screen.getByRole("button", { name: label("2026-09-23", PRAYER_ID.ISHA) });

    expect(styleOf(later).backgroundColor).toBe(LIGHT.surfaceQuiet.val);
    expect(styleOf(later).boxShadow).not.toBe(ELEVATION.e1.boxShadow.light);
    expect(styleOf(later).boxShadow).toBeUndefined();
    expect(within(later).getAllByTestId(/highlight/, hidden).length).toBeGreaterThan(0);
  });

  // The ring is drawn over the card, so choosing one moves nothing.
  it("rings only the chosen card, the ring taking no room", async () => {
    await renderAt("2026-09-23", "14:02", { selected: PRAYER_ID.MAGHRIB }).rendered;
    const chosen = screen.getByRole("button", { name: label("2026-09-23", PRAYER_ID.MAGHRIB) });
    const other = screen.getByRole("button", { name: label("2026-09-23", PRAYER_ID.ISHA) });

    expect(styleOf(within(chosen).getByTestId(PRAYER_GRID_PART.RING, hidden))).toMatchObject({
      borderTopColor: LIGHT.accent.val,
      borderTopWidth: 2,
      position: "absolute",
    });
    expect(within(other).queryByTestId(PRAYER_GRID_PART.RING, hidden)).toBeNull();
    expect(styleOf(chosen).borderTopWidth).toBe(styleOf(other).borderTopWidth);
  });

  // Sunrise is no prayer: a quiet line in the sixth cell, not a card.
  describe("the sunrise cell", () => {
    const sunrise = () => screen.getByTestId(PRAYER_GRID_PART.SUNRISE);

    it("shows sunrise and its time at the quiet level", async () => {
      await renderAt("2026-09-23", "14:02").rendered;
      const time = formatPrayerTime(day("2026-09-23").otherTimings[OTHER_TIMING.SUNRISE], "UTC", {
        locale: AppLocale.EN,
        use24HourTime: false,
      });

      expect(screen.getByText(i18n.t("otherTimings.sunrise"))).toHaveStyle({
        color: LIGHT.mutedSky.val,
      });
      expect(screen.getByText(time)).toHaveStyle({ color: LIGHT.mutedSky.val });
    });

    // Quiet, not passed: before sunrise its time reads as still to come.
    it("draws sunrise's time as still to come before sunrise", async () => {
      await renderAt("2026-09-23", "03:00").rendered;
      const time = formatPrayerTime(day("2026-09-23").otherTimings[OTHER_TIMING.SUNRISE], "UTC", {
        locale: AppLocale.EN,
        use24HourTime: false,
      });

      expect(screen.getByText(time)).toHaveStyle({ color: LIGHT.fg.val });
      expect(screen.getByText(i18n.t("otherTimings.sunrise"))).toHaveStyle({
        color: LIGHT.mutedSky.val,
      });
    });

    it("reads as one line, not a control", async () => {
      await renderAt("2026-09-23", "14:02").rendered;
      const spoken = spokenClockTime(
        day("2026-09-23").otherTimings[OTHER_TIMING.SUNRISE],
        "UTC",
        { locale: AppLocale.EN, use24HourTime: false, western: true },
        i18n.t
      );

      expect(sunrise().props.accessible).toBe(true);
      expect(sunrise().props.accessibilityLabel).toBe(
        i18n.t("a11y.today.prayerCard", { prayer: i18n.t("otherTimings.sunrise"), time: spoken })
      );
      expect(sunrise().props.onResponderRelease).toBeUndefined();
      expect(styleOf(sunrise()).backgroundColor).toBeUndefined();
      expect(cards()).toHaveLength(5);
    });

    it("sits last, after Isha", async () => {
      await renderAt("2026-09-23", "14:02").rendered;
      const cells = screen.getAllByTestId(GRID_PART.ITEM);

      expect(cells.at(-1)).toContainElement(sunrise());
    });
  });

  // The Text size preview shows the one card that leads, alone.
  it("shows only the leading card when asked for the next alone", async () => {
    await renderAt("2026-09-23", "14:02", { nextOnly: true }).rendered;

    expect(cards()).toEqual([label("2026-09-23", PRAYER_ID.ASR, true)]);
    expect(screen.queryByTestId(PRAYER_GRID_PART.SUNRISE)).toBeNull();
    expect(screen.getByTestId(GRID_PART.ITEM)).toHaveStyle({ width: "100%" });
  });

  // Arabic speech rewrites clock digits, so labels speak the time in words.
  it("speaks an evening prayer's time as evening in Arabic", async () => {
    useAppStore.setState({ locale: AppLocale.AR });
    usePreferencesStore.setState({ useWesternNumerals: false });
    await act(() => i18n.changeLanguage(AppLocale.AR));
    try {
      await renderAt("2026-09-23", "14:02").rendered;

      const maghrib = cards().find((name: string) =>
        name.startsWith(i18n.t("prayerTimes.maghrib"))
      );
      expect(maghrib).toContain("السادسة و٥ دقائق مساءً");
      expect(screen.getByText("٦:٠٥ م")).toBeOnTheScreen();
    } finally {
      await act(() => i18n.changeLanguage(AppLocale.EN));
    }
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    await renderAt("2026-09-23", "14:02").rendered;

    expect(controlProblems()).toEqual([]);
  });
});
