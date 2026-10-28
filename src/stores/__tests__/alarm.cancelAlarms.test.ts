import { ScheduledAlarmType } from "@/enums/alarm";
import { type ScheduledAlarm, useAlarmStore } from "@/stores/alarm";
import { argsOf, nativeResults, resetNativeLog } from "@/test-helpers/expoAlarmLog";
import { resetMemoryKv } from "@/test-helpers/memoryKvStore";
import { generateDeterministicUUID, getAlarmKey } from "@/utils/alarmId";

jest.mock("expo-alarm", () => jest.requireActual("@/test-helpers/expoAlarmLog").expoAlarmLogModule);
jest.mock(
  "expo-sqlite/kv-store",
  () => jest.requireActual("@/test-helpers/memoryKvStore").memoryKvStoreModule
);
jest.mock("@/localization/i18n", () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));
jest.mock("@/utils/alarmReport", () => ({
  alarmLog: { i: jest.fn(), w: jest.fn(), e: jest.fn() },
}));
jest.mock("@/stores/alarmSettings", () => ({
  useAlarmSettingsStore: { getState: () => ({ fajr: { snooze: { maxCount: 3 } } }) },
}));

const NOW = new Date("2026-10-26T23:00:00.000Z").getTime();

const record = (alarmType: ScheduledAlarmType, at: string): ScheduledAlarm => ({
  alarmId: generateDeterministicUUID(getAlarmKey(alarmType, new Date(at))),
  alarmType,
  title: alarmType,
  triggerTime: new Date(at).getTime(),
  liveActivityId: null,
  snoozeCount: 0,
});

const FAJR_EARLY = record(ScheduledAlarmType.FAJR, "2026-10-27T00:00:00.000Z");
const FAJR_LATE = record(ScheduledAlarmType.FAJR, "2026-10-27T23:59:00.000Z");
const JUMMAH = record(ScheduledAlarmType.JUMMAH, "2026-10-30T08:55:00.000Z");

const storedIds = (): string[] => Object.keys(useAlarmStore.getState().scheduledAlarms);

beforeEach(() => {
  resetNativeLog();
  resetMemoryKv();
  jest.useFakeTimers({ now: NOW });
  useAlarmStore.setState({
    scheduledAlarms: Object.fromEntries(
      [FAJR_EARLY, FAJR_LATE, JUMMAH].map((alarm) => [alarm.alarmId, alarm])
    ),
  });
});
afterEach(() => jest.useRealTimers());

describe("alarm store checked cancel", () => {
  it.each([
    { outcome: "is refused", cancel: () => false },
    { outcome: "throws", cancel: () => Promise.reject(new Error("native cancel failed")) },
  ])("keeps the record of a cancel that $outcome and reports false", async ({ cancel }) => {
    nativeResults.cancelAlarm = (id: string) => (id === FAJR_EARLY.alarmId ? cancel() : true);

    const cancelled = await useAlarmStore
      .getState()
      .cancelAlarms([FAJR_EARLY.alarmId, FAJR_LATE.alarmId]);

    expect(cancelled).toBe(false);
    expect(argsOf("cancelAlarm")).toEqual([[FAJR_EARLY.alarmId], [FAJR_LATE.alarmId]]);
    expect(argsOf("deleteAlarmFromDB")).toEqual([[FAJR_LATE.alarmId]]);
    expect(storedIds()).toEqual([FAJR_EARLY.alarmId, JUMMAH.alarmId]);
  });

  it("cancelAlarmsByType cancels every record of its type and no other", async () => {
    const cancelled = await useAlarmStore.getState().cancelAlarmsByType(ScheduledAlarmType.FAJR);

    expect(cancelled).toBe(true);
    expect(argsOf("cancelAlarm")).toEqual([[FAJR_EARLY.alarmId], [FAJR_LATE.alarmId]]);
    expect(argsOf("deleteAlarmFromDB")).toEqual([[FAJR_EARLY.alarmId], [FAJR_LATE.alarmId]]);
    expect(storedIds()).toEqual([JUMMAH.alarmId]);
  });
});
