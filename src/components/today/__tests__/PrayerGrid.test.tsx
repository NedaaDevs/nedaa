import { Component } from "react";
import { screen, userEvent } from "@testing-library/react-native";

import config from "../../../../tamagui.config";
import { PrayerGrid } from "@/components/today/PrayerGrid";
import { OTHER_TIMING, PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { renderWithTheme } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { formatPrayerTime } from "@/utils/date";
import { controlProblems } from "@/test-helpers/controls";
import { fontSizeOf, styleOf } from "@/test-helpers/text";

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

const renderAt = (date: string, time: string, props: { selected?: PrayerId } = {}) => {
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

  // The next prayer leads; the others follow in the day's order.
  it("leads with the next prayer, saying so, then the rest in order", async () => {
    const { rendered } = renderAt("2026-09-23", "14:02");
    await rendered;

    expect(cards()).toEqual([
      label("2026-09-23", PRAYER_ID.ASR, true),
      label("2026-09-23", PRAYER_ID.FAJR),
      label("2026-09-23", PRAYER_ID.DHUHR),
      label("2026-09-23", PRAYER_ID.MAGHRIB),
      label("2026-09-23", PRAYER_ID.ISHA),
    ]);
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

    expect(cards()[0]).toBe(
      label("2026-09-25", PRAYER_ID.DHUHR, true, i18n.t("prayerTimes.jumuah"))
    );
  });

  it("leads with tomorrow's Fajr, at tomorrow's time, once Isha is in", async () => {
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

    expect(cards()[0]).toBe(label("2026-09-23", PRAYER_ID.ISHA));
  });

  it("shows nothing until the day's times are known", async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T14:02:00.000Z") });
    usePrayerTimesStore.setState({
      yesterdayTimings: null,
      todayTimings: null,
      tomorrowTimings: null,
    });
    await renderWithTheme(<PrayerGrid onSelect={jest.fn()} />);

    expect(screen.toJSON()).toBeNull();
  });

  // The wide card and a half-width one share the stacked layout.
  it.each([PRAYER_ID.ASR, PRAYER_ID.FAJR])("sets %s's time under its name", async (id) => {
    await renderAt("2026-09-23", "14:02").rendered;
    const named = screen.getByText(i18n.t(`prayerTimes.${id}`));
    const time = screen.getByText(timeOf("2026-09-23", id));
    const column = named.parent;

    expect(column).toHaveStyle({ flexDirection: "column" });
    expect(column?.children.indexOf(named)).toBe(0);
    expect(column?.children.indexOf(time)).toBe(1);
    expect(named).toHaveStyle({ fontSize: fontSizeOf("lg") });
    expect(time).toHaveStyle({ fontSize: fontSizeOf("lg") });
  });

  // A long name at a large text size wraps and the card grows.
  it("lets a long name wrap, never truncating", async () => {
    await renderAt("2026-09-23", "14:02").rendered;

    for (const id of [PRAYER_ID.ASR, PRAYER_ID.FAJR]) {
      expect(screen.getByText(i18n.t(`prayerTimes.${id}`)).props.numberOfLines).toBeUndefined();
    }
  });

  it("gives each card the height of its two lines", async () => {
    await renderAt("2026-09-23", "14:02").rendered;
    const card = styleOf(screen.getByRole("button", { name: label("2026-09-23", PRAYER_ID.FAJR) }));
    const named = styleOf(screen.getByText(i18n.t(`prayerTimes.${PRAYER_ID.FAJR}`)));
    const time = styleOf(screen.getByText(timeOf("2026-09-23", PRAYER_ID.FAJR)));

    expect(card.minHeight).toBe(config.tokens.size[16].val);
    expect(card.minHeight).toBeGreaterThanOrEqual(
      Number(card.paddingTop) +
        Number(named.lineHeight) +
        Number(time.lineHeight) +
        Number(card.paddingBottom)
    );
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    await renderAt("2026-09-23", "14:02").rendered;

    expect(controlProblems()).toEqual([]);
  });
});
