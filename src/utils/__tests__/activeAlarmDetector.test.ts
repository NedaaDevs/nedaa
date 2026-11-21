import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ALARM_OUTCOME } from "expo-alarm";

import { ACTIVE_ALARM_SOURCE, ALARM_DEFAULTS } from "@/constants/Alarm";
import { ScheduledAlarmType } from "@/enums/alarm";
import { nativeResults, resetNativeLog } from "@/test-helpers/expoAlarmLog";
import { detectActiveAlarm, endsByAge } from "@/utils/activeAlarmDetector";

const mockComplete = jest.fn((_id: string, _ending: object) => Promise.resolve());
jest.mock("expo-alarm", () => jest.requireActual("@/test-helpers/expoAlarmLog").expoAlarmLogModule);
jest.mock("@/utils/alarmReport", () => ({
  alarmLog: { i: jest.fn(), w: jest.fn(), e: jest.fn() },
}));
jest.mock("@/utils/alarmScheduler", () => ({
  completeAndRescheduleAlarm: (id: string, ending: object) => mockComplete(id, ending),
}));

const ALARM_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const HOUR = 60 * 60 * 1000;
const RINGING = { SELF: "self", OTHER: "other", NONE: "none" } as const;
type Ringing = (typeof RINGING)[keyof typeof RINGING];
const RINGING_ID: Record<Ringing, string | null> = {
  [RINGING.SELF]: ALARM_ID,
  [RINGING.OTHER]: OTHER_ID,
  [RINGING.NONE]: null,
};

// The Android JVM test PendingChallengeRuleTest reads the same table.
const FIXTURE = join(
  __dirname,
  "..",
  "..",
  "..",
  "modules",
  "expo-alarm",
  "fixtures",
  "stale-rule.tsv"
);
const sharedRows = readFileSync(FIXTURE, "utf8")
  .split("\n")
  .slice(1)
  .filter((line) => line.length > 0)
  .map((line) => {
    const [ringing, ageMs, ends] = line.split("\t");
    return { ringing: ringing as Ringing, ageMs: Number(ageMs), ends: ends === String(true) };
  });

const pastDueRecord = (ageMs: number) => ({
  [ALARM_ID]: {
    alarmId: ALARM_ID,
    alarmType: ScheduledAlarmType.FAJR,
    title: ScheduledAlarmType.FAJR,
    triggerTime: Date.now() - ageMs,
    liveActivityId: null,
    snoozeCount: 0,
  },
});

const pendingRow = (ageMs: number) => ({
  alarmId: ALARM_ID,
  alarmType: ScheduledAlarmType.FAJR,
  title: ScheduledAlarmType.FAJR,
  timestamp: Date.now() - ageMs,
});

beforeEach(() => {
  mockComplete.mockClear();
  resetNativeLog();
  nativeResults.getRingingAlarmId = null;
  nativeResults.getFutureAlarmIds = [];
  nativeResults.getCompletedAlarmIds = [];
  nativeResults.getPendingChallenge = null;
});

describe("endsByAge", () => {
  it.each(sharedRows)("ringing $ringing, $ageMs ms old: ends $ends", ({ ringing, ageMs, ends }) => {
    expect(endsByAge(ALARM_ID, ageMs, RINGING_ID[ringing])).toBe(ends);
  });

  it("uses the JS stale threshold", () => {
    expect(sharedRows.some((row) => row.ageMs === ALARM_DEFAULTS.STALE_ALARM_THRESHOLD_MS)).toBe(
      true
    );
  });
});

describe("detectActiveAlarm", () => {
  const OLD = 3 * HOUR;

  // The native ringing id, and whether the alarm is still found active
  // (otherwise it is abandoned). iOS reads null: androidReads.test.ts.
  const table = [
    { ringingId: ALARM_ID, active: true },
    { ringingId: null, active: false },
    { ringingId: OTHER_ID, active: false },
  ];

  describe.each([
    { path: "a pending challenge", source: ACTIVE_ALARM_SOURCE.PENDING_CHALLENGE, pending: true },
    { path: "a past-due record", source: ACTIVE_ALARM_SOURCE.PAST_DUE, pending: false },
  ])("$path, 3 h old", ({ source, pending }) => {
    it.each(table)("with ringing id $ringingId: active $active", async (row) => {
      nativeResults.getRingingAlarmId = row.ringingId;
      if (pending) nativeResults.getPendingChallenge = pendingRow(OLD);

      const active = await detectActiveAlarm(pending ? {} : pastDueRecord(OLD));

      if (row.active) {
        expect(active).toMatchObject({ alarmId: ALARM_ID, source });
        expect(mockComplete).not.toHaveBeenCalled();
      } else {
        expect(active).toBeNull();
        expect(mockComplete).toHaveBeenCalledWith(ALARM_ID, { outcome: ALARM_OUTCOME.ABANDONED });
      }
    });
  });

  // Alarm 2 fired while alarm 1 rang past 2 h, so native deferred it by a
  // minute; alarm 1 is then solved and the app comes to the front.
  it("leaves a deferred alarm to ring when the alarm before it is solved", async () => {
    nativeResults.getCompletedAlarmIds = [OTHER_ID];
    nativeResults.getRingingAlarmId = null;
    nativeResults.getFutureAlarmIds = [ALARM_ID];

    const active = await detectActiveAlarm(pastDueRecord(OLD));

    expect(active).toBeNull();
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it("does not show a deferred alarm as ringing before its new time", async () => {
    nativeResults.getFutureAlarmIds = [ALARM_ID];

    expect(await detectActiveAlarm(pastDueRecord(5 * 60 * 1000))).toBeNull();
  });
});
