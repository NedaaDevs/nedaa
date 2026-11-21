import { ScheduledAlarmType } from "@/enums/alarm";
import { generateDeterministicUUID, getQuietKey, getSnoozeKey } from "@/utils/alarmId";
import {
  DEFAULT_EMERGENCY_QUIET_ALLOWANCE,
  EMERGENCY_QUIET_ALLOWANCE,
  EMERGENCY_QUIET_MINUTES,
  EMERGENCY_QUIET_OFFER,
} from "@/constants/EmergencyQuiet";
import {
  NEW_QUIET_LEDGER,
  allowanceInEffect,
  chosenAllowance,
  monthKeyOf,
  quietEndsAt,
  quietOfferFor,
  raiseStartsOn,
  readLedger,
  readPersistedLedger,
  recordUse,
  refillDate,
  runningQuietEnd,
  setAllowance,
  settleClock,
  usesLeft,
  type QuietLedger,
} from "@/utils/emergencyQuiet";

const { OFF, ONE, TWO, THREE } = EMERGENCY_QUIET_ALLOWANCE;
const MINUTE_MS = 60_000;

// Local wall-clock instants; the allowance follows the device's own month.
const at = (year: number, month: number, day: number, hour = 5) =>
  new Date(year, month - 1, day, hour).getTime();

const NOV_21 = at(2026, 11, 21);
const NOV_30_LATE = new Date(2026, 10, 30, 23, 59, 59).getTime();
const DEC_1_EARLY = new Date(2026, 11, 1, 0, 0, 1).getTime();
const DEC_31 = at(2026, 12, 31);
const JAN_1 = at(2027, 1, 1);
const OCT_15 = at(2026, 10, 15);
const DEC_5 = at(2026, 12, 5);
const NOV_21_NEXT_YEAR = at(2027, 11, 21);

const used = (times: number, now: number, from: QuietLedger = NEW_QUIET_LEDGER): QuietLedger => {
  let ledger = from;
  for (let n = 0; n < times; n += 1) {
    const next = recordUse(ledger, now);
    if (!next) throw new Error(`use ${n + 1} was refused`);
    ledger = next;
  }
  return ledger;
};

describe("the month an allowance counts in", () => {
  it.each([
    ["the last second of November and the first of December", NOV_30_LATE, DEC_1_EARLY],
    ["31 December and 1 January", DEC_31, JAN_1],
  ])("puts %s in different months", (_, before, after) => {
    expect(monthKeyOf(after)).toBe(monthKeyOf(before) + 1);
  });

  it("puts two days of one month in that month", () => {
    expect(monthKeyOf(at(2026, 11, 1))).toBe(monthKeyOf(NOV_30_LATE));
  });
});

describe("uses left", () => {
  it("starts at the default allowance", () => {
    expect(usesLeft(NEW_QUIET_LEDGER, NOV_21)).toBe(DEFAULT_EMERGENCY_QUIET_ALLOWANCE);
  });

  it.each([
    [0, TWO],
    [1, ONE],
    [2, OFF],
  ])("after %i uses this month, leaves %i", (times, left) => {
    expect(usesLeft(used(times, NOV_21), NOV_21)).toBe(left);
  });

  it("refuses a use once none is left", () => {
    expect(recordUse(used(TWO, NOV_21), NOV_21)).toBeNull();
  });

  it("refills on the first of the next month", () => {
    const spent = used(TWO, NOV_30_LATE);

    expect(usesLeft(spent, NOV_30_LATE)).toBe(0);
    expect(usesLeft(spent, DEC_1_EARLY)).toBe(TWO);
  });

  it("refills across a year", () => {
    expect(usesLeft(used(TWO, DEC_31), JAN_1)).toBe(TWO);
  });

  // The month moves only forward from the last write.
  it("never refills when the clock is set back a month", () => {
    const spent = used(TWO, NOV_21);

    expect(usesLeft(spent, OCT_15)).toBe(0);
    expect(recordUse(spent, OCT_15)).toBeNull();
  });

  it("counts a use made after the clock was set back in the clock's month", () => {
    const once = used(1, NOV_21);
    const again = used(1, OCT_15, once);

    expect(usesLeft(again, OCT_15)).toBe(0);
    expect(refillDate(again, OCT_15)).toEqual(new Date(2026, 10, 1));
  });

  // Each trip forward into a later month refills; the trip back adds nothing.
  it("grants no uses for a trip forward and back", () => {
    const once = used(1, NOV_21);
    const ahead = used(1, DEC_5, once);

    expect(usesLeft(once, DEC_5)).toBe(TWO);
    expect(usesLeft(ahead, NOV_21)).toBe(ONE);
    expect(usesLeft(used(1, NOV_21, ahead), NOV_21)).toBe(0);
  });

  it("does not lock the allowance after a boot in the wrong year", () => {
    const wrongYear = setAllowance(used(TWO, NOV_21_NEXT_YEAR), THREE, NOV_21_NEXT_YEAR);
    const corrected = settleClock(wrongYear, NOV_21);

    expect(usesLeft(corrected, NOV_21)).toBe(0);
    expect(raiseStartsOn(corrected, NOV_21)).toEqual(new Date(2026, 11, 1));
    expect(usesLeft(corrected, DEC_1_EARLY)).toBe(THREE);
  });

  it("settles only a clock set back since the last write", () => {
    const once = used(1, NOV_21);

    expect(settleClock(once, DEC_5)).toBe(once);
    expect(settleClock(once, OCT_15)).toEqual({
      ...once,
      month: monthKeyOf(OCT_15),
      lastWriteAt: OCT_15,
    });
  });

  it("offers none when the setting is off", () => {
    const off = setAllowance(NEW_QUIET_LEDGER, OFF, NOV_21);

    expect(usesLeft(off, NOV_21)).toBe(0);
    expect(recordUse(off, NOV_21)).toBeNull();
  });
});

describe("changing the allowance", () => {
  it("lowers at once, counting the month's uses", () => {
    const lowered = setAllowance(used(1, NOV_21), ONE, NOV_21);

    expect(allowanceInEffect(lowered, NOV_21)).toBe(ONE);
    expect(chosenAllowance(lowered, NOV_21)).toBe(ONE);
    expect(usesLeft(lowered, NOV_21)).toBe(0);
    expect(raiseStartsOn(lowered, NOV_21)).toBeNull();
  });

  it("turns off at once", () => {
    const off = setAllowance(NEW_QUIET_LEDGER, OFF, NOV_21);

    expect(allowanceInEffect(off, NOV_21)).toBe(OFF);
    expect(chosenAllowance(off, NOV_21)).toBe(OFF);
  });

  it("raises from the next month, showing the new number at once", () => {
    const raised = setAllowance(used(1, NOV_21), THREE, NOV_21);

    expect(chosenAllowance(raised, NOV_21)).toBe(THREE);
    expect(allowanceInEffect(raised, NOV_21)).toBe(TWO);
    expect(usesLeft(raised, NOV_21)).toBe(ONE);
    expect(raiseStartsOn(raised, NOV_21)).toEqual(new Date(2026, 11, 1));

    expect(allowanceInEffect(raised, DEC_1_EARLY)).toBe(THREE);
    expect(usesLeft(raised, DEC_1_EARLY)).toBe(THREE);
    expect(raiseStartsOn(raised, DEC_1_EARLY)).toBeNull();
  });

  it("keeps a raise from off off until the next month", () => {
    const off = setAllowance(NEW_QUIET_LEDGER, OFF, NOV_21);
    const raised = setAllowance(off, TWO, NOV_21);

    expect(usesLeft(raised, NOV_21)).toBe(0);
    expect(usesLeft(raised, DEC_1_EARLY)).toBe(TWO);
  });

  it("drops a pending raise when lowered again", () => {
    const raised = setAllowance(NEW_QUIET_LEDGER, THREE, NOV_21);
    const lowered = setAllowance(raised, ONE, NOV_21);

    expect(chosenAllowance(lowered, NOV_21)).toBe(ONE);
    expect(allowanceInEffect(lowered, DEC_1_EARLY)).toBe(ONE);
    expect(raiseStartsOn(lowered, NOV_21)).toBeNull();
  });

  it("drops a pending raise when set back to the allowance in effect", () => {
    const raised = setAllowance(NEW_QUIET_LEDGER, THREE, NOV_21);
    const back = setAllowance(raised, TWO, NOV_21);

    expect(chosenAllowance(back, NOV_21)).toBe(TWO);
    expect(raiseStartsOn(back, NOV_21)).toBeNull();
  });

  it("moves a pending raise to the newer number", () => {
    const one = setAllowance(NEW_QUIET_LEDGER, ONE, NOV_21);
    const raised = setAllowance(setAllowance(one, THREE, NOV_21), TWO, NOV_21);

    expect(allowanceInEffect(raised, NOV_21)).toBe(ONE);
    expect(allowanceInEffect(raised, DEC_1_EARLY)).toBe(TWO);
  });
});

describe("dates the screens show", () => {
  it.each([
    ["November", NOV_21, new Date(2026, 11, 1)],
    ["December", DEC_31, new Date(2027, 0, 1)],
  ])("refills a month of %s on the first of the next", (_, now, refill) => {
    expect(refillDate(used(TWO, now), now)).toEqual(refill);
  });

  it("refills from the clock's month after it is set back", () => {
    expect(refillDate(used(TWO, NOV_21), OCT_15)).toEqual(new Date(2026, 10, 1));
  });

  it("ends a quiet its length after it starts", () => {
    expect(quietEndsAt(NOV_21) - NOV_21).toBe(EMERGENCY_QUIET_MINUTES * MINUTE_MS);
  });
});

describe("what a ringing alarm offers", () => {
  const RINGING = {
    hasTask: true,
    preview: false,
    snoozed: false,
    wayOut: false,
    used: false,
    quietUntil: null,
    allowance: TWO,
    left: ONE,
  } as const;

  it.each([
    ["a use left", {}, EMERGENCY_QUIET_OFFER.OFFER],
    ["the last use left", { left: 1 }, EMERGENCY_QUIET_OFFER.OFFER],
    ["no use left", { left: 0 }, EMERGENCY_QUIET_OFFER.NONE_LEFT],
    ["the setting off", { allowance: OFF, left: 0 }, EMERGENCY_QUIET_OFFER.HIDDEN],
    ["quiet used for this alarm", { used: true }, EMERGENCY_QUIET_OFFER.USED],
    ["quiet used and none left", { used: true, left: 0 }, EMERGENCY_QUIET_OFFER.USED],
    ["the way out shown", { wayOut: true }, EMERGENCY_QUIET_OFFER.HIDDEN],
    ["the way out shown after a quiet", { wayOut: true, used: true }, EMERGENCY_QUIET_OFFER.HIDDEN],
    ["no task", { hasTask: false }, EMERGENCY_QUIET_OFFER.HIDDEN],
    ["a settings preview", { preview: true }, EMERGENCY_QUIET_OFFER.HIDDEN],
    ["a snooze running", { snoozed: true }, EMERGENCY_QUIET_OFFER.HIDDEN],
    ["a quiet running", { used: true, quietUntil: NOV_21 }, EMERGENCY_QUIET_OFFER.ON],
  ])("with %s", (_, change, offer) => {
    expect(quietOfferFor({ ...RINGING, ...change })).toBe(offer);
  });
});

describe("a running quiet's record", () => {
  const ENDS = quietEndsAt(NOV_21);
  const reRing = {
    alarmId: generateDeterministicUUID(getQuietKey(ScheduledAlarmType.FAJR, new Date(ENDS))),
    alarmType: ScheduledAlarmType.FAJR,
    triggerTime: ENDS,
    quietUsed: true,
  };

  it("ends at the re-ring's trigger while that is ahead", () => {
    expect(runningQuietEnd(reRing, NOV_21)).toBe(ENDS);
  });

  it("is over once the re-ring's trigger has come", () => {
    expect(runningQuietEnd(reRing, ENDS)).toBeNull();
  });

  it.each([
    ["no record", undefined],
    [
      "a snooze that carries the quiet",
      {
        ...reRing,
        alarmId: generateDeterministicUUID(
          getSnoozeKey(ScheduledAlarmType.FAJR, new Date(ENDS), 1)
        ),
      },
    ],
    ["an unquieted record", { ...reRing, quietUsed: undefined }],
  ])("is none for %s", (_, record) => {
    expect(runningQuietEnd(record, NOV_21)).toBeNull();
  });
});

describe("a saved ledger", () => {
  it("reads back what was written", () => {
    const ledger = setAllowance(used(1, NOV_21), THREE, NOV_21);

    expect(readLedger(JSON.parse(JSON.stringify(ledger)))).toEqual(ledger);
  });

  it.each([
    ["nothing", undefined],
    ["a string", "2"],
    ["an allowance the setting never offers", { ...NEW_QUIET_LEDGER, allowance: 7 }],
    ["a negative use count", { ...NEW_QUIET_LEDGER, used: -1 }],
    ["a broken raise", { ...NEW_QUIET_LEDGER, raise: { to: THREE } }],
    ["a month that is not a number", { ...NEW_QUIET_LEDGER, month: "11" }],
    ["a write time that is not a number", { ...NEW_QUIET_LEDGER, lastWriteAt: "5" }],
  ])("reads %s as a new ledger", (_, value) => {
    expect(readLedger(value)).toEqual(NEW_QUIET_LEDGER);
  });

  it("reads the ledger out of a saved store", () => {
    const ledger = used(1, NOV_21);

    expect(readPersistedLedger({ ledger })).toEqual(ledger);
    expect(readPersistedLedger(null)).toEqual(NEW_QUIET_LEDGER);
  });
});
