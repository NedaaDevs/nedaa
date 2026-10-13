// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screens must bind to the mock below, not to its empty one.
import ToolsScreen from "@/app/(tabs)/tools";
import SettingsScreen from "@/app/(tabs)/settings";
import HijriSettings from "@/app/settings/advance/hijri";
import CalculationSettings from "@/app/settings/advance/provider";
import type { ReactNode } from "react";
import { renderRouter, screen } from "expo-router/testing-library";

import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { ASR_SCHOOL, MIDNIGHT_MODE, PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useAppStore } from "@/stores/app";
import { useProviderSettingsStore } from "@/stores/providerSettings";
import { ThemeProvider } from "@/test-helpers/theme";
import { HIJRI_OFFSETS } from "@/utils/hijriAdjustment";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("@/hooks/useAlarmSupported", () => ({ useAlarmSupported: () => true }));
jest.mock("expo-widget", () => ({ reloadPrayerWidgets: jest.fn() }));
// hijri-native is a native module; the Hijri screen reads today's date from it.
jest.mock("@/utils/date", () => ({
  ...jest.requireActual("@/utils/date"),
  HijriNative: {
    fromTimestamp: () => ({ year: 1448, month: 4, day: 12 }),
    addDays: (date: { day: number }, days: number) => ({ ...date, day: date.day + days }),
  },
}));

const LOCALES = [AppLocale.EN, AppLocale.AR] as const;

/** Draws two screens side by side, so one state reaches both at once. */
const renderSideBySide = (screens: ReactNode) =>
  renderRouter(
    { index: () => <>{screens}</> },
    { initialUrl: "/", wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider> }
  );

/** A row's summary: its label less the title that leads it. */
const statusOf = (title: string) => {
  const lead = i18n.t("a11y.join", { first: title, second: "" });
  const label = String(
    screen
      .getAllByRole("button")
      .map((node) => node.props.accessibilityLabel)
      .find((name) => String(name).startsWith(lead))
  );
  return label.slice(lead.length);
};

const initialAlarms = useAlarmSettingsStore.getState();

beforeEach(() => {
  useAlarmSettingsStore.setState({ fajr: initialAlarms.fajr, friday: initialAlarms.friday });
  useAppStore.setState({ locale: AppLocale.EN, hijriDaysOffset: 0 });
});

afterAll(async () => {
  await i18n.changeLanguage(AppLocale.EN);
});

// Every mix of the two alarms, in each script.
const ALARM_STATES = LOCALES.flatMap((locale) =>
  [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ].map(([fajr, friday]) => [locale, fajr, friday] as const)
);

describe("The alarms that are on", () => {
  it.each(ALARM_STATES)(
    "read alike on More and Settings in %s, fajr=%s friday=%s",
    async (locale, fajr, friday) => {
      useAppStore.setState({ locale });
      await i18n.changeLanguage(locale);
      useAlarmSettingsStore.setState({
        fajr: { ...initialAlarms.fajr, enabled: fajr },
        friday: { ...initialAlarms.friday, enabled: friday },
      });
      await renderSideBySide(
        <>
          <ToolsScreen />
          <SettingsScreen />
        </>
      );

      const onMore = statusOf(i18n.t("tools.alarm.title"));

      expect(onMore).not.toBe("");
      expect(statusOf(i18n.t("alarm.settings.title"))).toBe(onMore);
    }
  );
});

const HIJRI_STATES = LOCALES.flatMap((locale) =>
  HIJRI_OFFSETS.map((offset) => [locale, offset] as const)
);

/** The status of the row that opens `destination`, found by its hint. */
const statusOfLinkTo = (title: string) => {
  const hint = i18n.t("a11y.opens", { name: title });
  const row = screen.getAllByRole("button").find((node) => node.props.accessibilityHint === hint);
  const separator = i18n.t("a11y.join", { first: "", second: "" });
  return String(row?.props.accessibilityLabel).split(separator).at(-1);
};

describe("A Hijri day offset", () => {
  it.each(HIJRI_STATES)(
    "reads alike on the Hijri screen and Calculation in %s at %i",
    async (locale, offset) => {
      useAppStore.setState({ locale, hijriDaysOffset: offset });
      await i18n.changeLanguage(locale);
      await renderSideBySide(
        <>
          <HijriSettings />
          <CalculationSettings />
        </>
      );

      const onCalculation = statusOfLinkTo(i18n.t(BACK_DESTINATION.SETTINGS_HIJRI.title));
      const slider = screen.getByRole("adjustable", {
        name: i18n.t("settings.hijri.date.adjustmentTitle"),
      });

      expect(onCalculation).not.toBe("");
      expect(slider).toHaveAccessibilityValue({ text: onCalculation });
    }
  );
});

const [CHOSEN, REPORTED] = PRAYER_TIME_PROVIDERS.ALADHAN.methods.map(({ id }) => id);

// Chosen or left to the provider; reported or not; with a refetch owed or not.
const METHOD_STATES = LOCALES.flatMap((locale) =>
  [CHOSEN, undefined].flatMap((method) =>
    [REPORTED, undefined].flatMap((reported) =>
      [false, true].map((pending) => [locale, method, reported, pending] as const)
    )
  )
);

describe("The method in effect", () => {
  it.each(METHOD_STATES)(
    "reads alike on Settings and Calculation in %s, method %s, reported %s, pending %s",
    async (locale, method, reported, pending) => {
      useAppStore.setState({ locale });
      await i18n.changeLanguage(locale);
      useProviderSettingsStore.setState({
        currentProviderId: PRAYER_TIME_PROVIDERS.ALADHAN.id,
        allSettings: {
          [PRAYER_TIME_PROVIDERS.ALADHAN.id]: {
            method,
            madhab: ASR_SCHOOL.SHAFI,
            midnightMode: MIDNIGHT_MODE.STANDARD,
          },
        },
        draft: null,
        inEffect: reported === undefined ? null : { method: reported },
        pendingReapply: pending,
      });
      await renderSideBySide(
        <>
          <SettingsScreen />
          <CalculationSettings />
        </>
      );

      const title = i18n.t("providers.aladhan.method.title");
      const onSettings = statusOf(i18n.t(BACK_DESTINATION.SETTINGS_PROVIDER.title));
      const card = screen
        .getAllByRole("button")
        .find((node) =>
          String(node.props.accessibilityLabel).startsWith(
            i18n.t("a11y.join", { first: title, second: onSettings })
          )
        );

      expect(onSettings).not.toBe("");
      expect(card).toBeTruthy();
    }
  );
});
