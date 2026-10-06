// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import PreferencesScreen from "@/app/settings/preferences";
import { Text } from "react-native";
import { usePathname } from "expo-router";
import { act, userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { FOCUS_COUNTDOWN_PART } from "@/components/today/FocusCountdown";
import { SKY_PART } from "@/components/ui/sky-background";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { TAB_ITEMS } from "@/constants/TabBar";
import { AppLocale, OpeningTab, TextSize } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { usePreferencesStore } from "@/stores/preferences";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { controlProblems } from "@/test-helpers/controls";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";
import { LTR_ISOLATE } from "@/utils/digits";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const t = i18n.t.bind(i18n);
const hidden = { includeHiddenElements: true } as const;

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

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const LINKS = [BACK_DESTINATION.SETTINGS_TEXT_SIZE, BACK_DESTINATION.SETTINGS_PRIVACY] as const;

const renderPreferences = ({ isRTL = false } = {}) =>
  renderRouter(
    {
      [BACK_DESTINATION.SETTINGS_PREFERENCES.route]: () => (
        <>
          <PreferencesScreen />
          <Pathname />
        </>
      ),
      ...Object.fromEntries(LINKS.map((to) => [to.route, () => <Pathname />])),
    },
    {
      initialUrl: BACK_DESTINATION.SETTINGS_PREFERENCES.href as string,
      wrapper: ({ children }) => <ThemeProvider isRTL={isRTL}>{children}</ThemeProvider>,
    }
  );

const SECTIONS = [
  "settings.preferences.sections.prayerTime",
  "settings.preferences.sections.display",
  "settings.preferences.sections.start",
  "settings.preferences.sections.comfort",
  "settings.privacy.title",
] as const;

const SWITCHES = [
  "settings.preferences.seconds.title",
  "settings.preferences.haptics.title",
  "settings.preferences.importantDays.title",
  "settings.preferences.usageStats.title",
] as const;

const headers = () => screen.getAllByRole("header").map((node) => String(node.props.children));
const toggle = (key: string) => screen.getByRole("switch", { name: new RegExp(`^${t(key)}`) });
// The countdown ticks on fake timers, so presses advance them too.
const press = (element: Parameters<ReturnType<typeof userEvent.setup>["press"]>[0]) =>
  userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(element);
const radio = (key: string) => screen.getByRole("radio", { name: t(key) });

describe("Preferences", () => {
  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T14:02:00.000Z") });
    await act(() => i18n.changeLanguage(AppLocale.EN));
    useAppStore.setState({ locale: AppLocale.EN });
    usePreferencesStore.setState({
      showSeconds: true,
      use24HourTime: true,
      useWesternNumerals: false,
      openingTab: OpeningTab.HOME,
      hapticsEnabled: true,
      showImportantDaysOnHome: false,
      shareUsageStats: true,
      textSize: TextSize.LARGE,
    });
    usePrayerTimesStore.setState({
      yesterdayTimings: null,
      todayTimings: TODAY,
      tomorrowTimings: null,
    });
    useLocationStore.setState({
      locationDetails: { ...useLocationStore.getState().locationDetails, timezone: "UTC" },
    });
  });
  afterEach(() => jest.useRealTimers());

  it("draws the sky behind its content", async () => {
    await renderPreferences();

    expect(screen.getAllByTestId(SKY_PART.CANVAS, hidden)).toHaveLength(1);
  });

  it("heads the screen with its name", async () => {
    await renderPreferences();

    expect(screen.getByRole("header", { name: t("settings.preferences.title") })).toBeTruthy();
  });

  // The countdown the seconds switch changes, as Today draws it.
  it("shows Today's countdown above the settings", async () => {
    await renderPreferences();

    expect(screen.getByTestId(FOCUS_COUNTDOWN_PART.ROW)).toBeOnTheScreen();
  });

  it("groups the settings under their sections, in order", async () => {
    await renderPreferences();

    const names = SECTIONS.map((key) => t(key));
    expect(headers().filter((text) => names.includes(text))).toEqual(names);
  });

  it("puts each switch under its section", async () => {
    await renderPreferences();

    const names = [...SECTIONS, ...SWITCHES].map((key) => t(key));
    // A switch's name opens with its title; a summary may follow.
    const order = screen
      .getAllByRole(/^(header|switch)$/)
      .map((node) => String(node.props.accessibilityLabel ?? node.props.children))
      .map((label) => names.find((name) => label === name || label.startsWith(`${name}, `)))
      .filter(Boolean);
    expect(order).toEqual(
      [
        "settings.preferences.sections.prayerTime",
        "settings.preferences.seconds.title",
        "settings.preferences.sections.display",
        "settings.preferences.importantDays.title",
        "settings.preferences.sections.start",
        "settings.preferences.sections.comfort",
        "settings.preferences.haptics.title",
        "settings.privacy.title",
        "settings.preferences.usageStats.title",
      ].map((key) => t(key))
    );
  });

  it.each([
    ["settings.preferences.seconds.title", "showSeconds"],
    ["settings.preferences.haptics.title", "hapticsEnabled"],
    ["settings.preferences.importantDays.title", "showImportantDaysOnHome"],
    ["settings.preferences.usageStats.title", "shareUsageStats"],
  ] as const)("flips %s from its row", async (key, field) => {
    await renderPreferences();
    const before = usePreferencesStore.getState()[field];

    await press(toggle(key));

    expect(usePreferencesStore.getState()[field]).toBe(!before);
  });

  // The note under the group says what is counted; the switch keeps a short name.
  it("states what the usage stats count, without pointing back here", async () => {
    await renderPreferences();

    expect(
      screen.getByRole("switch", { name: t("settings.preferences.usageStats.title") })
    ).toBeOnTheScreen();
    expect(screen.getByText(t("settings.privacy.usage.what"))).toBeOnTheScreen();
    expect(screen.queryByText(new RegExp(t("settings.privacy.usage.where")))).toBeNull();
  });

  it("sets the clock from its choice", async () => {
    await renderPreferences();
    expect(radio("settings.preferences.clock.spoken.24h")).toBeSelected();

    await press(radio("settings.preferences.clock.spoken.12h"));

    expect(usePreferencesStore.getState().use24HourTime).toBe(false);
  });

  it("offers the numerals choice only where Arabic numerals exist", async () => {
    await renderPreferences();

    expect(
      screen.queryByRole("radio", { name: t("settings.preferences.numerals.spoken.western") })
    ).toBeNull();
  });

  describe("in Arabic", () => {
    beforeEach(async () => {
      await act(() => i18n.changeLanguage(AppLocale.AR));
      useAppStore.setState({ locale: AppLocale.AR });
    });
    afterEach(() => act(() => i18n.changeLanguage(AppLocale.EN)));

    it("sets the numerals from their choice", async () => {
      await renderPreferences();

      await press(radio("settings.preferences.numerals.spoken.western"));

      expect(usePreferencesStore.getState().useWesternNumerals).toBe(true);
    });

    // Each option shows the digits it names, whatever the preference is now.
    it("writes the Western option in Western digits", async () => {
      await renderPreferences({ isRTL: true });

      expect(screen.getByText(`${LTR_ISOLATE.OPEN}123${LTR_ISOLATE.CLOSE}`)).toBeOnTheScreen();
      expect(screen.getByText("١٢٣")).toBeOnTheScreen();
    });
  });

  it("offers the tab bar's tabs, in its order, to start on", async () => {
    await renderPreferences();

    const group = screen.getByLabelText(t("settings.preferences.openingTab.title"));
    const names = screen
      .getAllByRole("radio")
      .filter((option) => TAB_ITEMS.some((tab) => t(tab.title) === option.props.accessibilityLabel))
      .map((option) => option.props.accessibilityLabel);
    expect(group).toBeOnTheScreen();
    expect(names).toEqual(TAB_ITEMS.map((tab) => t(tab.title)));
  });

  it("drops Athkar where the locale has none", async () => {
    useAppStore.setState({ locale: AppLocale.MS });
    await renderPreferences();

    expect(screen.queryByRole("radio", { name: t("a11y.tab.athkar") })).toBeNull();
  });

  // A tab chosen where the bar had it opens on Home where the bar does not.
  it("shows Home as the opening tab where the chosen one is off the bar", async () => {
    useAppStore.setState({ locale: AppLocale.MS });
    usePreferencesStore.setState({ openingTab: OpeningTab.ATHKAR });
    await renderPreferences();

    expect(radio("a11y.tab.home")).toBeSelected();
    // The tile's own text, then the status beside the setting's name.
    expect(screen.getAllByText(t("a11y.tab.home"), hidden)).toHaveLength(2);
    expect(screen.queryByText(t("a11y.tab.athkar"), hidden)).toBeNull();
  });

  it("sets the opening tab from its choice", async () => {
    await renderPreferences();

    await press(radio("a11y.tab.quran"));

    expect(usePreferencesStore.getState().openingTab).toBe(OpeningTab.QURAN);
  });

  // The reader's controls are set in the Quran's own settings.
  it("has no reader-controls row", async () => {
    await renderPreferences();

    expect(screen.queryByRole("switch", { name: t("quran.settings.largeControls") })).toBeNull();
  });

  it("shows the text size chosen beside its row", async () => {
    await renderPreferences();

    expect(
      screen.getByRole("button", {
        name: t("a11y.join", {
          first: t("settings.textSize.title"),
          second: t(`settings.textSize.options.${TextSize.LARGE}`),
        }),
      })
    ).toBeOnTheScreen();
  });

  it.each(LINKS)("opens $route from its row", async (to) => {
    await renderPreferences();
    const row = screen.getByRole("button", { name: new RegExp(`^${t(to.title)}`) });

    expect(row.props.accessibilityHint).toBe(t("a11y.opens", { name: t(to.title) }));
    await press(row);

    expect(screen.getByTestId("pathname")).toHaveTextContent(normalizeRoutePath(to.href));
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    await renderPreferences();

    expect(controlProblems()).toEqual([]);
  });
});
