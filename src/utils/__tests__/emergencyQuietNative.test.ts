import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  EMERGENCY_QUIET_ALLOWANCES,
  EMERGENCY_QUIET_OFFER,
  type EmergencyQuietAllowance,
} from "@/constants/EmergencyQuiet";
import { ScheduledAlarmType } from "@/enums/alarm";
import { generateDeterministicUUID, getAlarmKey, getQuietKey } from "@/utils/alarmId";
import {
  allowanceInEffect,
  canSnoozeWith,
  chosenAllowance,
  confirmOpenFor,
  quietEndsAt,
  quietOfferFor,
  raiseStartsOn,
  recordUse,
  refillDate,
  runningQuietEnd,
  setAllowance,
  settleClock,
  usesLeft,
  type MonthKey,
  type QuietLedger,
} from "@/utils/emergencyQuiet";

// EmergencyQuietTest on the JVM reads the same tables.
const FIXTURES = join(__dirname, "..", "..", "..", "modules", "expo-alarm", "fixtures");

/** The tables' syntax; EmergencyQuietTest's QuietCell matches. */
const CELL = {
  NONE: "-",
  YES: "yes",
  NO: "no",
  RAISE: "@",
  SET: "set=",
  DATE: "-",
  TIME: "T",
  CLOCK: ":",
} as const;

/** A ledger row's op; EmergencyQuietTest's QuietOp matches. */
const OP = { LOOK: "look", USE: "use" } as const;

/** How a run row's id is made: the re-ring's own, or an occurrence's. */
const ID_KIND = { QUIET: "quiet", OTHER: "other" } as const;

const MONTHS_PER_YEAR = 12;

const table = (name: string): string[][] =>
  readFileSync(join(FIXTURES, name), "utf8")
    .split("\n")
    .slice(1)
    .filter((line) => line.length > 0)
    .map((line) => line.split("\t"));

const yes = (value: string): boolean => value === CELL.YES;

const shownFlag = (value: boolean): string => (value ? CELL.YES : CELL.NO);

const pad = (value: number): string => String(value).padStart(2, "0");

const allowanceOf = (value: string): EmergencyQuietAllowance => {
  const allowance = EMERGENCY_QUIET_ALLOWANCES.find((option) => option === Number(value));
  if (allowance === undefined) throw new Error(`no allowance ${value}`);
  return allowance;
};

// "2026-11" is November 2026.
const monthOf = (value: string): MonthKey | null => {
  if (value === CELL.NONE) return null;
  const [year, month] = value.split(CELL.DATE).map(Number);
  return year * MONTHS_PER_YEAR + month - 1;
};

const shownMonth = (month: MonthKey | null): string =>
  month === null
    ? CELL.NONE
    : `${Math.floor(month / MONTHS_PER_YEAR)}${CELL.DATE}${pad((month % MONTHS_PER_YEAR) + 1)}`;

// Device local time, so the table holds in every time zone.
const timeOf = (value: string): number | null => {
  if (value === CELL.NONE) return null;
  const [day, clock] = value.split(CELL.TIME);
  const [year, month, date] = day.split(CELL.DATE).map(Number);
  const [hours, minutes] = clock.split(CELL.CLOCK).map(Number);
  return new Date(year, month - 1, date, hours, minutes).getTime();
};

const shownDay = (date: Date | null): string =>
  date === null
    ? CELL.NONE
    : [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join(CELL.DATE);

const shownTime = (at: number | null): string => {
  if (at === null) return CELL.NONE;
  const date = new Date(at);
  return `${shownDay(date)}${CELL.TIME}${pad(date.getHours())}${CELL.CLOCK}${pad(date.getMinutes())}`;
};

const raiseOf = (value: string): QuietLedger["raise"] => {
  if (value === CELL.NONE) return null;
  const [to, from] = value.split(CELL.RAISE);
  const month = monthOf(from);
  if (month === null) throw new Error(`no month in ${value}`);
  return { to: allowanceOf(to), from: month };
};

const shownRaise = (raise: QuietLedger["raise"]): string =>
  raise ? `${raise.to}${CELL.RAISE}${shownMonth(raise.from)}` : CELL.NONE;

describe("quiet-ledger.tsv", () => {
  it.each(table("quiet-ledger.tsv"))(
    "allowance %s, raise %s, month %s, used %s, written %s; at %s, %s",
    (allowance, raise, month, used, written, nowCell, op, ...expected) => {
      const ledger: QuietLedger = {
        allowance: allowanceOf(allowance),
        raise: raiseOf(raise),
        month: monthOf(month),
        used: Number(used),
        lastWriteAt: timeOf(written),
      };
      const now = timeOf(nowCell) ?? Number.NaN;
      let counted: string = CELL.NONE;
      let after = ledger;
      if (op === OP.LOOK) {
        after = settleClock(ledger, now);
      } else if (op === OP.USE) {
        const spent = recordUse(ledger, now);
        counted = shownFlag(spent !== null);
        after = spent ?? ledger;
      } else {
        after = setAllowance(ledger, allowanceOf(op.slice(CELL.SET.length)), now);
      }
      expect([
        counted,
        String(after.allowance),
        shownRaise(after.raise),
        shownMonth(after.month),
        String(after.used),
        shownTime(after.lastWriteAt),
        String(usesLeft(after, now)),
        String(allowanceInEffect(after, now)),
        String(chosenAllowance(after, now)),
        shownDay(refillDate(after, now)),
        shownDay(raiseStartsOn(after, now)),
      ]).toEqual(expected);
    }
  );

  it("holds every op", () => {
    const ops = table("quiet-ledger.tsv").map((row) => row[6]);
    expect(ops).toEqual(expect.arrayContaining([OP.LOOK, OP.USE]));
    expect(ops.some((op) => op.startsWith(CELL.SET))).toBe(true);
  });
});

describe("quiet-offer.tsv", () => {
  it.each(table("quiet-offer.tsv"))(
    "task %s, preview %s, snoozed %s, way out %s, used %s, running %s, allowance %s, left %s, confirming %s",
    (
      hasTask,
      preview,
      snoozed,
      wayOut,
      used,
      running,
      allowance,
      left,
      confirming,
      offer,
      confirmOpen
    ) => {
      const shown = quietOfferFor({
        hasTask: yes(hasTask),
        preview: yes(preview),
        snoozed: yes(snoozed),
        wayOut: yes(wayOut),
        used: yes(used),
        quietUntil: yes(running) ? 1 : null,
        allowance: allowanceOf(allowance),
        left: Number(left),
      });
      expect([shown, confirmOpenFor(yes(confirming), shown)]).toEqual([offer, yes(confirmOpen)]);
    }
  );

  it("holds every offer", () => {
    expect(new Set(table("quiet-offer.tsv").map((row) => row[9]))).toEqual(
      new Set(Object.values(EMERGENCY_QUIET_OFFER))
    );
  });
});

describe("quiet-id.tsv", () => {
  it.each(table("quiet-id.tsv"))("%s quieted at %s rings at %s", (type, now, ringsAt, key, id) => {
    const at = new Date(quietEndsAt(Date.parse(now)));
    const made = getQuietKey(type, at);
    expect([at.toISOString(), made, generateDeterministicUUID(made)]).toEqual([ringsAt, key, id]);
  });
});

describe("quiet-run.tsv", () => {
  it.each(table("quiet-run.tsv"))(
    "%s at %s, id %s, used %s, now %s, snooze open %s",
    (type, trigger, kind, quietUsed, now, snoozeOpen, runningEnd, canSnooze) => {
      const triggerDate = new Date(trigger);
      const key =
        kind === ID_KIND.QUIET ? getQuietKey(type, triggerDate) : getAlarmKey(type, triggerDate);
      const end = runningQuietEnd(
        {
          alarmId: generateDeterministicUUID(key),
          alarmType: type as ScheduledAlarmType,
          triggerTime: triggerDate.getTime(),
          quietUsed: yes(quietUsed),
        },
        Date.parse(now)
      );
      expect([
        end === null ? CELL.NONE : new Date(end).toISOString(),
        canSnoozeWith(yes(snoozeOpen), end),
      ]).toEqual([runningEnd, yes(canSnooze)]);
    }
  );
});
