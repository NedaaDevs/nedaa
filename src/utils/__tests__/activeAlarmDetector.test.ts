import { ALARM_OUTCOME } from "expo-alarm";

import { ALARM_DEFAULTS } from "@/constants/Alarm";
import { ScheduledAlarmType } from "@/enums/alarm";
import { nativeResults, resetNativeLog } from "@/test-helpers/expoAlarmLog";
import { detectActiveAlarm } from "@/utils/activeAlarmDetector";

const mockComplete = jest.fn((_id: string, _ending: object) => Promise.resolve());

jest.mock("expo-alarm", () => jest.requireActual("@/test-helpers/expoAlarmLog").expoAlarmLogModule);
jest.mock("@/utils/alarmReport", () => ({
  alarmLog: { i: jest.fn(), w: jest.fn(), e: jest.fn() },
}));
jest.mock("@/utils/alarmScheduler", () => ({
  completeAndRescheduleAlarm: (id: string, ending: object) => mockComplete(id, ending),
}));

const ALARM_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  mockComplete.mockClear();
  resetNativeLog();
  nativeResults.getCompletedAlarmIds = [];
  nativeResults.getPendingChallenge = null;
});

describe("detectActiveAlarm", () => {
  it("ends an alarm past the stale threshold as abandoned", async () => {
    const triggerTime = Date.now() - ALARM_DEFAULTS.STALE_ALARM_THRESHOLD_MS - 1;

    const active = await detectActiveAlarm({
      [ALARM_ID]: {
        alarmId: ALARM_ID,
        alarmType: ScheduledAlarmType.FAJR,
        title: ScheduledAlarmType.FAJR,
        triggerTime,
        liveActivityId: null,
        snoozeCount: 0,
      },
    });

    expect(active).toBeNull();
    expect(mockComplete).toHaveBeenCalledWith(ALARM_ID, { outcome: ALARM_OUTCOME.ABANDONED });
  });
});
