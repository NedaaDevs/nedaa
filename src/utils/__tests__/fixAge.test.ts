import { FIX_AGE_UNIT } from "@/constants/Location";
import { fixAgeOf } from "@/utils/fixAge";

const NOW = 1_750_000_000_000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("fixAgeOf", () => {
  it.each([
    ["under a minute", NOW - 59_999, { unit: FIX_AGE_UNIT.NOW, count: 0 }],
    ["a fix stamped ahead of the clock", NOW + 5_000, { unit: FIX_AGE_UNIT.NOW, count: 0 }],
    ["one minute", NOW - MINUTE, { unit: FIX_AGE_UNIT.MINUTES, count: 1 }],
    ["59 minutes", NOW - 59 * MINUTE - 59_999, { unit: FIX_AGE_UNIT.MINUTES, count: 59 }],
    ["one hour", NOW - HOUR, { unit: FIX_AGE_UNIT.HOURS, count: 1 }],
    ["23 hours", NOW - DAY + 1, { unit: FIX_AGE_UNIT.HOURS, count: 23 }],
    ["one day", NOW - DAY, { unit: FIX_AGE_UNIT.DAYS, count: 1 }],
    ["40 days", NOW - 40 * DAY, { unit: FIX_AGE_UNIT.DAYS, count: 40 }],
  ])("names %s in whole units, rounded down", (_name, fixedAt, age) => {
    expect(fixAgeOf(fixedAt, NOW)).toEqual(age);
  });
});
