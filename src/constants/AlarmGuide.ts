/** The guide's cards, in the order it shows them. */
export const ALARM_GUIDE_CARD = {
  ALARM: "alarm",
  TASK: "task",
  TRY: "try",
  WAY_OUT: "wayOut",
} as const;

export type AlarmGuideCardId = (typeof ALARM_GUIDE_CARD)[keyof typeof ALARM_GUIDE_CARD];

export const ALARM_GUIDE_CARDS: readonly AlarmGuideCardId[] = Object.values(ALARM_GUIDE_CARD);

/** Each card's title. */
export const ALARM_GUIDE_TITLE_KEY = {
  [ALARM_GUIDE_CARD.ALARM]: "alarm.guide.alarm.title",
  [ALARM_GUIDE_CARD.TASK]: "alarm.guide.task.title",
  [ALARM_GUIDE_CARD.TRY]: "alarm.guide.try.title",
  [ALARM_GUIDE_CARD.WAY_OUT]: "alarm.guide.wayOut.title",
} as const satisfies Record<AlarmGuideCardId, string>;

/** The guide's width at most, so an expanded screen keeps short lines. */
export const ALARM_GUIDE_MAX_WIDTH = 520;

/** Where reader focus returns once the guide closes. */
export const ALARM_GUIDE_RETURN = {
  /** The top of the screen, after a first visit. */
  TOP: "top",
  ROW: "row",
  /** The wake-up task section, after "Try a task". */
  PICKER: "picker",
} as const;

export type AlarmGuideReturn = (typeof ALARM_GUIDE_RETURN)[keyof typeof ALARM_GUIDE_RETURN];

/** The fixed row's test id, for the screen's tests. */
export const ALARM_GUIDE_ROW_TEST_ID = "alarm-guide-row";

/** The wake-up task section the guide scrolls to, for the screen's tests. */
export const ALARM_TASK_SECTION_TEST_ID = "alarm-task-section";
