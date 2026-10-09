import { isAlarmDue } from "@/utils/alarmDue";

const NOW = Date.UTC(2026, 9, 9, 4, 30);
const MINUTE = 60 * 1000;
const ID = "11111111-1111-4111-8111-111111111111";

describe("isAlarmDue", () => {
  it("is due once its trigger time has come", () => {
    expect(
      isAlarmDue({ alarmId: ID, triggerTime: NOW - MINUTE, pendingAlarmId: null, now: NOW })
    ).toBe(true);
  });

  it("is not due hours before its trigger time", () => {
    expect(
      isAlarmDue({
        alarmId: ID,
        triggerTime: NOW + 6 * 60 * MINUTE,
        pendingAlarmId: null,
        now: NOW,
      })
    ).toBe(false);
  });

  // A native snooze can fire before the store learns of it.
  it("is due when the native challenge names it, with no record", () => {
    expect(isAlarmDue({ alarmId: ID, triggerTime: null, pendingAlarmId: ID, now: NOW })).toBe(true);
  });

  it("is not due with no record and no open challenge", () => {
    expect(isAlarmDue({ alarmId: ID, triggerTime: null, pendingAlarmId: null, now: NOW })).toBe(
      false
    );
  });
});
