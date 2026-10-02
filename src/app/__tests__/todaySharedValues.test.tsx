import type { ReactNode } from "react";
import { act, screen, within } from "@testing-library/react-native";

import { LANGUAGE_HERO_PART, LanguageHero } from "@/components/settings/LanguageHero";
import { FocusCountdown } from "@/components/today/FocusCountdown";
import { TODAY_HEADER_PART, TodayHeader } from "@/components/today/TodayHeader";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePreferencesStore } from "@/stores/preferences";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { prayerNameKey } from "@/utils/prayerName";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
// hijri-native is a native module; Today's header reads the date from it.
jest.mock("@/utils/date", () => ({
  ...jest.requireActual("@/utils/date"),
  HijriNative: {
    fromTimestamp: () => ({ year: 1448, month: 4, day: 3 }),
    addDays: (date: { day: number }, days: number) => ({ ...date, day: date.day + days }),
  },
}));

/** 2026-09-25 is a Friday. */
const dayOn = (date: string): DayPrayerTimes => ({
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

const DAY_MS = 24 * 60 * 60 * 1000;

const nextDay = (date: string) =>
  new Date(Date.parse(`${date}T00:00:00.000Z`) + DAY_MS).toISOString().slice(0, 10);

const LOCALES = [AppLocale.EN, AppLocale.AR] as const;

/** Draws two surfaces side by side, so one state reaches both at once. */
const renderSideBySide = (surfaces: ReactNode) => renderWithTheme(<>{surfaces}</>);

const textsIn = (testID: string) =>
  within(screen.getByTestId(testID))
    .queryAllByText(/./)
    .map((node) => node.props.children);

const textOf = (testID: string) => screen.queryByTestId(testID)?.props.children;

const at = async (locale: AppLocale, moment: string) => {
  jest.useFakeTimers({ now: new Date(moment) });
  await act(() => i18n.changeLanguage(locale));
  useAppStore.setState({ locale });
  const date = moment.slice(0, 10);
  usePrayerTimesStore.setState({
    yesterdayTimings: null,
    todayTimings: dayOn(date),
    tomorrowTimings: dayOn(nextDay(date)),
  });
};

beforeEach(() => {
  usePreferencesStore.setState({ showSeconds: false, useWesternNumerals: true });
  useLocationStore.setState({
    locationDetails: { ...useLocationStore.getState().locationDetails, timezone: "UTC" },
  });
});

afterEach(async () => {
  jest.useRealTimers();
  await act(() => i18n.changeLanguage(AppLocale.EN));
});

const PLACES = [
  [
    "localized",
    { city: "الرياض", country: "السعودية" },
    { city: "Riyadh", country: "Saudi Arabia" },
    ["الرياض", "السعودية"],
  ],
  [
    "not yet localized",
    { city: "", country: "" },
    { city: "Riyadh", country: "Saudi Arabia" },
    ["Riyadh", "Saudi Arabia"],
  ],
  // The localized pair stays whole rather than borrow the address's country.
  [
    "localized city only",
    { city: "الرياض", country: "" },
    { city: "Riyadh", country: "Saudi Arabia" },
    ["الرياض"],
  ],
] as const;

describe("The user's place", () => {
  it.each(PLACES)(
    "reads alike on Today and the Language hero: %s",
    async (_, localized, address, shown) => {
      await at(AppLocale.EN, "2026-09-23T14:02:00.000Z");
      useLocationStore.setState({
        localizedLocation: localized,
        locationDetails: { ...useLocationStore.getState().locationDetails, address },
      });
      await renderSideBySide(
        <>
          <TodayHeader />
          <LanguageHero />
        </>
      );

      const hero = [textOf(LANGUAGE_HERO_PART.CITY), textOf(LANGUAGE_HERO_PART.COUNTRY)].filter(
        Boolean
      );
      expect(hero).toEqual(shown);
      expect(textsIn(TODAY_HEADER_PART.PLACE)).toEqual(hero);
    }
  );
});

// Between prayers, inside a prayer's half hour, Friday's Dhuhr both ways, and
// past Isha, where the next is tomorrow's Fajr (Friday's Fajr on a Thursday).
const MOMENTS = LOCALES.flatMap((locale) =>
  [
    "2026-09-23T14:02:00.000Z",
    "2026-09-23T15:30:00.000Z",
    "2026-09-25T11:00:00.000Z",
    "2026-09-25T12:10:00.000Z",
    "2026-09-23T19:40:00.000Z",
    "2026-09-23T21:00:00.000Z",
    "2026-09-24T21:00:00.000Z",
  ].map((moment) => [locale, moment] as const)
);

describe("The focus prayer's name", () => {
  it.each(MOMENTS)(
    "reads alike on Today and the Language hero in %s at %s",
    async (locale, moment) => {
      await at(locale, moment);
      await renderSideBySide(
        <>
          <FocusCountdown />
          <LanguageHero />
        </>
      );

      const today = screen.getByRole("togglebutton").props.accessibilityLabel;
      const chip = within(screen.getByTestId(LANGUAGE_HERO_PART.CHIP));
      expect(chip.getByText(today)).toBeOnTheScreen();
      const label = [i18n.t("today.focus.next"), i18n.t("today.focus.current")].find((text) =>
        screen.queryAllByText(text).some((node) => !chip.queryAllByText(text).includes(node))
      );
      expect(label).toBeDefined();
      expect(chip.getByText(String(label))).toBeOnTheScreen();
    }
  );
});

it("names Friday's Fajr as Fajr once Thursday's Isha has passed", async () => {
  await at(AppLocale.EN, "2026-09-24T21:00:00.000Z");
  await renderWithTheme(<LanguageHero />);

  const chip = within(screen.getByTestId(LANGUAGE_HERO_PART.CHIP));
  expect(chip.getByText(i18n.t(prayerNameKey(PRAYER_ID.FAJR, true)))).toBeOnTheScreen();
});
