import { screen } from "@testing-library/react-native";

import OtherRemindersSettings from "@/app/settings/otherReminders";
import { MIDNIGHT_MODE, PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { useProviderSettingsStore } from "@/stores/providerSettings";
import { renderWithTheme } from "@/test-helpers/theme";
import type { AladhanMidnightModeId } from "@/types/providers/aladhan";
import { LTR_ISOLATE } from "@/utils/digits";

type Today = { otherTimings: { sunrise: string }; timings: { dhuhr: string } } | null;

let mockDuhaOn = false;
let mockToday: Today = null;

jest.mock("@/components/ui/screen-header", () => ({ ScreenHeader: () => null }));
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));
jest.mock("@/hooks/useNotificationSettings", () => ({
  useNotificationSettings: () => ({
    otherTimingNotifications: { duha: mockDuhaOn },
    duhaTime: { hour: 9, minute: 0 },
    updateOtherTimingNotification: jest.fn(),
    updateDuhaTime: jest.fn(),
  }),
}));
// The prayer-times store opens SQLite; the screen needs only today's timings.
jest.mock("@/stores/prayerTimes", () => ({
  usePrayerTimesStore: (select: (state: { todayTimings: Today }) => unknown) =>
    select({ todayTimings: mockToday }),
}));

const NIGHT = "notification.otherTiming.group.night.description";
const ALADHAN_ID = PRAYER_TIME_PROVIDERS.ALADHAN.id;
const MINUTE_OPTION = "a11y.otherTiming.duhaMinute";
const DUHA_AM = "notification.otherTiming.duha.am";

const t = i18n.t.bind(i18n);

const useMidnightMode = (midnightMode: AladhanMidnightModeId) =>
  useProviderSettingsStore.setState({
    currentProviderId: ALADHAN_ID,
    allSettings: { [ALADHAN_ID]: { midnightMode } },
  });

/** Duha on, with hours from 7 up to the hour of `dhuhr`. */
const renderDuha = (dhuhr: string) => {
  mockDuhaOn = true;
  mockToday = {
    otherTimings: { sunrise: "2026-11-07T06:00:00" },
    timings: { dhuhr: `2026-11-07T${dhuhr}:00` },
  };
  return renderWithTheme(<OtherRemindersSettings />);
};

describe("Other reminders", () => {
  beforeEach(async () => {
    await i18n.changeLanguage(AppLocale.EN);
    useAppStore.setState({ locale: AppLocale.EN });
    usePreferencesStore.setState({ use24HourTime: false, useWesternNumerals: true });
    mockDuhaOn = false;
    mockToday = null;
  });

  // AlAdhan splits the night by the midnight mode, so the note names that span.
  it.each([
    [MIDNIGHT_MODE.STANDARD, `${NIGHT}.standard`],
    [MIDNIGHT_MODE.JAFARI, `${NIGHT}.jafari`],
  ])("describes the night for midnight mode %i", async (mode, key) => {
    useMidnightMode(mode);
    await renderWithTheme(<OtherRemindersSettings />);

    expect(screen.getByText(i18n.t(key))).toBeOnTheScreen();
  });

  it("marks each group title as a header", async () => {
    await renderWithTheme(<OtherRemindersSettings />);

    expect(
      screen.getByRole("header", { name: t("notification.otherTiming.group.morning") })
    ).toBeTruthy();
  });

  describe("Duha hour", () => {
    it("speaks each hour with its own period", async () => {
      await renderDuha("13:10");

      expect(
        screen.getByRole("radio", { name: t("a11y.time.am", { time: "11:00" }) })
      ).toBeTruthy();
      expect(
        screen.getByRole("radio", { name: t("a11y.time.pm", { time: "12:00" }) })
      ).toBeTruthy();
      expect(screen.getByRole("radio", { name: t("a11y.time.pm", { time: "1:00" }) })).toBeTruthy();
    });

    it("speaks a midday hour in Arabic words", async () => {
      await i18n.changeLanguage(AppLocale.AR);
      useAppStore.setState({ locale: AppLocale.AR });
      await renderDuha("12:10");

      expect(
        screen.getByRole("radio", {
          name: t("a11y.time.onTheHour", {
            hour: t("a11y.time.hours.12"),
            period: t("a11y.time.periods.noon"),
          }),
        })
      ).toBeTruthy();
    });

    it("draws the hour on the reader's 12-hour clock", async () => {
      await renderDuha("13:10");

      expect(screen.getByText("1")).toBeTruthy();
      expect(screen.queryByText("13")).toBeNull();
    });

    it("draws the hour on the reader's 24-hour clock", async () => {
      usePreferencesStore.setState({ use24HourTime: true });
      await renderDuha("13:10");

      expect(screen.getByText("13")).toBeTruthy();
      expect(screen.getByRole("radio", { name: "13:00" })).toBeTruthy();
    });

    it("shows the morning caption only while every hour is before noon", async () => {
      await renderDuha("11:50");

      expect(screen.getByText(t(DUHA_AM))).toBeTruthy();
    });

    it.each(["12:10", "13:10"])(
      "leaves the morning caption out when Dhuhr is at %s",
      async (dhuhr) => {
        await renderDuha(dhuhr);

        expect(screen.queryByText(t(DUHA_AM))).toBeNull();
      }
    );

    it("leaves the morning caption out on a 24-hour clock", async () => {
      usePreferencesStore.setState({ use24HourTime: true });
      await renderDuha("11:50");

      expect(screen.queryByText(t(DUHA_AM))).toBeNull();
    });

    it("groups the hours under their name", async () => {
      await renderDuha("11:50");

      expect(screen.getByLabelText(t("notification.otherTiming.duha.hourLabel"))).toHaveProp(
        "accessibilityRole",
        "radiogroup"
      );
    });
  });

  describe("Duha minute", () => {
    it("speaks a count of minutes, and no count for the top of the hour", async () => {
      await renderDuha("11:50");

      expect(screen.getByRole("radio", { name: t(MINUTE_OPTION, { count: 15 }) })).toBeTruthy();
      const onTheHour = t(MINUTE_OPTION, { count: 0 });
      expect(onTheHour).not.toMatch(/\d/);
      expect(screen.getByRole("radio", { name: onTheHour })).toBeTruthy();
    });

    it("gives Arabic a word for the top of the hour and a form for each count", async () => {
      await i18n.changeLanguage(AppLocale.AR);

      const forms = [0, 1, 2, 3, 15].map((count) => t(MINUTE_OPTION, { count }));
      expect(new Set(forms).size).toBe(forms.length);
      expect(forms[0]).not.toMatch(/[\d٠-٩]/);
    });

    // The colon is neutral, so it moves to the far side in a right-to-left row.
    it("isolates the drawn minute from the row's direction", async () => {
      await renderDuha("11:50");

      expect(screen.getByText(`${LTR_ISOLATE.OPEN}:15${LTR_ISOLATE.CLOSE}`)).toBeTruthy();
    });

    it("groups the minutes under their name", async () => {
      await renderDuha("11:50");

      expect(screen.getByLabelText(t("notification.otherTiming.duha.minuteLabel"))).toHaveProp(
        "accessibilityRole",
        "radiogroup"
      );
    });
  });
});
