import { Platform } from "react-native";
import { screen, userEvent } from "@testing-library/react-native";

import ActiveAlarmBanner from "@/components/ActiveAlarmBanner";
import { ScheduledAlarmType } from "@/enums/alarm";
import { PlatformType } from "@/enums/app";
import { openAlarmOnRequest } from "@/hooks/useAlarmDeepLink";
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
jest.mock("@/hooks/useAlarmDeepLink", () => ({ openAlarmOnRequest: jest.fn() }));

const t = i18n.t.bind(i18n);
const label = () => t("a11y.alarm.banner.label", { title: mockActive.title });
const pressBanner = async () =>
  userEvent.press(await screen.findByRole("button", { name: label() }));

beforeEach(() => {
  jest.mocked(openAlarmOnRequest).mockClear();
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
  it.each([PlatformType.ANDROID, PlatformType.IOS])(
    "opens the alarm screen on %s and leaves the alarm ringing",
    async (os) => {
      jest.replaceProperty(Platform, "OS", os);
      await renderWithTheme(<ActiveAlarmBanner />);

      await pressBanner();

      expect(openAlarmOnRequest).toHaveBeenCalledWith(ALARM_ID, ScheduledAlarmType.FAJR);
      expect(useAlarmStore.getState().scheduledAlarms[ALARM_ID]).toBeDefined();
      expect(useAlarmStreakStore.getState().lastHeldDate).toBeNull();
      expect(useAlarmStreakStore.getState().streak).toBe(3);
    }
  );

  it("names the alarm for a screen reader and says what a tap does", async () => {
    await renderWithTheme(<ActiveAlarmBanner />);

    const banner = await screen.findByRole("button", { name: label() });
    expect(banner.props).toMatchObject({ accessibilityHint: t("a11y.alarm.banner.hint") });
    expect(screen.getByText(t("alarm.banner.tapToOpen", { title: mockActive.title }))).toBeTruthy();
  });
});
