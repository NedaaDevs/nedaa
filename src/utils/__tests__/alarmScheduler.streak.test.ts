import { ALARM_OUTCOME } from "expo-alarm";
import { ScheduledAlarmType } from "@/enums/alarm";
import { type ScheduledAlarm, useAlarmStore } from "@/stores/alarm";
import { argsOf, resetNativeLog } from "@/test-helpers/expoAlarmLog";
import { resetMemoryKv } from "@/test-helpers/memoryKvStore";
import { completeAndRescheduleAlarm, schedulePreviewAlarm } from "@/utils/alarmScheduler";

const mockRecordFajrOutcome = jest.fn();

jest.mock("expo-alarm", () => jest.requireActual("@/test-helpers/expoAlarmLog").expoAlarmLogModule);
jest.mock(
  "expo-sqlite/kv-store",
  () => jest.requireActual("@/test-helpers/memoryKvStore").memoryKvStoreModule
);
jest.mock("@/localization/i18n", () => ({ __esModule: true, default: { t: (k: string) => k } }));
jest.mock("@/utils/alarmReport", () => ({
  alarmLog: { i: jest.fn(), w: jest.fn(), e: jest.fn() },
}));
jest.mock("@/stores/alarmStreak", () => ({
  useAlarmStreakStore: { getState: () => ({ recordFajrOutcome: mockRecordFajrOutcome }) },
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

const ALARM_ID = "11111111-1111-4111-8111-111111111111";

const SOLVED = { outcome: ALARM_OUTCOME.SOLVED };

const seed = (alarm: Partial<ScheduledAlarm>) =>
  useAlarmStore.setState({
    scheduledAlarms: {
      [ALARM_ID]: {
        alarmId: ALARM_ID,
        alarmType: ScheduledAlarmType.FAJR,
        title: ScheduledAlarmType.FAJR,
        triggerTime: Date.now(),
        liveActivityId: null,
        snoozeCount: 0,
        ...alarm,
      },
    },
  });

const armedTypes = () =>
  argsOf("scheduleAlarm").map(([params]) => (params as { alarmType: string }).alarmType);

beforeEach(() => {
  mockRecordFajrOutcome.mockClear();
  resetNativeLog();
  resetMemoryKv();
  useAlarmStore.setState({ scheduledAlarms: {} });
});

describe("completeAndRescheduleAlarm streak", () => {
  it("counts a real Fajr alarm as solved", async () => {
    const triggerTime = Date.now();
    seed({ triggerTime });

    await completeAndRescheduleAlarm(ALARM_ID, SOLVED);

    expect(mockRecordFajrOutcome).toHaveBeenCalledWith(triggerTime, ALARM_OUTCOME.SOLVED);
  });

  it.each([ALARM_OUTCOME.STOPPED, ALARM_OUTCOME.ABANDONED])(
    "hands a %s Fajr alarm's outcome to the streak",
    async (outcome) => {
      const triggerTime = Date.now();
      seed({ triggerTime });

      await completeAndRescheduleAlarm(ALARM_ID, { outcome });

      expect(mockRecordFajrOutcome).toHaveBeenCalledWith(triggerTime, outcome);
    }
  );

  it("does not count a preview alarm", async () => {
    seed({ isPreview: true });

    await completeAndRescheduleAlarm(ALARM_ID, SOLVED);

    expect(mockRecordFajrOutcome).not.toHaveBeenCalled();
  });

  // An overlay completion can arrive after the store record is gone.
  it("reschedules from the queue's type when the store has no record", async () => {
    await completeAndRescheduleAlarm(ALARM_ID, {
      alarmType: ScheduledAlarmType.FAJR,
      outcome: ALARM_OUTCOME.SOLVED,
    });

    expect(armedTypes()).toContain(ScheduledAlarmType.FAJR);
    expect(mockRecordFajrOutcome).not.toHaveBeenCalled();
  });

  it("reschedules a stopped Fajr alarm", async () => {
    seed({});

    await completeAndRescheduleAlarm(ALARM_ID, { outcome: ALARM_OUTCOME.STOPPED });

    expect(armedTypes()).toContain(ScheduledAlarmType.FAJR);
  });

  it.each([ALARM_OUTCOME.SOLVED, ALARM_OUTCOME.STOPPED])(
    "does not count a snoozed preview that ends %s",
    async (outcome) => {
      const previewId = await schedulePreviewAlarm(ScheduledAlarmType.FAJR);
      const snooze = await useAlarmStore.getState().snoozeAlarm(previewId ?? "");

      await completeAndRescheduleAlarm(snooze?.snoozeId ?? "", { outcome });

      expect(snooze).not.toBeNull();
      expect(mockRecordFajrOutcome).not.toHaveBeenCalled();
    }
  );
});
