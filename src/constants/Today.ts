/** Test ids for Today's scroll view and spacing groups. */
export const TODAY_SCREEN_PART = {
  SCROLL: "today-scroll",
  CONTENT: "today-content",
  FOCUS: "today-focus",
  DAY: "today-day",
} as const;

/** How Today draws the day. Stored values: never rename one. */
export const TODAY_STYLE = { BOWL: "bowl", SIMPLE: "simple" } as const;

export type TodayStyle = (typeof TODAY_STYLE)[keyof typeof TODAY_STYLE];
