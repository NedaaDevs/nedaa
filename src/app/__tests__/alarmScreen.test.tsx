import { act, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import * as ExpoAlarm from "expo-alarm";

import AlarmTriggeredScreen from "@/app/alarm";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { ScheduledAlarmType } from "@/enums/alarm";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { renderWithTheme } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";

const mockAlarmId = "alarm-1";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("expo-alarm", () => ({ ...jest.requireActual("expo-alarm") }));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({
    alarmType: jest.requireActual("@/enums/alarm").ScheduledAlarmType.JUMMAH,
    alarmId: mockAlarmId,
  }),
  Stack: { Screen: () => null },
}));
// 18:10 on the device clock, whatever zone the device is in.
jest.mock("@/hooks/useMinuteClock", () => ({
  useMinuteClock: () => new Date(2026, 8, 25, 18, 10),
}));
jest.mock("@/components/alarm/challenges", () => ({ ChallengeWrapper: () => null }));
jest.mock("@/hooks/useAlarmScreen", () => ({
  formatTimeRemaining: () => "",
  useAlarmScreen: () => ({
    isSnoozed: false,
    isDismissed: false,
    snoozeEndTime: null,
    snoozeTimeRemaining: 0,
    canSnooze: false,
    remainingSnoozes: 0,
    challengeConfig: { type: "none" },
    handleChallengeComplete: jest.fn(),
    handleSnooze: jest.fn(),
    handleGraceStart: jest.fn(),
    handleGraceExpire: jest.fn(),
  }),
}));

/** Friday 25 September 2026, Jumuah at 12:10 in the prayer's zone. */
const DAY: DayPrayerTimes = {
  date: 20260925,
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: "2026-09-25T04:30:00.000Z",
    [PRAYER_ID.DHUHR]: "2026-09-25T12:10:00.000Z",
    [PRAYER_ID.ASR]: "2026-09-25T15:20:00.000Z",
    [PRAYER_ID.MAGHRIB]: "2026-09-25T18:05:00.000Z",
    [PRAYER_ID.ISHA]: "2026-09-25T19:25:00.000Z",
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: "2026-09-25T05:50:00.000Z",
  } as DayPrayerTimes["otherTimings"],
};

describe("AlarmTriggeredScreen", () => {
  beforeAll(() => act(() => i18n.changeLanguage(AppLocale.AR)));
  afterAll(() => act(() => i18n.changeLanguage(AppLocale.EN)));
  beforeEach(() => {
    useAppStore.setState({ locale: AppLocale.AR });
    usePreferencesStore.setState({ use24HourTime: false, useWesternNumerals: false });
    usePrayerTimesStore.setState({ todayTimings: DAY, tomorrowTimings: null });
    // The route opens the screen only for the alarm that is ringing.
    jest.spyOn(ExpoAlarm, "getPendingChallenge").mockResolvedValue({
      alarmId: mockAlarmId,
      alarmType: ScheduledAlarmType.JUMMAH,
      title: "",
      timestamp: 0,
    });
  });

  // Arabic speech rewrites clock digits, so labels speak the time in words.
  it("speaks the evening clock as evening in Arabic", async () => {
    await renderWithTheme(<AlarmTriggeredScreen />);

    expect(screen.getByText("٦:١٠ م")).toHaveAccessibleName(
      i18n.t("a11y.alarm.currentTime", { time: "السادسة و١٠ دقائق مساءً" })
    );
  });

  it("speaks Jumuah's time with its period in Arabic", async () => {
    await renderWithTheme(<AlarmTriggeredScreen />);

    const prayer = i18n.t("prayerTimes.jumuah");
    expect(screen.getByText(`${prayer} · ١٢:١٠ م`)).toHaveAccessibleName(
      i18n.t("a11y.alarm.prayerAt", { prayer, time: "الثانية عشرة و١٠ دقائق ظهرًا" })
    );
  });
  // The ringing alarm is announced once per screen, not on every re-render.
  it("announces the alarm once while it stays on screen", async () => {
    // React Native's test setup already mocks it, so earlier tests' calls count.
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockClear();
    await renderWithTheme(<AlarmTriggeredScreen />);
    await act(() => usePrayerTimesStore.setState({ tomorrowTimings: DAY }));
    await act(() => usePreferencesStore.setState({ use24HourTime: true }));

    expect(announce).toHaveBeenCalledTimes(1);
    announce.mockRestore();
  });
});
