/** How a clock time is written: by twelve hours with a period, or by 24. */
export const CLOCK_FORMAT = { TWELVE_HOUR: "12h", TWENTY_FOUR_HOUR: "24h" } as const;
export type ClockFormat = (typeof CLOCK_FORMAT)[keyof typeof CLOCK_FORMAT];

/** The digits numbers are written in. */
export const NUMERAL_STYLE = { ARABIC: "arabic", WESTERN: "western" } as const;
export type NumeralStyle = (typeof NUMERAL_STYLE)[keyof typeof NUMERAL_STYLE];
