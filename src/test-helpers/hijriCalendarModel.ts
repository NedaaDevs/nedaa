import { HIJRI_MONTHS_PER_YEAR, RAMADAN_MONTH } from "@/constants/Hijri";

type HijriDate = { year: number; month: number; day: number };

const DAY_MS = 86_400_000;

/** 1 Jumada al-Thani 1448 falls on Wednesday 11 November 2026. */
const ANCHOR = { year: 1448, month: 6, serial: Date.UTC(2026, 10, 11) / DAY_MS } as const;

/** Odd months run 30 days and even months 29, except a 29-day Ramadan. */
const lengthOf = (month: number) => (month % 2 === 1 && month !== RAMADAN_MONTH ? 30 : 29);

// Not hijriMonthIndex: that module imports @/utils/date, which this model stands in for.
const monthIndex = (year: number, month: number) => year * HIJRI_MONTHS_PER_YEAR + month - 1;
const fromIndex = (index: number) => ({
  year: Math.floor(index / HIJRI_MONTHS_PER_YEAR),
  month: (index % HIJRI_MONTHS_PER_YEAR) + 1,
});

/** The UTC day number of a month's first day. */
const startOf = (year: number, month: number) => {
  const target = monthIndex(year, month);
  let index = monthIndex(ANCHOR.year, ANCHOR.month);
  let serial = ANCHOR.serial;
  for (; index < target; index++) serial += lengthOf(fromIndex(index).month);
  for (; index > target; index--) serial -= lengthOf(fromIndex(index - 1).month);
  return serial;
};

const fromSerial = (serial: number): HijriDate => {
  let index = monthIndex(ANCHOR.year, ANCHOR.month);
  let start = ANCHOR.serial;
  while (serial < start) {
    index--;
    start -= lengthOf(fromIndex(index).month);
  }
  while (serial >= start + lengthOf(fromIndex(index).month)) {
    start += lengthOf(fromIndex(index).month);
    index++;
  }
  return { ...fromIndex(index), day: serial - start + 1 };
};

const toSerial = ({ year, month, day }: HijriDate) => startOf(year, month) + day - 1;

/** A Gregorian date, as a local noon `Date`, for the model's Hijri date. */
export const gregorianOf = (year: number, month: number, day: number): Date => {
  const utc = new Date(toSerial({ year, month, day }) * DAY_MS);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), 12);
};

/** A stand-in for hijri-native with months of a fixed rhythm. */
export const hijriCalendarModel = {
  getDaysInMonth: (month: number, _year: number) => lengthOf(month),
  toGregorian: (year: number, month: number, day: number) => {
    const utc = new Date(toSerial({ year, month, day }) * DAY_MS);
    return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
  },
  fromTimestamp: (seconds: number, _timezone?: string): HijriDate => {
    const date = new Date(seconds * 1000);
    return fromSerial(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
  },
  addDays: (date: HijriDate, days: number): HijriDate => fromSerial(toSerial(date) + days),
};
