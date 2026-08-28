import { ObservanceClass, ObservanceId } from "@/enums/observances";

export type Recurrence =
  // The same Hijri days every month, e.g. the White Days.
  | { kind: "hijri-monthly"; days: number[] }
  // JS getDay() values, 0 = Sunday. These render on the column headers.
  | { kind: "weekday"; weekdays: number[] }
  | { kind: "hijri-fixed"; month: number; day: number }
  | { kind: "hijri-range"; month: number; from: number; to: number }
  // Counts back from the month's true length, which is 29 or 30.
  | { kind: "hijri-last-n"; month: number; count: number };

export type ObservanceDef = {
  id: ObservanceId;
  recurrence: Recurrence;
  observanceClass: ObservanceClass;
  nameKey: string;
  rulingKey: string;
};

export const OBSERVANCES: ObservanceDef[] = [
  {
    id: ObservanceId.WHITE_DAYS,
    recurrence: { kind: "hijri-monthly", days: [13, 14, 15] },
    observanceClass: ObservanceClass.RECOMMENDED_FAST,
    nameKey: "hijriCalendar.observances.whiteDays",
    rulingKey: "hijriCalendar.rulings.whiteDays",
  },
  {
    id: ObservanceId.MONDAY_THURSDAY,
    recurrence: { kind: "weekday", weekdays: [1, 4] },
    observanceClass: ObservanceClass.RECOMMENDED_FAST,
    nameKey: "hijriCalendar.observances.mondayThursday",
    rulingKey: "hijriCalendar.rulings.mondayThursday",
  },
  {
    id: ObservanceId.FRIDAY,
    recurrence: { kind: "weekday", weekdays: [5] },
    observanceClass: ObservanceClass.BLESSED_DAY,
    nameKey: "hijriCalendar.observances.friday",
    rulingKey: "hijriCalendar.rulings.friday",
  },
  {
    id: ObservanceId.ASHURA,
    recurrence: { kind: "hijri-range", month: 1, from: 9, to: 10 },
    observanceClass: ObservanceClass.RECOMMENDED_FAST,
    nameKey: "hijriCalendar.observances.ashura",
    rulingKey: "hijriCalendar.rulings.ashura",
  },
  {
    id: ObservanceId.DHUL_HIJJAH_FIRST_NINE,
    recurrence: { kind: "hijri-range", month: 12, from: 1, to: 9 },
    observanceClass: ObservanceClass.RECOMMENDED_FAST,
    nameKey: "hijriCalendar.observances.dhulHijjahFirstNine",
    rulingKey: "hijriCalendar.rulings.dhulHijjahFirstNine",
  },
  {
    id: ObservanceId.RAMADAN_LAST_TEN,
    recurrence: { kind: "hijri-last-n", month: 9, count: 10 },
    observanceClass: ObservanceClass.NIGHT_WORSHIP,
    nameKey: "hijriCalendar.observances.ramadanLastTen",
    rulingKey: "hijriCalendar.rulings.ramadanLastTen",
  },
  {
    id: ObservanceId.EID_AL_FITR,
    recurrence: { kind: "hijri-fixed", month: 10, day: 1 },
    observanceClass: ObservanceClass.FASTING_FORBIDDEN,
    nameKey: "hijriCalendar.observances.eidAlFitr",
    rulingKey: "hijriCalendar.rulings.eidAlFitr",
  },
  {
    id: ObservanceId.EID_AL_ADHA,
    recurrence: { kind: "hijri-fixed", month: 12, day: 10 },
    observanceClass: ObservanceClass.FASTING_FORBIDDEN,
    nameKey: "hijriCalendar.observances.eidAlAdha",
    rulingKey: "hijriCalendar.rulings.eidAlAdha",
  },
  {
    id: ObservanceId.AYYAM_AL_TASHREEQ,
    recurrence: { kind: "hijri-range", month: 12, from: 11, to: 13 },
    observanceClass: ObservanceClass.FASTING_FORBIDDEN,
    nameKey: "hijriCalendar.observances.ayyamAlTashreeq",
    rulingKey: "hijriCalendar.rulings.ayyamAlTashreeq",
  },
];

// Recommendations with no agreed dates cannot be cells, so the month carries
// them as one line under its header.
export const MONTH_NOTES: Partial<Record<number, string>> = {
  1: "hijriCalendar.notes.muharram",
  8: "hijriCalendar.notes.shaban",
  9: "hijriCalendar.notes.ramadan",
  10: "hijriCalendar.notes.shawwal",
  12: "hijriCalendar.notes.dhulHijjah",
};
