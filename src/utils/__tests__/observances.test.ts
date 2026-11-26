import { WEEKDAYS } from "@/constants/HijriCalendar";
import {
  isWeekly,
  monthWeeklyObservances,
  resolveDay,
  weekdayObservances,
} from "@/utils/observances";
import { RAMADAN_MONTH } from "@/constants/Hijri";
import { ObservanceId } from "@/enums/observances";

// Any Date works: only getDay() is read. These are real dates for readability.
const MON = new Date(2026, 7, 24);
const THU = new Date(2026, 7, 27);
const FRI = new Date(2026, 7, 28);
const SUN = new Date(2026, 7, 23);

const ids = (args: Parameters<typeof resolveDay>[0]) =>
  resolveDay(args)
    .map((o) => o.id)
    .sort();

describe("resolveDay", () => {
  it("returns the White Day and Friday for 15 Rabi al-Awwal 1448", () => {
    expect(
      ids({ hijri: { year: 1448, month: 3, day: 15 }, gregorian: FRI, daysInMonth: 29 })
    ).toEqual([ObservanceId.FRIDAY, ObservanceId.WHITE_DAYS].sort());
  });

  it("suppresses the White Day on 13 Dhu al-Hijjah and never moves it to the 16th", () => {
    expect(
      ids({ hijri: { year: 1448, month: 12, day: 13 }, gregorian: SUN, daysInMonth: 30 })
    ).toEqual([ObservanceId.AYYAM_AL_TASHREEQ]);

    expect(
      ids({ hijri: { year: 1448, month: 12, day: 16 }, gregorian: SUN, daysInMonth: 30 })
    ).toEqual([]);
  });

  it("suppresses the weekly fast when Eid al-Fitr falls on a Monday", () => {
    expect(
      ids({ hijri: { year: 1448, month: 10, day: 1 }, gregorian: MON, daysInMonth: 29 })
    ).toEqual([ObservanceId.EID_AL_FITR]);
  });

  it("keeps a blessed day alongside a prohibition", () => {
    expect(
      ids({ hijri: { year: 1448, month: 12, day: 11 }, gregorian: FRI, daysInMonth: 30 })
    ).toEqual([ObservanceId.AYYAM_AL_TASHREEQ, ObservanceId.FRIDAY].sort());
  });

  it("drops recommended fasts inside Ramadan, since the month is already obligatory", () => {
    expect(
      ids({ hijri: { year: 1448, month: 9, day: 13 }, gregorian: THU, daysInMonth: 29 })
    ).toEqual([]);
  });

  it("starts the last ten nights on the 20th of a 29-day Ramadan", () => {
    expect(
      ids({ hijri: { year: 1448, month: 9, day: 20 }, gregorian: SUN, daysInMonth: 29 })
    ).toEqual([ObservanceId.RAMADAN_LAST_TEN]);
    expect(
      ids({ hijri: { year: 1448, month: 9, day: 19 }, gregorian: SUN, daysInMonth: 29 })
    ).toEqual([]);
  });

  it("starts the last ten nights on the 21st of a 30-day Ramadan", () => {
    expect(
      ids({ hijri: { year: 1448, month: 9, day: 21 }, gregorian: SUN, daysInMonth: 30 })
    ).toEqual([ObservanceId.RAMADAN_LAST_TEN]);
    expect(
      ids({ hijri: { year: 1448, month: 9, day: 20 }, gregorian: SUN, daysInMonth: 30 })
    ).toEqual([]);
  });

  it("returns the first nine of Dhu al-Hijjah as a recommended fast before Arafah", () => {
    expect(
      ids({ hijri: { year: 1448, month: 12, day: 8 }, gregorian: SUN, daysInMonth: 30 })
    ).toEqual([ObservanceId.DHUL_HIJJAH_FIRST_NINE]);
  });

  it("returns the Day of Arafah alone on 9 Dhu al-Hijjah", () => {
    expect(
      ids({ hijri: { year: 1448, month: 12, day: 9 }, gregorian: SUN, daysInMonth: 30 })
    ).toEqual([ObservanceId.ARAFAH]);
  });

  it("returns Tasu'a on 9 Muharram and Ashura on the 10th", () => {
    expect(
      ids({ hijri: { year: 1448, month: 1, day: 9 }, gregorian: SUN, daysInMonth: 30 })
    ).toEqual([ObservanceId.TASUA]);
    expect(
      ids({ hijri: { year: 1448, month: 1, day: 10 }, gregorian: SUN, daysInMonth: 30 })
    ).toEqual([ObservanceId.ASHURA]);
  });
});

describe("weekdayObservances", () => {
  const weekdayIds = (weekday: number, month: number) =>
    weekdayObservances(weekday, month).map((o) => o.id);

  it("marks Monday and Thursday as a fast and Friday as blessed", () => {
    expect(weekdayIds(MON.getDay(), 3)).toEqual([ObservanceId.MONDAY_THURSDAY]);
    expect(weekdayIds(THU.getDay(), 3)).toEqual([ObservanceId.MONDAY_THURSDAY]);
    expect(weekdayIds(FRI.getDay(), 3)).toEqual([ObservanceId.FRIDAY]);
    expect(weekdayIds(SUN.getDay(), 3)).toEqual([]);
  });

  it("drops the weekly fast in Ramadan and keeps Friday", () => {
    expect(weekdayIds(MON.getDay(), RAMADAN_MONTH)).toEqual([]);
    expect(weekdayIds(FRI.getDay(), RAMADAN_MONTH)).toEqual([ObservanceId.FRIDAY]);
  });

  it("agrees with resolveDay on every weekday of a plain month", () => {
    for (let offset = 0; offset < 7; offset++) {
      const gregorian = new Date(2026, 7, 23 + offset);
      const weekly = resolveDay({
        hijri: { year: 1448, month: 3, day: 2 },
        gregorian,
        daysInMonth: 29,
      }).filter(isWeekly);
      expect(weekly).toEqual(weekdayObservances(gregorian.getDay(), 3));
    }
  });
});

describe("monthWeeklyObservances", () => {
  const everyWeekday = (month: number) => [
    ...new Set(WEEKDAYS.flatMap((weekday) => weekdayObservances(weekday, month)).map((o) => o.id)),
  ];

  it.each([3, RAMADAN_MONTH])("holds each weekday's observances once in month %i", (month) => {
    expect(monthWeeklyObservances(month).map((o) => o.id)).toEqual(everyWeekday(month));
  });
});
