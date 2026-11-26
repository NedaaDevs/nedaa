import { ScheduledAlarmType } from "@/enums/alarm";
import type { ScheduledAlarm } from "@/stores/alarm";
import { isAlarmDue } from "@/utils/alarmDue";
import { generateDeterministicUUID, getQuietKey } from "@/utils/alarmId";
import { quietEndsAt } from "@/utils/emergencyQuiet";

const NOW = Date.UTC(2026, 9, 9, 4, 30);
const MINUTE = 60 * 1000;
const ID = "11111111-1111-4111-8111-111111111111";

const recordAt = (triggerTime: number, change: Partial<ScheduledAlarm> = {}): ScheduledAlarm => ({
  alarmId: ID,
  alarmType: ScheduledAlarmType.FAJR,
  title: ScheduledAlarmType.FAJR,
  triggerTime,
  liveActivityId: null,
  snoozeCount: 0,
  ...change,
});

describe("isAlarmDue", () => {
  it("is due once its trigger time has come", () => {
    expect(
      isAlarmDue({ alarmId: ID, record: recordAt(NOW - MINUTE), pendingAlarmId: null, now: NOW })
    ).toBe(true);
  });

  it("is not due hours before its trigger time", () => {
    expect(
      isAlarmDue({
        alarmId: ID,
        record: recordAt(NOW + 6 * 60 * MINUTE),
        pendingAlarmId: null,
        now: NOW,
      })
    ).toBe(false);
  });

  // The quieted alarm's task is still owed until the re-ring.
  it("is due while its emergency quiet runs", () => {
    const ends = quietEndsAt(NOW);
    const quietId = generateDeterministicUUID(getQuietKey(ScheduledAlarmType.FAJR, new Date(ends)));
    const record = recordAt(ends, { alarmId: quietId, quietUsed: true });

    expect(isAlarmDue({ alarmId: quietId, record, pendingAlarmId: null, now: NOW })).toBe(true);
  });

  // A native snooze can fire before the store learns of it.
  it("is due when the native challenge names it, with no record", () => {
    expect(isAlarmDue({ alarmId: ID, record: undefined, pendingAlarmId: ID, now: NOW })).toBe(true);
  });

  it("is not due with no record and no open challenge", () => {
    expect(isAlarmDue({ alarmId: ID, record: undefined, pendingAlarmId: null, now: NOW })).toBe(
      false
    );
  });
});
