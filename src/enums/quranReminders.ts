export const Weekday = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
} as const;

export type WeekdayValue = (typeof Weekday)[keyof typeof Weekday];

// expo-notifications WEEKLY trigger uses 1=Sunday..7=Saturday.
export const weekdayToExpo = (weekday: WeekdayValue): number => weekday + 1;

export const QURAN_REMINDER_ID = "al-kahf";
