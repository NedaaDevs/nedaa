// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import AlarmSettings from "@/app/settings/alarm";
import { Platform, Text } from "react-native";
import { usePathname } from "expo-router";
import { act, userEvent } from "@testing-library/react-native";
import { renderRouter, screen, within } from "expo-router/testing-library";

import {
  ALARM_PERMISSION,
  ALARM_PERMISSION_TITLE_KEY,
  ALARM_SETTINGS_ROUTE,
  ALARM_TYPE,
  type AlarmPermissionId,
} from "@/constants/Alarm";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { E2E_ID } from "@/constants/E2E";
import { AppLocale, PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAlarmStore } from "@/stores/alarm";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useAlarmStreakStore } from "@/stores/alarmStreak";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePreferencesStore } from "@/stores/preferences";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { armFajr, fajrRecord } from "@/test-helpers/armedAlarm";
import { holdHydration } from "@/test-helpers/hydration";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";
import { readAlarmPermissions, type AlarmPermission } from "@/utils/alarmPermissions";
import { deviceTimeZone } from "@/utils/date";
import { spokenClockTime } from "@/utils/spokenClockTime";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("expo-alarm", () => ({ ...jest.requireActual("expo-alarm") }));
jest.mock("@/utils/alarmPermissions", () => ({
  ...jest.requireActual("@/utils/alarmPermissions"),
  readAlarmPermissions: jest.fn(),
  requestAlarmPermission: jest.fn(),
}));
jest.mock("@/utils/alarmReport", () => ({}));

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const renderScreen = () =>
  renderRouter(
    {
      [BACK_DESTINATION.SETTINGS_ALARM.route]: () => <AlarmSettings />,
      [BACK_DESTINATION.SETTINGS_CUSTOM_SOUNDS.route]: () => <Pathname />,
      [BACK_DESTINATION.SETTINGS_LOCATION.route]: () => <Pathname />,
      [ALARM_SETTINGS_ROUTE]: () => <Pathname />,
    },
    {
      initialUrl: BACK_DESTINATION.SETTINGS_ALARM.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

const customSounds = () =>
  screen.queryByRole("button", { name: i18n.t("notification.customSound.manage") });

const {
  NOTIFICATIONS: N,
  EXACT_ALARM: E,
  FULL_SCREEN: F,
  OVERLAY: O,
  BATTERY: B,
} = ALARM_PERMISSION;
const ANDROID = [N, E, F, O, B];

/** This device's Android items, these ones still missing. */
const missing = (...ids: AlarmPermissionId[]) =>
  jest.mocked(readAlarmPermissions).mockResolvedValue(
    ANDROID.map((id): AlarmPermission => ({
      id,
      granted: !ids.includes(id),
      canRequestInApp: false,
    }))
  );

const t = i18n.t.bind(i18n);
const pageTitle = (id: AlarmPermissionId) => t(ALARM_PERMISSION_TITLE_KEY[id]);
const reportProblem = () =>
  screen.findByRole("button", { name: t("alarm.settings.reportProblem") });
const notNow = () => screen.queryByRole("button", { name: t("common.notNow") });
/** `text` as a pattern that matches only itself. */
const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The list row that opens one alarm's page; its name starts with the title. */
const alarmRow = (title: string) =>
  screen.findByRole("button", { name: new RegExp(`^${literal(title)}, `) });
const DAY_MS = 24 * 60 * 60 * 1000;
/** Any emoji; a screen reader says each one by its long Unicode name. */
const EMOJI = /\p{Extended_Pictographic}/u;
/** Clock digits in either digit set, such as "1:05" or «١:٠٥». */
const CLOCK_DIGITS = /[0-9٠-٩]+:[0-9٠-٩]+/;

/** Two days out at 13:05 on the device's clock, an afternoon ring time. */
const afternoonRing = () => {
  const at = new Date(Date.now() + 2 * DAY_MS);
  at.setHours(13, 5, 0, 0);
  return at.getTime();
};

/** The ring time as the row should speak it, from the shared spoken clock. */
const spokenRing = (rings: number) => {
  const { use24HourTime, useWesternNumerals: western } = usePreferencesStore.getState();
  const locale = useAppStore.getState().locale;
  const day = new Date(rings).toLocaleDateString(i18n.language, { weekday: "long" });
  const time = spokenClockTime(
    new Date(rings),
    deviceTimeZone(),
    { locale, use24HourTime, western },
    t
  );
  return t("alarm.settings.firesAt", { day, time });
};

/** Runs `body` with the app in Arabic, then puts English back. */
const inArabic = async (western: boolean, body: () => Promise<void>) => {
  useAppStore.setState({ locale: AppLocale.AR });
  usePreferencesStore.setState({ use24HourTime: false, useWesternNumerals: western });
  await act(() => i18n.changeLanguage(AppLocale.AR));
  try {
    await body();
  } finally {
    useAppStore.setState({ locale: AppLocale.EN });
    await act(() => i18n.changeLanguage(AppLocale.EN));
  }
};

beforeEach(() => {
  jest.replaceProperty(Platform, "OS", PlatformType.ANDROID);
  usePrayerTimesStore.setState({ usingDefaultLocation: false });
  useAlarmStore.setState({ scheduledAlarms: {} });
  useAlarmSettingsStore.setState(useAlarmSettingsStore.getInitialState());
  useAlarmStreakStore.setState({ streak: 0 });
  usePreferencesStore.setState(usePreferencesStore.getInitialState());
  // Every permission granted, so the screen draws its alarms.
  jest.mocked(readAlarmPermissions).mockReset().mockResolvedValue([]);
});

describe("Alarm settings city gate", () => {
  it("asks for the city first while the times are the default location's", async () => {
    usePrayerTimesStore.setState({ usingDefaultLocation: true });
    missing(N);
    await renderScreen();

    expect(await screen.findByText(t("alarm.settings.cityNeeded.title"))).toBeTruthy();
    expect(screen.getByText(t("alarm.settings.cityNeeded.body"))).toBeTruthy();
    expect(screen.queryByText(pageTitle(N))).toBeNull();
    expect(screen.queryByLabelText(t("a11y.stepProgress", { current: 1, total: 5 }))).toBeNull();
    expect(notNow()).toBeNull();
  });

  it("opens the location settings from its button", async () => {
    usePrayerTimesStore.setState({ usingDefaultLocation: true });
    await renderScreen();

    const button = await screen.findByRole("button", {
      name: t("alarm.settings.cityNeeded.action"),
    });
    expect(button.props.accessibilityHint).toBe(t("a11y.today.locationHint"));
    await userEvent.press(button);

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.SETTINGS_LOCATION.href)
    );
  });

  it("opens the location settings from the button the CI flow taps", async () => {
    usePrayerTimesStore.setState({ usingDefaultLocation: true });
    await renderScreen();

    await userEvent.press(await screen.findByTestId(E2E_ID.ALARM_CHOOSE_CITY));

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.SETTINGS_LOCATION.href)
    );
  });

  it("gives way to the alarms once a city lands", async () => {
    usePrayerTimesStore.setState({ usingDefaultLocation: true });
    await renderScreen();
    await screen.findByText(t("alarm.settings.cityNeeded.title"));

    await act(async () => usePrayerTimesStore.setState({ usingDefaultLocation: false }));

    expect(await reportProblem()).toBeTruthy();
    expect(screen.queryByText(t("alarm.settings.cityNeeded.title"))).toBeNull();
  });

  it("asks for the city until the stored place loads, then gives way", async () => {
    const held = holdHydration(useLocationStore);
    try {
      await renderScreen();
      expect(await screen.findByText(t("alarm.settings.cityNeeded.title"))).toBeTruthy();

      await act(async () => held.land());

      expect(await reportProblem()).toBeTruthy();
      expect(screen.queryByText(t("alarm.settings.cityNeeded.title"))).toBeNull();
    } finally {
      held.restore();
    }
  });

  // An armed alarm rings whatever the place reads, so the list shows it On.
  it("shows the alarms while one is armed at the default location's times", async () => {
    usePrayerTimesStore.setState({ usingDefaultLocation: true });
    useAlarmSettingsStore.getState().setEnabled(ALARM_TYPE.FAJR, true);
    armFajr();
    await renderScreen();

    const fajr = await alarmRow(t("alarm.settings.fajrAlarm"));
    expect(fajr).toHaveAccessibleName(
      new RegExp(`^${literal(t("alarm.settings.fajrAlarm"))}, ${t("common.on")}\\. `)
    );
    expect(screen.queryByText(t("alarm.settings.cityNeeded.title"))).toBeNull();

    // Its page holds the switch that turns it off.
    await userEvent.press(fajr);
    expect(screen.getByTestId("pathname")).toHaveTextContent(
      `${BACK_DESTINATION.SETTINGS_ALARM.href}/${ALARM_TYPE.FAJR}`
    );
  });

  it("asks for the city first when only a rehearsal is armed", async () => {
    usePrayerTimesStore.setState({ usingDefaultLocation: true });
    useAlarmSettingsStore.getState().setEnabled(ALARM_TYPE.FAJR, true);
    armFajr(true);
    await renderScreen();

    expect(await screen.findByText(t("alarm.settings.cityNeeded.title"))).toBeTruthy();
  });

  it("shows the permissions at a verified place", async () => {
    missing(E);
    await renderScreen();

    expect(await screen.findByText(pageTitle(E))).toBeTruthy();
    expect(screen.queryByText(t("alarm.settings.cityNeeded.title"))).toBeNull();
  });
});

describe("Alarm settings list", () => {
  // The badge's On or Off reaches a screen reader through the row's own name.
  it("names each alarm's status in its row", async () => {
    useAlarmSettingsStore.getState().setEnabled(ALARM_TYPE.FAJR, true);
    await renderScreen();

    expect(await alarmRow(t("alarm.settings.fajrAlarm"))).toHaveAccessibleName(
      new RegExp(`^${literal(t("alarm.settings.fajrAlarm"))}, ${t("common.on")}\\. `)
    );
    expect(await alarmRow(t("alarm.settings.fridayAlarm"))).toHaveAccessibleName(
      new RegExp(`^${literal(t("alarm.settings.fridayAlarm"))}, ${t("common.off")}\\. `)
    );
  });

  // A rehearsal a few seconds out is not when the alarm rings.
  it("gives the real alarm's ring time while a rehearsal is pending", async () => {
    useAlarmSettingsStore.getState().setEnabled(ALARM_TYPE.FAJR, true);
    const rings = Date.now() + 2 * DAY_MS;
    const rehearsal = fajrRecord("fajr-rehearsal", Date.now() + 30 * 1000, true);
    const real = fajrRecord("fajr-real", rings);
    useAlarmStore.setState({
      scheduledAlarms: { [rehearsal.alarmId]: rehearsal, [real.alarmId]: real },
    });
    await renderScreen();

    const fajr = await alarmRow(t("alarm.settings.fajrAlarm"));
    const weekday = new Date(rings).toLocaleDateString(i18n.language, { weekday: "long" });
    expect(within(fajr).getByText(new RegExp(weekday))).toBeTruthy();
    expect(within(fajr).queryByText(new RegExp(t("alarm.settings.today")))).toBeNull();
  });

  // The description is the row's standing text, so the name leaves it out.
  it("speaks every other line the row draws, in reading order", async () => {
    useAlarmSettingsStore.getState().setEnabled(ALARM_TYPE.FAJR, true);
    useAlarmStreakStore.setState({ streak: 3 });
    const rings = Date.now() + 2 * DAY_MS;
    const real = fajrRecord("fajr-real", rings);
    useAlarmStore.setState({ scheduledAlarms: { [real.alarmId]: real } });
    await renderScreen();

    const fajr = await alarmRow(t("alarm.settings.fajrAlarm"));
    const weekday = new Date(rings).toLocaleDateString(i18n.language, { weekday: "long" });
    expect(within(fajr).getByText(new RegExp(weekday))).toBeTruthy();
    expect(within(fajr).getByText(t("alarm.settings.streakStat", { count: 3 }))).toBeTruthy();
    const description = t("alarm.settings.fajrDescription");
    const [title, status, summary, ...rest] = within(fajr)
      .getAllByText(/./)
      .map((node) => String(node.props.children))
      .filter((text) => text !== description);
    expect(rest).toHaveLength(2);
    expect(fajr).toHaveAccessibleName(
      [
        `${title}, ${status}`,
        summary,
        spokenRing(rings),
        t("a11y.alarm.streak", { count: 3 }),
      ].join(". ")
    );
  });

  // A screen reader says 🌅 as "sunrise", which is also a prayer time here.
  it("speaks the streak without its emoji", async () => {
    useAlarmSettingsStore.getState().setEnabled(ALARM_TYPE.FAJR, true);
    useAlarmStreakStore.setState({ streak: 3 });
    await renderScreen();

    const fajr = await alarmRow(t("alarm.settings.fajrAlarm"));
    expect(within(fajr).getByText(t("alarm.settings.streakStat", { count: 3 }))).toBeTruthy();
    expect(fajr).toHaveAccessibleName(
      new RegExp(`\\. ${literal(t("a11y.alarm.streak", { count: 3 }))}$`)
    );
    expect(fajr).not.toHaveAccessibleName(EMOJI);
  });

  // Arabic speech reads «م» as its own period word, so the time is in words.
  it("speaks an afternoon ring time in words in Arabic", async () => {
    useAlarmSettingsStore.getState().setEnabled(ALARM_TYPE.FAJR, true);
    const rings = afternoonRing();
    const real = fajrRecord("fajr-real", rings);
    useAlarmStore.setState({ scheduledAlarms: { [real.alarmId]: real } });

    await inArabic(false, async () => {
      await renderScreen();

      const fajr = await alarmRow(t("alarm.settings.fajrAlarm"));
      expect(within(fajr).getByText(/١:٠٥ م/)).toBeTruthy();
      expect(fajr).toHaveAccessibleName(new RegExp(`${literal(spokenRing(rings))}$`));
      expect(fajr).toHaveAccessibleName(/الواحدة و٥ دقائق ظهرًا$/);
      expect(fajr).not.toHaveAccessibleName(CLOCK_DIGITS);
    });
  });

  it("draws the ring time in the digits the reader chose", async () => {
    useAlarmSettingsStore.getState().setEnabled(ALARM_TYPE.FAJR, true);
    const real = fajrRecord("fajr-real", afternoonRing());
    useAlarmStore.setState({ scheduledAlarms: { [real.alarmId]: real } });

    await inArabic(true, async () => {
      await renderScreen();

      const fajr = await alarmRow(t("alarm.settings.fajrAlarm"));
      expect(within(fajr).getByText(/1:05 م/)).toBeTruthy();
      expect(within(fajr).queryByText(/١:٠٥/)).toBeNull();
    });
  });

  it("says that each row opens its alarm's page", async () => {
    await renderScreen();

    const fajr = await alarmRow(t("alarm.settings.fajrAlarm"));
    expect(fajr.props.accessibilityHint).toBe(
      t("a11y.opens", { name: t("alarm.settings.fajrAlarm") })
    );
  });

  // A one-day streak is not drawn, so the name ends at the ring time.
  it("leaves out a streak the row does not draw", async () => {
    useAlarmSettingsStore.getState().setEnabled(ALARM_TYPE.FAJR, true);
    useAlarmStreakStore.setState({ streak: 1 });
    const rings = Date.now() + 2 * DAY_MS;
    const real = fajrRecord("fajr-real", rings);
    useAlarmStore.setState({ scheduledAlarms: { [real.alarmId]: real } });
    await renderScreen();

    const fajr = await alarmRow(t("alarm.settings.fajrAlarm"));
    expect(fajr).toHaveAccessibleName(new RegExp(`\\. ${literal(spokenRing(rings))}$`));
  });

  it("gives no ring time when only a rehearsal is pending", async () => {
    useAlarmSettingsStore.getState().setEnabled(ALARM_TYPE.FAJR, true);
    armFajr(true);
    await renderScreen();

    const fajr = await alarmRow(t("alarm.settings.fajrAlarm"));
    expect(within(fajr).queryByText(new RegExp(t("alarm.settings.today")))).toBeNull();
  });
});

describe("Alarm settings permission gate", () => {
  it("blocks on a missing needed item, with no way past it", async () => {
    missing(E, F);
    await renderScreen();

    expect(await screen.findByText(pageTitle(E))).toBeTruthy();
    expect(screen.getByRole("button", { name: t("alarm.permission.openSettings") })).toBeTruthy();
    expect(notNow()).toBeNull();
  });

  it("offers Not now on a missing improvement, which shows the next one", async () => {
    missing(F, B);
    await renderScreen();

    expect(await screen.findByText(pageTitle(F))).toBeTruthy();
    expect(screen.getByLabelText(t("a11y.stepProgress", { current: 3, total: 5 }))).toBeTruthy();
    await userEvent.press(notNow()!);

    expect(screen.getByText(pageTitle(B))).toBeTruthy();
    expect(screen.getByLabelText(t("a11y.stepProgress", { current: 5, total: 5 }))).toBeTruthy();
  });

  it("shows the alarms once every missing improvement is passed", async () => {
    missing(O);
    await renderScreen();
    await screen.findByText(pageTitle(O));

    await userEvent.press(notNow()!);

    expect(await reportProblem()).toBeTruthy();
  });

  it("names both buttons by their visible words", async () => {
    missing(F);
    await renderScreen();
    await screen.findByText(pageTitle(F));

    for (const name of [t("alarm.permission.openSettings"), t("common.notNow")]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveTextContent(name);
    }
  });
});

describe("Alarm settings custom sounds", () => {
  it("links to custom sounds on Android", async () => {
    await renderScreen();

    const link = await screen.findByRole("button", {
      name: i18n.t("notification.customSound.manage"),
    });
    expect(link.props.accessibilityHint).toBe(
      i18n.t("a11y.opens", { name: i18n.t(BACK_DESTINATION.SETTINGS_CUSTOM_SOUNDS.title) })
    );

    await userEvent.press(link);

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.SETTINGS_CUSTOM_SOUNDS.href)
    );
  });

  // iOS plays only the sounds bundled with the app.
  it("leaves custom sounds off on iOS", async () => {
    jest.replaceProperty(Platform, "OS", PlatformType.IOS);
    await renderScreen();
    await screen.findByRole("button", { name: i18n.t("alarm.settings.reportProblem") });

    expect(customSounds()).toBeNull();
  });
});
