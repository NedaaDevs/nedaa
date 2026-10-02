// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import LanguageScreen from "@/app/settings/language";
import { StyleSheet } from "react-native";
import { act, userEvent, waitFor } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { LANGUAGE_HERO_PART } from "@/components/settings/LanguageHero";
import { SKY_PART } from "@/components/ui/sky-background";
import { SKY_HERO_ID } from "@/components/ui/sky-preview";
import { ThemeTransitionContext } from "@/components/ui/theme-transition/context";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { LANGUAGE_ORDER } from "@/constants/Locales";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { AppLocale, AppMode } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePreferencesStore } from "@/stores/preferences";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { controlProblems } from "@/test-helpers/controls";
import { ThemeProvider } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/utils/date", () => ({
  ...jest.requireActual("@/utils/date"),
  HijriNative: {
    fromTimestamp: () => ({ year: 1448, month: 4, day: 3 }),
    addDays: (date: { day: number }, days: number) => ({ ...date, day: date.day + days }),
  },
}));

/** Wednesday 23 September 2026. */
const TODAY: DayPrayerTimes = {
  date: 20260923,
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: "2026-09-23T04:30:00.000Z",
    [PRAYER_ID.DHUHR]: "2026-09-23T12:00:00.000Z",
    [PRAYER_ID.ASR]: "2026-09-23T15:20:00.000Z",
    [PRAYER_ID.MAGHRIB]: "2026-09-23T18:05:00.000Z",
    [PRAYER_ID.ISHA]: "2026-09-23T19:25:00.000Z",
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: "2026-09-23T05:50:00.000Z",
  } as DayPrayerTimes["otherTimings"],
};

const PLACE = { city: "Riyadh", country: "Saudi Arabia" };
const NO_PLACE = { city: "", country: "" };

const t = i18n.t.bind(i18n);

/** Records each change handed to the theme dissolve, then runs it. */
const mockTransition = jest.fn(async (fn: () => void | Promise<void>) => {
  await fn();
});

/** The locale the city lookup ran in, read when it was asked. */
const lookups: AppLocale[] = [];
const updateAddressTranslation = jest.fn(async () => {
  lookups.push(useAppStore.getState().locale);
  return true;
});

// The store's own setLocale syncs widgets through a dynamic import, which
// throws inside the Jest VM; this one changes the language the same way.
const setLocaleAction = jest.fn((locale: AppLocale) => {
  void i18n.changeLanguage(locale);
  useAppStore.setState({ locale });
});

const renderLanguage = () =>
  renderRouter(
    {
      [BACK_DESTINATION.SETTINGS_LANGUAGE.route]: () => (
        <ThemeTransitionContext value={mockTransition}>
          <LanguageScreen />
        </ThemeTransitionContext>
      ),
    },
    {
      initialUrl: BACK_DESTINATION.SETTINGS_LANGUAGE.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

/** A row's name: the language in the app's language, then its own name. */
const rowName = (code: AppLocale) => {
  const title = t(`settings.languages.${code}.title`);
  const native = t(`settings.languages.${code}.nativeTitle`);
  return native === title ? title : t("a11y.join", { first: title, second: native });
};

const labelled = (label: string, value: string) => t("a11y.labelled", { label, value });

const heroName = (...pairs: string[]) =>
  pairs.reduce((first, second) => t("a11y.sentences", { first, second }));

const setLocale = async (locale: AppLocale) => {
  await act(() => i18n.changeLanguage(locale));
  useAppStore.setState({ locale });
};

describe("Language", () => {
  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T14:02:00.000Z") });
    await setLocale(AppLocale.EN);
    useAppStore.setState({ mode: AppMode.LIGHT, setLocale: setLocaleAction });
    usePreferencesStore.setState({ showSeconds: false });
    usePrayerTimesStore.setState({
      yesterdayTimings: null,
      todayTimings: TODAY,
      tomorrowTimings: null,
    });
    useLocationStore.setState({
      localizedLocation: PLACE,
      locationDetails: { ...useLocationStore.getState().locationDetails, address: null },
      updateAddressTranslation,
    });
    mockTransition.mockClear();
    setLocaleAction.mockClear();
    updateAddressTranslation.mockClear();
    lookups.length = 0;
  });
  afterEach(async () => {
    jest.useRealTimers();
    await act(() => i18n.changeLanguage(AppLocale.EN));
  });

  it("draws the page sky once, the hero over it", async () => {
    await renderLanguage();

    expect(screen.getAllByTestId(SKY_PART.CANVAS, { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.queryAllByTestId(SKY_PART.PREVIEW, { includeHiddenElements: true })).toEqual([]);
    expect(screen.getByTestId(SKY_HERO_ID)).toBeOnTheScreen();
  });

  it("offers the four languages in the design's order, in a named group", async () => {
    await renderLanguage();

    // The group takes the visible heading's words as its name.
    const named = screen.getAllByLabelText(t("settings.languages.choose"));
    expect(named.map((node) => node.props.accessibilityRole)).toContain("radiogroup");
    expect(screen.getAllByRole("radio").map((row) => row.props.accessibilityLabel)).toEqual(
      [AppLocale.AR, AppLocale.EN, AppLocale.UR, AppLocale.MS].map(rowName)
    );
    expect(LANGUAGE_ORDER).toEqual([AppLocale.AR, AppLocale.EN, AppLocale.UR, AppLocale.MS]);
  });

  // The state says "selected"; the name does not say it again.
  it("marks the language in use by its state alone", async () => {
    await renderLanguage();

    expect(
      screen.getAllByRole("radio").map((row) => row.props.accessibilityState?.selected)
    ).toEqual([false, true, false, false]);
    expect(screen.getByRole("radio", { name: rowName(AppLocale.EN) })).toBeOnTheScreen();
  });

  // Each own name keeps its script's face under any interface language.
  it.each([
    [AppLocale.EN, "العربية", /^IBMPlexSansArabic/],
    [AppLocale.EN, "اردو", /^IBMPlexSansArabic/],
    [AppLocale.AR, "English", /^IBMPlexSans-/],
    [AppLocale.AR, "Bahasa Melayu", /^IBMPlexSans-/],
  ])("in %s, sets %s in its own script's face", async (locale, native, face) => {
    await setLocale(locale);
    await renderLanguage();

    const node = screen.getByText(native, { includeHiddenElements: true });
    expect(StyleSheet.flatten(node.props.style).fontFamily).toMatch(face);
  });

  it("shows a name once where it is the same in both languages", async () => {
    await setLocale(AppLocale.AR);
    await renderLanguage();

    const hidden = { includeHiddenElements: true } as const;
    expect(screen.getAllByText("العربية", hidden)).toHaveLength(1);
    expect(screen.getAllByText("اردو", hidden)).toHaveLength(1);
    expect(screen.getAllByRole("radio").map((row) => row.props.accessibilityLabel)).toEqual(
      LANGUAGE_ORDER.map(rowName)
    );
  });

  it("heads the list with the design's label", async () => {
    await renderLanguage();

    expect(screen.getByRole("header", { name: t("settings.languages.choose") })).toBeTruthy();
  });

  it("applies a language on tap, then looks up the city's name in it", async () => {
    await renderLanguage();

    await userEvent
      .setup({ advanceTimers: jest.advanceTimersByTime })
      .press(screen.getByRole("radio", { name: rowName(AppLocale.AR) }));

    await waitFor(() => expect(useAppStore.getState().locale).toBe(AppLocale.AR));
    expect(setLocaleAction).toHaveBeenCalledWith(AppLocale.AR);
    expect(i18n.language).toBe(AppLocale.AR);
    expect(lookups).toEqual([AppLocale.AR]);
  });

  // The whole screen changes as one picture: fonts, direction and words.
  it("applies a language through the theme dissolve", async () => {
    mockTransition.mockImplementationOnce(() => Promise.resolve());
    await renderLanguage();

    await userEvent
      .setup({ advanceTimers: jest.advanceTimersByTime })
      .press(screen.getByRole("radio", { name: rowName(AppLocale.UR) }));

    expect(mockTransition).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().locale).toBe(AppLocale.EN);
  });

  it("leaves the language in use alone when it is tapped again", async () => {
    await renderLanguage();

    await userEvent
      .setup({ advanceTimers: jest.advanceTimersByTime })
      .press(screen.getByRole("radio", { name: rowName(AppLocale.EN) }));

    expect(mockTransition).not.toHaveBeenCalled();
    expect(updateAddressTranslation).not.toHaveBeenCalled();
  });

  it("reads the hero as one element: the place, then the next prayer", async () => {
    await renderLanguage();

    expect(
      screen.getByLabelText(
        heroName(
          labelled(t("settings.languages.yourPlace"), t("place.name", PLACE)),
          labelled(t("today.focus.next"), t("prayerTimes.asr"))
        )
      )
    ).toHaveProp("accessible", true);
    expect(screen.getByTestId(LANGUAGE_HERO_PART.CITY)).toHaveTextContent(PLACE.city);
    expect(screen.getByTestId(LANGUAGE_HERO_PART.COUNTRY)).toHaveTextContent(PLACE.country);
  });

  // The chip names the prayer and draws no count.
  it("names the next prayer in a chip, with no figure", async () => {
    await renderLanguage();

    expect(screen.getByTestId(LANGUAGE_HERO_PART.CHIP)).toHaveTextContent(
      `${t("today.focus.next")}${t("prayerTimes.asr")}`
    );
    expect(screen.getByTestId(LANGUAGE_HERO_PART.CHIP)).toHaveStyle({
      borderTopColor: NEDAA_LIGHT.border.hex,
      alignSelf: "flex-start",
    });
  });

  // The localized city arrives after the switch and replaces the old one.
  it("updates the city in place when its new name lands", async () => {
    await renderLanguage();

    await act(() =>
      useLocationStore.setState({ localizedLocation: { city: "الرياض", country: "السعودية" } })
    );

    expect(screen.getByTestId(LANGUAGE_HERO_PART.CITY)).toHaveTextContent("الرياض");
  });

  it("keeps the chip alone before any place is known", async () => {
    useLocationStore.setState({ localizedLocation: NO_PLACE });
    await renderLanguage();

    expect(screen.queryByTestId(LANGUAGE_HERO_PART.CITY)).toBeNull();
    expect(screen.queryByText(t("settings.languages.yourPlace"))).toBeNull();
    expect(screen.getByTestId(LANGUAGE_HERO_PART.CHIP)).toBeOnTheScreen();
    const hero = screen.getByLabelText(labelled(t("today.focus.next"), t("prayerTimes.asr")));
    expect(StyleSheet.flatten(hero.props.style).minHeight).toBeUndefined();
  });

  it("drops the hero when it has neither a place nor a prayer", async () => {
    useLocationStore.setState({ localizedLocation: NO_PLACE });
    usePrayerTimesStore.setState({ todayTimings: null });
    await renderLanguage();

    expect(screen.queryByTestId(SKY_HERO_ID)).toBeNull();
    expect(screen.getAllByRole("radio")).toHaveLength(LANGUAGE_ORDER.length);
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    await renderLanguage();

    expect(controlProblems()).toEqual([]);
  });
});
