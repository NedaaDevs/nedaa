import { FIRED_LEDGER } from "@/constants/FiredPrayerGuard";
import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { ScheduledAlarmType } from "@/enums/alarm";
import {
  forgetBooking,
  forgetUnfired,
  readLedger,
  recordBooked,
} from "@/services/firedPrayerLedger";
import { memoryKv, memoryKvFailure, resetMemoryKv } from "@/test-helpers/memoryKvStore";
import { notificationKey } from "@/utils/firedPrayerGuard";

jest.mock(
  "expo-sqlite/kv-store",
  () => jest.requireActual("@/test-helpers/memoryKvStore").memoryKvStoreModule
);

const mockWarn = jest.fn();
jest.mock("@/utils/appLogger", () => ({
  AppLogger: {
    create: () => ({
      d: jest.fn(),
      i: jest.fn(),
      w: (...args: unknown[]) => mockWarn(...args),
      e: jest.fn(),
    }),
  },
}));

const NOW = new Date("2026-10-26T14:00:00Z").getTime();
const HOUR = 3_600_000;
const N = FIRED_LEDGER.NOTIFICATIONS;
const A = FIRED_LEDGER.ALARMS;
const ISHA = notificationKey(NOTIFICATION_TYPE.PRAYER, "isha");
const FAJR = ScheduledAlarmType.FAJR;
const JUMMAH = ScheduledAlarmType.JUMMAH;

describe("firedPrayerLedger", () => {
  beforeEach(() => {
    resetMemoryKv();
    mockWarn.mockClear();
  });

  it("returns what was recorded", () => {
    recordBooked(N, [{ key: ISHA, at: NOW + HOUR }], NOW);
    expect(readLedger(N, NOW)).toEqual([{ key: ISHA, at: NOW + HOUR }]);
  });
  it("keeps the two ledgers apart", () => {
    recordBooked(A, [{ key: FAJR, at: NOW + HOUR }], NOW);
    expect(readLedger(N, NOW)).toEqual([]);
  });
  it("drops entries older than the window", () => {
    recordBooked(
      N,
      [
        { key: ISHA, at: NOW - 13 * HOUR },
        { key: ISHA, at: NOW - HOUR },
      ],
      NOW
    );
    expect(readLedger(N, NOW)).toEqual([{ key: ISHA, at: NOW - HOUR }]);
  });
  it("forgetUnfired keeps passed bookings and drops later ones", () => {
    recordBooked(
      N,
      [
        { key: ISHA, at: NOW - HOUR },
        { key: ISHA, at: NOW + HOUR },
      ],
      NOW
    );
    forgetUnfired(N, NOW);
    expect(readLedger(N, NOW)).toEqual([{ key: ISHA, at: NOW - HOUR }]);
  });
  it("forgetBooking drops the matching unfired booking only", () => {
    const rang = { key: FAJR, at: NOW - HOUR };
    const next = { key: FAJR, at: NOW + HOUR };
    const other = { key: JUMMAH, at: NOW + HOUR };
    recordBooked(A, [rang, next, other], NOW);
    forgetBooking(A, next, NOW);
    forgetBooking(A, rang, NOW);
    expect(readLedger(A, NOW)).toEqual([rang, other]);
  });
  it("reads an empty ledger and warns when storage throws", () => {
    memoryKvFailure.read = true;
    expect(readLedger(N, NOW)).toEqual([]);
    expect(mockWarn).toHaveBeenCalledTimes(1);
  });
  it.each(["not json", JSON.stringify({ key: 1 }), JSON.stringify([{ key: ISHA }])])(
    "reads an empty ledger when the stored value %s is not a ledger",
    (stored) => {
      memoryKv.set(N, stored);
      expect(readLedger(N, NOW)).toEqual([]);
    }
  );
  it("does not throw when a write fails", () => {
    memoryKvFailure.write = true;
    expect(() => recordBooked(N, [{ key: ISHA, at: NOW }], NOW)).not.toThrow();
  });
  it("skips the write when the read fails, so stored bookings survive", () => {
    recordBooked(N, [{ key: ISHA, at: NOW - HOUR }], NOW);
    memoryKvFailure.read = true;
    forgetUnfired(N, NOW);
    recordBooked(N, [{ key: ISHA, at: NOW + HOUR }], NOW);
    memoryKvFailure.read = false;
    expect(readLedger(N, NOW)).toEqual([{ key: ISHA, at: NOW - HOUR }]);
  });
  it("overwrites a stored value that is not a ledger on the next write", () => {
    memoryKv.set(N, "not json");
    recordBooked(N, [{ key: ISHA, at: NOW + HOUR }], NOW);
    expect(readLedger(N, NOW)).toEqual([{ key: ISHA, at: NOW + HOUR }]);
  });
});
