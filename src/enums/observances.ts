export const ObservanceClass = {
  RECOMMENDED_FAST: "recommended-fast",
  BLESSED_DAY: "blessed-day",
  NIGHT_WORSHIP: "night-worship",
  FASTING_FORBIDDEN: "fasting-forbidden",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type ObservanceClass = (typeof ObservanceClass)[keyof typeof ObservanceClass];

export const ObservanceId = {
  WHITE_DAYS: "white-days",
  MONDAY_THURSDAY: "monday-thursday",
  FRIDAY: "friday",
  ASHURA: "ashura",
  DHUL_HIJJAH_FIRST_NINE: "dhul-hijjah-first-nine",
  RAMADAN_LAST_TEN: "ramadan-last-ten",
  EID_AL_FITR: "eid-al-fitr",
  EID_AL_ADHA: "eid-al-adha",
  AYYAM_AL_TASHREEQ: "ayyam-al-tashreeq",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type ObservanceId = (typeof ObservanceId)[keyof typeof ObservanceId];
