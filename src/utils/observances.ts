import { OBSERVANCES, type ObservanceDef, type Recurrence } from "@/constants/Observances";
import { ObservanceClass } from "@/enums/observances";
import { RAMADAN_MONTH } from "@/constants/Hijri";

export type HijriParts = { year: number; month: number; day: number };

export type ResolveDayArgs = {
  hijri: HijriParts;
  /** Already shifted by the user's hijriDaysOffset. */
  gregorian: Date;
  /** 29 or 30, from HijriNative.getDaysInMonth. */
  daysInMonth: number;
};

const matches = (recurrence: Recurrence, args: ResolveDayArgs): boolean => {
  const { hijri, gregorian, daysInMonth } = args;
  switch (recurrence.kind) {
    case "hijri-monthly":
      return recurrence.days.includes(hijri.day);
    case "weekday":
      return recurrence.weekdays.includes(gregorian.getDay());
    case "hijri-fixed":
      return hijri.month === recurrence.month && hijri.day === recurrence.day;
    case "hijri-range":
      return (
        hijri.month === recurrence.month &&
        hijri.day >= recurrence.from &&
        hijri.day <= recurrence.to
      );
    case "hijri-last-n":
      return hijri.month === recurrence.month && hijri.day >= daysInMonth - recurrence.count + 1;
  }
};

/**
 * Every observance that applies to one day, with the fasting rules resolved.
 * Pure: the caller supplies the offset-adjusted Gregorian date and the month
 * length, so nothing here touches the native calendar.
 */
export const resolveDay = (args: ResolveDayArgs): ObservanceDef[] => {
  let matched = OBSERVANCES.filter((o) => matches(o.recurrence, args));

  const dropRecommendedFasts = () =>
    matched.filter((o) => o.observanceClass !== ObservanceClass.RECOMMENDED_FAST);

  // The whole of Ramadan is an obligatory fast, so a recommendation to fast
  // tells the reader nothing.
  if (args.hijri.month === RAMADAN_MONTH) matched = dropRecommendedFasts();

  // A prohibition clears every fasting recommendation on the same day. It never
  // moves one to another date: that substitution is one school's position.
  if (matched.some((o) => o.observanceClass === ObservanceClass.FASTING_FORBIDDEN)) {
    matched = dropRecommendedFasts();
  }

  return matched;
};
