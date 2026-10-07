// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screens must bind to the mock below, not to its empty one.
import ToolsScreen from "@/app/(tabs)/tools";
import SettingsScreen from "@/app/(tabs)/settings";
import HijriSettings from "@/app/settings/advance/hijri";
import type { ReactNode } from "react";
import { renderRouter, screen } from "expo-router/testing-library";

import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useAppStore } from "@/stores/app";
import { ThemeProvider } from "@/test-helpers/theme";
import { HIJRI_OFFSETS } from "@/utils/hijriAdjustment";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("@/hooks/useAlarmSupported", () => ({ useAlarmSupported: () => true }));
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

describe("A Hijri day offset", () => {
  it.each(HIJRI_STATES)(
    "reads alike on the Hijri screen and Settings in %s at %i",
    async (locale, offset) => {
      useAppStore.setState({ locale, hijriDaysOffset: offset });
      await i18n.changeLanguage(locale);
      await renderSideBySide(
        <>
          <HijriSettings />
          <SettingsScreen />
        </>
      );

      const onSettings = statusOf(i18n.t("settings.rows.hijri"));
      const slider = screen.getByRole("adjustable", {
        name: i18n.t("settings.hijri.date.adjustmentTitle"),
      });

      expect(onSettings).not.toBe("");
      expect(slider).toHaveAccessibilityValue({ text: onSettings });
    }
  );
});
