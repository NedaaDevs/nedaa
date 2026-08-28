// The Umm al-Qura tables behind NSCalendar and HijrahChronology cover roughly
// 1300-1600 AH, and neither platform guards the edges: Android throws, iOS
// returns undefined components. This window spans Nov 1979 to Nov 2076, well
// inside them. Every screen that lets the user pick or page a Hijri date
// clamps to it.
export const HIJRI_YEAR_MIN = 1400;
export const HIJRI_YEAR_MAX = 1500;

export const RAMADAN_MONTH = 9;
