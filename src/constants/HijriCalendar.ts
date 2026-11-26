import { DURATION_MS } from "@/constants/Motion";

export const DAYS_PER_WEEK = 7;

/** Weekday numbers from Sunday, as `Date.getDay` gives them. */
export const WEEKDAYS = Array.from({ length: DAYS_PER_WEEK }, (_, weekday) => weekday);

/** A day cell's height; marks and outlines draw inside it. */
export const DAY_CELL_HEIGHT = 60;

/** Today's bar under the numeral, in points. */
export const TODAY_BAR = { WIDTH: 18, HEIGHT: 3, INSET: 3 } as const;

/** How far a new month slides in from the side it came from. */
export const MONTH_SLIDE = 12;

export const MONTH_CHANGE_MS = DURATION_MS.GENTLE;

/** The day detail cross-fades when the selected day changes. */
export const DETAIL_FADE_MS = 180;

export const HIJRI_CALENDAR_TEST_ID = {
  WEEKDAY: "hijri-weekday",
} as const;

/** The month arrows' icon size; the icon ramp has no 22 step. */
export const NAV_ICON_SIZE = 22;
