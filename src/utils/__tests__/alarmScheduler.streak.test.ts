import { ALARM_OUTCOME } from "expo-alarm";
import { ScheduledAlarmType } from "@/enums/alarm";
import { completeAndRescheduleAlarm } from "@/utils/alarmScheduler";

const mockRecordFajrSuccess = jest.fn();
const mockScheduleAlarm = jest.fn((_params: object) => Promise.resolve(true));
const mockAlarms: Record<string, object> = {};

jest.mock("@/localization/i18n", () => ({ __esModule: true, default: { t: (k: string) => k } }));
jest.mock("@/utils/alarmReport", () => ({
  alarmLog: { i: jest.fn(), w: jest.fn(), e: jest.fn() },
}));
jest.mock("@/stores/alarmStreak", () => ({
  useAlarmStreakStore: { getState: () => ({ recordFajrSuccess: mockRecordFajrSuccess }) },
}));
jest.mock("@/stores/alarm", () => ({
  useAlarmStore: {
    getState: () => ({
      scheduledAlarms: mockAlarms,
      completeAlarm: jest.fn(() => Promise.resolve()),
      scheduleAlarm: (params: object) => mockScheduleAlarm(params),
    }),
    persist: {},
  },
}));
jest.mock("@/stores/alarmSettings", () => ({
  useAlarmSettingsStore: {
    getState: () => ({ fajr: { enabled: true, timing: { mode: "atPrayerTime" } } }),
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

const ALARM_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  mockRecordFajrSuccess.mockClear();
  mockScheduleAlarm.mockClear();
  for (const key of Object.keys(mockAlarms)) delete mockAlarms[key];
});

describe("completeAndRescheduleAlarm streak", () => {
  it("counts a real Fajr alarm", async () => {
    mockAlarms[ALARM_ID] = { alarmType: ScheduledAlarmType.FAJR, triggerTime: Date.now() };

    await completeAndRescheduleAlarm(ALARM_ID);

    expect(mockRecordFajrSuccess).toHaveBeenCalled();
  });

  it("does not count a preview alarm", async () => {
    mockAlarms[ALARM_ID] = {
      alarmType: ScheduledAlarmType.FAJR,
      triggerTime: Date.now(),
      isPreview: true,
    };

    await completeAndRescheduleAlarm(ALARM_ID);

    expect(mockRecordFajrSuccess).not.toHaveBeenCalled();
  });

  // An overlay completion can arrive after the store record is gone.
  it("reschedules from the queue's type when the store has no record", async () => {
    await completeAndRescheduleAlarm(ALARM_ID, {
      alarmType: ScheduledAlarmType.FAJR,
      outcome: ALARM_OUTCOME.SOLVED,
    });

    expect(mockScheduleAlarm).toHaveBeenCalledWith(
      expect.objectContaining({ alarmType: ScheduledAlarmType.FAJR })
    );
    expect(mockRecordFajrSuccess).not.toHaveBeenCalled();
  });

  it("does not count a challenge the overlay gave up on", async () => {
    mockAlarms[ALARM_ID] = { alarmType: ScheduledAlarmType.FAJR, triggerTime: Date.now() };

    await completeAndRescheduleAlarm(ALARM_ID, {
      alarmType: ScheduledAlarmType.FAJR,
      outcome: ALARM_OUTCOME.ABANDONED,
    });

    expect(mockRecordFajrSuccess).not.toHaveBeenCalled();
  });
});
