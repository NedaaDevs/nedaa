// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import SettingsScreen from "@/app/(tabs)/settings";
import { AppState, Linking, Platform, Share, Text, type AppStateStatus } from "react-native";
import * as Clipboard from "expo-clipboard";
import { usePathname } from "expo-router";
import { act, userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";
import { withTiming } from "react-native-reanimated";

import { LIST_ROW_PART } from "@/components/ui/list-row";
import { SKY_PART } from "@/components/ui/sky-background";
import { BACK_DESTINATION, type BackDestination } from "@/constants/BackDestinations";
import { SETTINGS_LAYOUT, SETTINGS_ROW } from "@/constants/SettingsRoot";
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { STORE_LINKS } from "@/constants/StoreLinks";
import { AppLocale, AppMode, PlatformType, TextSize } from "@/enums/app";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import i18n from "@/localization/i18n";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { useNotificationStore } from "@/stores/notification";
import { usePreferencesStore } from "@/stores/preferences";
import { useProviderSettingsStore } from "@/stores/providerSettings";
import { useToastStore } from "@/stores/toast";
import { controlProblems } from "@/test-helpers/controls";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useAlarmSupported", () => ({ useAlarmSupported: () => true }));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: jest.fn(() => false) }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

/** Every place a root row leads, so a press lands on a real route. */
const DESTINATIONS: readonly BackDestination[] = [
  BACK_DESTINATION.SETTINGS_PREFERENCES,
  BACK_DESTINATION.SETTINGS_THEME,
  BACK_DESTINATION.SETTINGS_LANGUAGE,
  BACK_DESTINATION.SETTINGS_LOCATION,
  BACK_DESTINATION.SETTINGS_PROVIDER,
  BACK_DESTINATION.SETTINGS_HIJRI,
  BACK_DESTINATION.SETTINGS_NOTIFICATION,
  BACK_DESTINATION.SETTINGS_ALARM,
  BACK_DESTINATION.SETTINGS_ATHKAR,
  BACK_DESTINATION.SETTINGS_WIDGETS,
  BACK_DESTINATION.SETTINGS_ABOUT,
];

const renderSettings = () =>
  renderRouter(
    {
      [BACK_DESTINATION.SETTINGS.route]: () => (
        <>
          <SettingsScreen />
          <Pathname />
        </>
      ),
      ...Object.fromEntries(DESTINATIONS.map(({ route }) => [route, () => <Pathname />])),
    },
    {
      initialUrl: BACK_DESTINATION.SETTINGS.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A row reads as its title, then its summary when it has one. */
const row = (titleKey: string) =>
  screen.getByRole("button", { name: new RegExp(`^${escape(i18n.t(titleKey))}(, |$)`) });

const labelOf = (titleKey: string) => row(titleKey).props.accessibilityLabel as string;

const summaryOf = (titleKey: string) => labelOf(titleKey).slice(i18n.t(titleKey).length + 2);

type Row = readonly [titleKey: string, destination: BackDestination];

/** The sections as drawn: each label, then its rows by title. */
const LAYOUT: readonly { labelKey: string; rows: readonly Row[] }[] = [
  {
    labelKey: "settings.sections.mostUsed",
    rows: [
      ["settings.preferences.title", BACK_DESTINATION.SETTINGS_PREFERENCES],
      ["settings.appearance", BACK_DESTINATION.SETTINGS_THEME],
      ["settings.language", BACK_DESTINATION.SETTINGS_LANGUAGE],
    ],
  },
  {
    labelKey: "settings.sections.place",
    rows: [
      ["settings.location.title", BACK_DESTINATION.SETTINGS_LOCATION],
      ["providers.aladhan.method.title", BACK_DESTINATION.SETTINGS_PROVIDER],
      ["settings.rows.hijri", BACK_DESTINATION.SETTINGS_HIJRI],
    ],
  },
  {
    labelKey: "settings.sections.alerts",
    rows: [
      ["settings.notification.title", BACK_DESTINATION.SETTINGS_NOTIFICATION],
      ["alarm.settings.title", BACK_DESTINATION.SETTINGS_ALARM],
      ["settings.athkar.title", BACK_DESTINATION.SETTINGS_ATHKAR],
    ],
  },
  {
    labelKey: "settings.sections.device",
    rows: [["settings.widgets.title", BACK_DESTINATION.SETTINGS_WIDGETS]],
  },
  {
    labelKey: "brand.name",
    rows: [["settings.about.title", BACK_DESTINATION.SETTINGS_ABOUT]],
  },
];

const ROWS: readonly Row[] = LAYOUT.flatMap(({ rows }) => rows);

/** Captures AppState listeners: what is live, and a way back to the app. */
const appStateListeners = () => {
  const live = new Set<(state: AppStateStatus) => void>();
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
    live.add(handler);
    return { remove: () => live.delete(handler) };
  });
  return {
    live,
    returnToApp: () =>
      act(async () => {
        [...live].forEach((handler) => handler("active"));
      }),
  };
};

const initialNotifications = useNotificationStore.getState();
const initialAlarms = useAlarmSettingsStore.getState();
const initialProvider = useProviderSettingsStore.getState();
const initialLocation = useLocationStore.getState();
const aladhanId = PRAYER_TIME_PROVIDERS.ALADHAN.id;

beforeEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.mocked(useReducedMotion).mockReturnValue(false);
  jest.mocked(withTiming).mockClear();
  useAppStore.setState({ locale: AppLocale.EN, mode: AppMode.SYSTEM, hijriDaysOffset: 0 });
  useLocationStore.setState({
    localizedLocation: { city: "Riyadh", country: "Saudi Arabia" },
    locationDetails: initialLocation.locationDetails,
  });
  useNotificationStore.setState({
    settings: initialNotifications.settings,
    morningNotification: initialNotifications.morningNotification,
    eveningNotification: initialNotifications.eveningNotification,
  });
  useAlarmSettingsStore.setState({ fajr: initialAlarms.fajr, friday: initialAlarms.friday });
  useProviderSettingsStore.setState({ allSettings: initialProvider.allSettings });
  usePreferencesStore.setState({ use24HourTime: true, textSize: TextSize.DEFAULT });
  useToastStore.setState({ toast: null });
});

describe("Settings root", () => {
  it("draws the sky behind its content", async () => {
    await renderSettings();

    expect(screen.getAllByTestId(SKY_PART.CANVAS, { includeHiddenElements: true }).length).toBe(1);
  });

  it("labels its five sections in order", async () => {
    await renderSettings();
    const labels = LAYOUT.map(({ labelKey }) => i18n.t(labelKey));

    const headers = screen
      .getAllByRole("header")
      .map((node) => node.props.children)
      .filter((text) => labels.includes(text));

    expect(headers).toEqual(labels);
  });

  it("draws the rows in the order the design gives", async () => {
    await renderSettings();
    const titles = ROWS.map(([key]) => i18n.t(key));

    const drawn = screen
      .getAllByRole("button")
      .map((node) => String(node.props.accessibilityLabel))
      .map((label) => titles.find((title) => label === title || label.startsWith(`${title}, `)))
      .filter(Boolean);

    expect(drawn).toEqual(titles);
  });

  it("sets every row's icon on a tinted tile", async () => {
    await renderSettings();

    expect(screen.getAllByTestId(LIST_ROW_PART.TILE, { includeHiddenElements: true })).toHaveLength(
      ROWS.length
    );
  });

  it.each(ROWS)("opens %s", async (titleKey, destination) => {
    await renderSettings();

    await userEvent.press(row(titleKey));

    expect(screen.getByTestId("pathname")).toHaveTextContent(normalizeRoutePath(destination.href));
  });

  it.each(ROWS)("tells a screen reader where %s leads", async (titleKey) => {
    await renderSettings();

    expect(row(titleKey).props.accessibilityHint).toBe(
      i18n.t("a11y.opens", { name: i18n.t(titleKey) })
    );
  });

  it.each([
    "settings.advance.title",
    "notification.customSound.title",
    "settings.help.title",
    "settings.acknowledgements.title",
    "whatsNew.title",
  ])("leaves %s off the root", async (key) => {
    await renderSettings();

    expect(
      screen.queryByRole("button", { name: new RegExp(`^${escape(i18n.t(key))}`) })
    ).toBeNull();
  });

  // Malay has no Athkar texts, so its settings would lead nowhere.
  it("leaves Athkar off in a locale without Athkar", async () => {
    useAppStore.setState({ locale: AppLocale.MS });
    await renderSettings();

    expect(
      screen.queryByRole("button", {
        name: new RegExp(`^${escape(i18n.t("settings.athkar.title"))}`),
      })
    ).toBeNull();
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    await renderSettings();

    expect(controlProblems()).toEqual([]);
  });

  it("places every row in exactly one section", () => {
    const placed = SETTINGS_LAYOUT.flatMap(({ rows }) => rows);

    expect([...placed].sort()).toEqual(Object.values(SETTINGS_ROW).sort());
  });
});

describe("Settings root summaries", () => {
  it("names the clock and the text size under Preferences", async () => {
    usePreferencesStore.setState({ use24HourTime: false, textSize: TextSize.LARGE });
    await renderSettings();

    expect(summaryOf("settings.preferences.title")).toBe(
      i18n.t("settings.summary.preferences", {
        clock: i18n.t("settings.summary.clock12"),
        size: i18n.t("settings.textSize.options.large"),
      })
    );
  });

  it("names 24-hour time in the summary's own words", async () => {
    usePreferencesStore.setState({ use24HourTime: true, textSize: TextSize.DEFAULT });
    await renderSettings();

    expect(summaryOf("settings.preferences.title")).toBe(
      i18n.t("settings.summary.preferences", {
        clock: i18n.t("settings.summary.clock24"),
        size: i18n.t("settings.textSize.options.default"),
      })
    );
  });

  it("names the appearance mode", async () => {
    useAppStore.setState({ mode: AppMode.DARK });
    await renderSettings();

    expect(summaryOf("settings.appearance")).toBe(i18n.t("settings.themes.dark.title"));
  });

  it("names the language in its own words", async () => {
    await renderSettings();

    expect(summaryOf("settings.language")).toBe(i18n.t("settings.languages.en.nativeTitle"));
  });

  it("names the place as More does", async () => {
    await renderSettings();

    expect(summaryOf("settings.location.title")).toBe("Riyadh, Saudi Arabia");
  });

  it.each([
    ["the city alone", { city: "Riyadh", country: "" }, "Riyadh"],
    ["the country when no city is known", { city: "", country: "Saudi Arabia" }, "Saudi Arabia"],
  ])("names %s", async (_, localizedLocation, expected) => {
    useLocationStore.setState({ localizedLocation });
    await renderSettings();

    expect(summaryOf("settings.location.title")).toBe(expected);
  });

  // A place found but not yet named is set, so "not set" would be false.
  it("gives no summary to a place with no name yet", async () => {
    useLocationStore.setState({ localizedLocation: { city: "", country: "" } });
    await renderSettings();

    expect(labelOf("settings.location.title")).toBe(i18n.t("settings.location.title"));
  });

  it("names the chosen calculation method", async () => {
    useProviderSettingsStore.setState({
      allSettings: { [aladhanId]: { ...initialProvider.allSettings[aladhanId], method: 3 } },
    });
    await renderSettings();

    expect(summaryOf("providers.aladhan.method.title")).toBe(
      i18n.t("providers.aladhan.methods.mwl")
    );
  });

  it("says the method follows the place when none is chosen", async () => {
    await renderSettings();

    expect(summaryOf("providers.aladhan.method.title")).toBe(i18n.t("settings.summary.methodAuto"));
  });

  it.each([
    [0, "settings.hijri.date.adjustments.noAdjustment", {}],
    [2, "settings.hijri.date.adjustments.plusDays", { count: 2 }],
    [-1, "settings.hijri.date.adjustments.minusDays", { count: 1 }],
  ])("reads a Hijri offset of %i", async (offset, key, options) => {
    useAppStore.setState({ hijriDaysOffset: offset });
    await renderSettings();

    expect(summaryOf("settings.rows.hijri")).toBe(i18n.t(key, options));
  });

  it("says when every notification is off", async () => {
    useNotificationStore.setState({
      settings: { ...initialNotifications.settings, enabled: false },
    });
    await renderSettings();

    expect(summaryOf("settings.notification.title")).toBe(
      i18n.t("settings.summary.notificationsOff")
    );
  });

  it("says when all five prayers alert", async () => {
    await renderSettings();

    expect(summaryOf("settings.notification.title")).toBe(i18n.t("settings.summary.alertsAll"));
  });

  it("counts the prayers a per-prayer change leaves an alert on for", async () => {
    const { settings } = initialNotifications;
    useNotificationStore.setState({
      settings: {
        ...settings,
        overrides: {
          ...settings.overrides,
          fajr: { prayer: { enabled: false } },
          isha: { prayer: { enabled: false } },
        },
      },
    });
    await renderSettings();

    expect(summaryOf("settings.notification.title")).toBe(
      i18n.t("settings.summary.alerts", { count: 3 })
    );
  });

  it("names the alarms that are on, in More's words", async () => {
    useAlarmSettingsStore.setState({ fajr: { ...initialAlarms.fajr, enabled: true } });
    await renderSettings();

    expect(summaryOf("alarm.settings.title")).toBe(i18n.t("prayerTimes.fajr"));
  });

  it.each([
    [false, false, "settings.summary.athkar.off"],
    [true, false, "settings.summary.athkar.morning"],
    [false, true, "settings.summary.athkar.evening"],
    [true, true, "settings.summary.athkar.both"],
  ])("reads Athkar reminders morning=%s evening=%s", async (morning, evening, key) => {
    useNotificationStore.setState({
      morningNotification: { ...initialNotifications.morningNotification, enabled: morning },
      eveningNotification: { ...initialNotifications.eveningNotification, enabled: evening },
    });
    await renderSettings();

    expect(summaryOf("settings.athkar.title")).toBe(i18n.t(key));
  });

  // The scheduler sends no Athkar reminder while notifications are off.
  it("reads Athkar reminders as off while notifications are off", async () => {
    useNotificationStore.setState({
      settings: { ...initialNotifications.settings, enabled: false },
      morningNotification: { ...initialNotifications.morningNotification, enabled: true },
      eveningNotification: { ...initialNotifications.eveningNotification, enabled: true },
    });
    await renderSettings();

    expect(summaryOf("settings.athkar.title")).toBe(i18n.t("settings.summary.athkar.off"));
  });

  it("gives Widgets no summary", async () => {
    await renderSettings();

    expect(labelOf("settings.widgets.title")).toBe(i18n.t("settings.widgets.title"));
  });

  it("sums up About", async () => {
    await renderSettings();

    expect(summaryOf("settings.about.title")).toBe(i18n.t("settings.summary.about"));
  });
});

describe("Rate and Share", () => {
  const rate = () => screen.getByRole("button", { name: i18n.t("settings.rateApp") });
  const share = () => screen.getByRole("button", { name: i18n.t("settings.shareApp") });
  const thanks = () => screen.queryAllByRole("button", { name: i18n.t("settings.thankYou") });

  beforeEach(() => {
    jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction });
  });

  it("opens the store to rate, and thanks on the way back", async () => {
    const appState = appStateListeners();
    await renderSettings();

    await userEvent.press(rate());
    expect(Linking.openURL).toHaveBeenCalledWith(STORE_LINKS.iosReview);
    expect(thanks()).toHaveLength(0);

    await appState.returnToApp();

    expect(thanks()).toHaveLength(1);
  });

  it("waits for the way back only once the store has opened", async () => {
    let opened = (_: boolean) => {};
    jest.spyOn(Linking, "openURL").mockReturnValue(new Promise((resolve) => (opened = resolve)));
    const appState = appStateListeners();
    await renderSettings();
    const before = appState.live.size;

    await userEvent.press(rate());
    expect(appState.live.size).toBe(before);

    await act(async () => opened(true));

    expect(appState.live.size).toBe(before + 1);
  });

  it("does not wait for a return when the store cannot open", async () => {
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no store"));
    const appState = appStateListeners();
    await renderSettings();
    const before = appState.live.size;

    await userEvent.press(rate());

    expect(appState.live.size).toBe(before);
  });

  // Android has no review page to fall back from; the web listing stands in.
  it("waits for the way back from Android's fallback link", async () => {
    jest.replaceProperty(Platform, "OS", PlatformType.ANDROID);
    jest
      .spyOn(Linking, "openURL")
      .mockRejectedValueOnce(new Error("no Play Store"))
      .mockResolvedValueOnce(true);
    const appState = appStateListeners();
    await renderSettings();
    const before = appState.live.size;

    await userEvent.press(rate());

    expect(Linking.openURL).toHaveBeenLastCalledWith(STORE_LINKS.androidFallback);
    expect(appState.live.size).toBe(before + 1);
  });

  it("does not wait when Android's fallback link fails too", async () => {
    jest.replaceProperty(Platform, "OS", PlatformType.ANDROID);
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no browser"));
    const appState = appStateListeners();
    await renderSettings();
    const before = appState.live.size;

    await userEvent.press(rate());

    expect(appState.live.size).toBe(before);
  });

  it("waits for the way back with one listener however often Rate is pressed", async () => {
    const appState = appStateListeners();
    await renderSettings();
    // Other parts of the screen follow the app state too.
    const before = appState.live.size;

    await userEvent.press(rate());
    await userEvent.press(rate());

    expect(appState.live.size).toBe(before + 1);
  });

  it("stops waiting when the screen goes", async () => {
    const appState = appStateListeners();
    const { unmount } = await renderSettings();

    await userEvent.press(rate());
    await act(async () => unmount());

    expect(appState.live.size).toBe(0);
  });

  it("thanks once a share goes through", async () => {
    await renderSettings();

    await userEvent.press(share());

    expect(Share.share).toHaveBeenCalledWith({ message: i18n.t("settings.shareMessage") });
    expect(thanks()).toHaveLength(1);
  });

  it("does not thank a dismissed share", async () => {
    jest.mocked(Share.share).mockResolvedValue({ action: Share.dismissedAction });
    await renderSettings();

    await userEvent.press(share());

    expect(thanks()).toHaveLength(0);
  });

  it("returns to Rate once the thanks has shown", async () => {
    jest.useFakeTimers();
    const appState = appStateListeners();
    await renderSettings();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await user.press(rate());
    await appState.returnToApp();
    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    expect(thanks()).toHaveLength(0);
    expect(rate()).toBeTruthy();
  });

  it("copies the link on a long press of Share", async () => {
    await renderSettings();

    await userEvent.longPress(share());

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(STORE_LINKS.share);
    expect(useToastStore.getState().toast?.message).toBe(i18n.t("settings.linkCopied"));
  });

  it("shows nothing when the share sheet fails", async () => {
    jest.mocked(Share.share).mockRejectedValue(new Error("no sheet"));
    await renderSettings();

    await userEvent.press(share());

    expect(thanks()).toHaveLength(0);
  });

  it("confirms no copy when the clipboard fails", async () => {
    jest.mocked(Clipboard.setStringAsync).mockRejectedValueOnce(new Error("no clipboard"));
    await renderSettings();

    await userEvent.longPress(share());

    expect(useToastStore.getState().toast).toBeNull();
  });

  it("copies nothing on a long press of the thanks", async () => {
    await renderSettings();
    await userEvent.press(share());
    jest.mocked(Clipboard.setStringAsync).mockClear();

    await userEvent.longPress(thanks()[0]);

    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
  });

  it("tells a screen reader what each tile does", async () => {
    await renderSettings();

    expect(rate().props.accessibilityHint).toBe(i18n.t("a11y.settings.rateHint"));
    expect(share().props.accessibilityHint).toBe(i18n.t("a11y.settings.shareHint"));
  });

  it("animates the thanks in", async () => {
    await renderSettings();
    jest.mocked(withTiming).mockClear();

    await userEvent.press(share());

    expect(withTiming).toHaveBeenCalled();
  });

  // Reduce Motion lands the thanks at once rather than animating it faster.
  it("lands the thanks without animating under Reduce Motion", async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    await renderSettings();
    jest.mocked(withTiming).mockClear();

    await userEvent.press(share());

    expect(thanks()).toHaveLength(1);
    expect(withTiming).not.toHaveBeenCalled();
  });
});
