import { Platform } from "react-native";
import { screen, userEvent, waitFor } from "@testing-library/react-native";

import ActiveAlarmBanner from "@/components/ActiveAlarmBanner";
import { ScheduledAlarmType } from "@/enums/alarm";
import { PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAlarmStore } from "@/stores/alarm";
import { useAlarmStreakStore } from "@/stores/alarmStreak";
import { resetNativeLog } from "@/test-helpers/expoAlarmLog";
import { resetMemoryKv } from "@/test-helpers/memoryKvStore";
import { renderWithTheme } from "@/test-helpers/theme";
import type { ActiveAlarmInfo } from "@/utils/activeAlarmDetector";
import { toLocalDateISO } from "@/utils/streak";

const ALARM_ID = "11111111-1111-4111-8111-111111111111";
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

const mockActive: ActiveAlarmInfo = {
  alarmId: ALARM_ID,
  alarmType: ScheduledAlarmType.FAJR,
  title: ScheduledAlarmType.FAJR,
  source: "pending-challenge",
};

jest.mock("expo-alarm", () => jest.requireActual("@/test-helpers/expoAlarmLog").expoAlarmLogModule);
jest.mock(
  "expo-sqlite/kv-store",
  () => jest.requireActual("@/test-helpers/memoryKvStore").memoryKvStoreModule
);
jest.mock("@/utils/alarmReport", () => ({
  alarmLog: { i: jest.fn(), w: jest.fn(), e: jest.fn() },
}));
jest.mock("@/utils/activeAlarmDetector", () => ({
  detectActiveAlarm: () => Promise.resolve(mockActive),
}));
jest.mock("@/hooks/useAlarmDeepLink", () => ({
  navigateToAlarm: jest.fn(),
  markAlarmHandled: jest.fn(),
}));
jest.mock("@/stores/alarmSettings", () => ({
  useAlarmSettingsStore: {
    getState: () => ({
      fajr: { enabled: true, timing: { mode: "atPrayerTime" }, snooze: { maxCount: 3 } },
    }),
    persist: {},
  },
}));
jest.mock("@/stores/prayerTimes", () => ({
  usePrayerTimesStore: {
    getState: () => ({
      tomorrowTimings: { timings: { fajr: new Date(Date.now() + 8 * 3600_000).toISOString() } },
    }),
  },
}));
// The stored times are for a verified place.
jest.mock("@/utils/timesPlace", () => {
  const { TIMES_PLACE } = jest.requireActual("@/constants/Location");
  return { readTimesPlace: async () => TIMES_PLACE.VERIFIED };
});

const t = i18n.t.bind(i18n);

beforeEach(() => {
  resetNativeLog();
  resetMemoryKv();
  jest.replaceProperty(Platform, "OS", PlatformType.ANDROID);
  useAlarmStore.setState({
    scheduledAlarms: {
      [ALARM_ID]: {
        alarmId: ALARM_ID,
        alarmType: ScheduledAlarmType.FAJR,
        title: ScheduledAlarmType.FAJR,
        triggerTime: Date.now() - 5 * MINUTE,
        liveActivityId: null,
        snoozeCount: 0,
      },
    },
  });
  useAlarmStreakStore.setState({
    streak: 3,
    bestStreak: 3,
    lastSuccessDate: toLocalDateISO(Date.now() - DAY),
    lastHeldDate: null,
  });
});

describe("ActiveAlarmBanner", () => {
  // The dismissed alarm's task was never solved.
  it("holds the streak when a fresh Fajr alarm is dismissed on Android", async () => {
    await renderWithTheme(<ActiveAlarmBanner />);

    await userEvent.press(
      await screen.findByRole("button", { name: t("alarm.banner.activeAlarm") })
    );

    await waitFor(() =>
      expect(useAlarmStreakStore.getState().lastHeldDate).toBe(toLocalDateISO(Date.now()))
    );
    expect(useAlarmStreakStore.getState().streak).toBe(3);
    expect(useAlarmStreakStore.getState().lastSuccessDate).toBe(toLocalDateISO(Date.now() - DAY));
  });
});
