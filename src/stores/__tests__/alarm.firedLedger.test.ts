import { FIRED_LEDGER } from "@/constants/FiredPrayerGuard";
import { ScheduledAlarmType } from "@/enums/alarm";
import { readLedger, recordBooked } from "@/services/firedPrayerLedger";
import { type ScheduledAlarm, useAlarmStore } from "@/stores/alarm";
import { resetMemoryKv } from "@/test-helpers/memoryKvStore";

const mockResults: Record<string, unknown> = {};

jest.mock(
  "expo-alarm",
  () =>
    new Proxy(
      {},
      {
        get: (_target, name) => {
          if (name === "__esModule") return true;
          return (..._args: unknown[]) => {
            const result = String(name) in mockResults ? mockResults[String(name)] : true;
            if (result instanceof Error) throw result;
            return Promise.resolve(result);
          };
        },
      }
    )
);
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

const NOW = new Date("2026-10-26T01:00:00Z").getTime();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const RANG = { key: ScheduledAlarmType.FAJR, at: NOW - MINUTE };
const NEXT = { key: ScheduledAlarmType.FAJR, at: NOW + HOUR };

const record = (id: string, type: ScheduledAlarmType, triggerTime: number): ScheduledAlarm => ({
  alarmId: id,
  alarmType: type,
  title: "t",
  triggerTime,
  liveActivityId: null,
  snoozeCount: 0,
});
const ledger = () => readLedger(FIRED_LEDGER.ALARMS, NOW);

beforeEach(() => {
  for (const key of Object.keys(mockResults)) delete mockResults[key];
  mockResults.getPendingChallenge = null;
  resetMemoryKv();
  jest.useFakeTimers({ now: NOW });
  useAlarmStore.setState({
    scheduledAlarms: {
      rang: record("rang", RANG.key, RANG.at),
      next: record("next", NEXT.key, NEXT.at),
    },
  });
  recordBooked(FIRED_LEDGER.ALARMS, [RANG, NEXT], NOW);
});
afterEach(() => jest.useRealTimers());

describe("alarm store cancels and the fired ledger", () => {
  it("cancelling by type forgets the booking that had not rung", async () => {
    await useAlarmStore.getState().cancelAlarmsByType(ScheduledAlarmType.FAJR);
    expect(ledger()).toEqual([RANG]);
  });

  it("a refused native cancel forgets the booking", async () => {
    mockResults.cancelAlarm = false;
    await useAlarmStore.getState().cancelAlarmsByType(ScheduledAlarmType.FAJR);
    expect(ledger()).toEqual([RANG]);
  });

  it("a thrown native cancel forgets the booking", async () => {
    mockResults.cancelAlarm = new Error("bridge");
    await useAlarmStore.getState().cancelAlarmsByType(ScheduledAlarmType.FAJR);
    expect(ledger()).toEqual([RANG]);
  });

  it("cancelling one alarm forgets only its own booking", async () => {
    const friday = { key: ScheduledAlarmType.JUMMAH, at: NOW + 2 * HOUR };
    recordBooked(FIRED_LEDGER.ALARMS, [friday], NOW);
    await useAlarmStore.getState().cancelAlarm("next");
    expect(ledger()).toEqual([RANG, friday]);
  });

  it("forgets a cancelled booking when the database delete throws", async () => {
    mockResults.deleteAlarmFromDB = new Error("db");
    await useAlarmStore.getState().cancelAlarm("next");
    expect(ledger()).toEqual([RANG]);
  });

  it("forgets the bookings cancelled by type when the database delete throws", async () => {
    mockResults.deleteAlarmFromDB = new Error("db");
    await useAlarmStore.getState().cancelAlarmsByType(ScheduledAlarmType.FAJR);
    expect(ledger()).toEqual([RANG]);
  });

  it("cancelling every alarm forgets every booking that had not rung", async () => {
    await useAlarmStore.getState().cancelAllAlarms();
    expect(ledger()).toEqual([RANG]);
  });

  it("cancelling every alarm forgets the unrung bookings when the native cancel throws", async () => {
    mockResults.cancelAllAlarms = new Error("bridge");
    await useAlarmStore.getState().cancelAllAlarms();
    expect(ledger()).toEqual([RANG]);
  });
});
