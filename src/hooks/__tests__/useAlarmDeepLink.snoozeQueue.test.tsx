import { Linking, Platform } from "react-native";
import { act, renderHook } from "@testing-library/react-native";

import { ScheduledAlarmType } from "@/enums/alarm";
import { PlatformType } from "@/enums/app";
import { useAlarmDeepLink } from "@/hooks/useAlarmDeepLink";
import { useAlarmStore } from "@/stores/alarm";
import { nativeResults, resetNativeLog } from "@/test-helpers/expoAlarmLog";

jest.mock("expo-alarm", () => jest.requireActual("@/test-helpers/expoAlarmLog").expoAlarmLogModule);
jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("@/utils/alarmScheduler", () => ({
  completeAndRescheduleAlarm: jest.fn(),
  waitForAlarmStores: jest.fn(async () => undefined),
}));
jest.mock("@/utils/activeAlarmDetector", () => ({ detectActiveAlarm: jest.fn(async () => null) }));
jest.mock("@/utils/alarmReport", () => ({ alarmLog: { e: jest.fn() } }));

const ORIGINAL_ID = "11111111-1111-4111-8111-111111111111";
const SNOOZE_ID = "22222222-2222-4222-8222-222222222222";
const FIRST_RING = Date.now() - 60_000;
const SNOOZE_ENDS = Date.now() + 5 * 60_000;

beforeEach(() => {
  jest.replaceProperty(Platform, "OS", PlatformType.ANDROID);
  jest.spyOn(Linking, "getInitialURL").mockResolvedValue(null);
  resetNativeLog();
  nativeResults.getCompletedAlarmIds = [];
  nativeResults.getCompletedQueue = [];
  nativeResults.getSnoozeQueue = [
    {
      id: 1,
      originalAlarmId: ORIGINAL_ID,
      snoozeAlarmId: SNOOZE_ID,
      alarmType: ScheduledAlarmType.FAJR,
      title: ScheduledAlarmType.FAJR,
      snoozeCount: 1,
      snoozeEndTime: SNOOZE_ENDS,
    },
  ];
});
afterEach(() => jest.restoreAllMocks());

describe("an alarm snoozed from the Android overlay", () => {
  it("keeps the original's quiet, preview and first ring on its snooze", async () => {
    useAlarmStore.setState({
      scheduledAlarms: {
        [ORIGINAL_ID]: {
          alarmId: ORIGINAL_ID,
          alarmType: ScheduledAlarmType.FAJR,
          title: ScheduledAlarmType.FAJR,
          triggerTime: FIRST_RING,
          liveActivityId: null,
          snoozeCount: 0,
          isPreview: true,
          quietUsed: true,
        },
      },
    });

    await renderHook(() => useAlarmDeepLink());
    await act(async () => undefined);

    const { scheduledAlarms } = useAlarmStore.getState();
    expect(scheduledAlarms[ORIGINAL_ID]).toBeUndefined();
    expect(scheduledAlarms[SNOOZE_ID]).toMatchObject({
      triggerTime: SNOOZE_ENDS,
      isPreview: true,
      quietUsed: true,
      firstTriggerTime: FIRST_RING,
    });
  });
});
