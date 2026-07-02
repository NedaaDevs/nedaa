// Sect-neutral v1 registry. Dates are Hijri (month/day); names resolve via i18n.
export const ImportantDayId = {
  RAMADAN: "ramadan",
  EID_AL_FITR: "eid-al-fitr",
  ARAFAH: "arafah",
  EID_AL_ADHA: "eid-al-adha",
  HIJRI_NEW_YEAR: "hijri-new-year",
  ASHURA: "ashura",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type ImportantDayId = (typeof ImportantDayId)[keyof typeof ImportantDayId];

export type ImportantDayDef = {
  id: ImportantDayId;
  hijriMonth: number;
  hijriDay: number;
  i18nKey: string;
};

export const IMPORTANT_DAYS: ImportantDayDef[] = [
  { id: ImportantDayId.RAMADAN, hijriMonth: 9, hijriDay: 1, i18nKey: "importantDays.ramadan" },
  {
    id: ImportantDayId.EID_AL_FITR,
    hijriMonth: 10,
    hijriDay: 1,
    i18nKey: "importantDays.eidAlFitr",
  },
  { id: ImportantDayId.ARAFAH, hijriMonth: 12, hijriDay: 9, i18nKey: "importantDays.arafah" },
  {
    id: ImportantDayId.EID_AL_ADHA,
    hijriMonth: 12,
    hijriDay: 10,
    i18nKey: "importantDays.eidAlAdha",
  },
  {
    id: ImportantDayId.HIJRI_NEW_YEAR,
    hijriMonth: 1,
    hijriDay: 1,
    i18nKey: "importantDays.hijriNewYear",
  },
  { id: ImportantDayId.ASHURA, hijriMonth: 1, hijriDay: 10, i18nKey: "importantDays.ashura" },
];
