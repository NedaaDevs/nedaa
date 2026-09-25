/** `AccessibilityInfo` events that report an OS setting turning on or off. */
export const A11Y_FLAG_EVENT = {
  SCREEN_READER: "screenReaderChanged",
  REDUCE_MOTION: "reduceMotionChanged",
} as const;

export type A11yFlagEvent = (typeof A11Y_FLAG_EVENT)[keyof typeof A11Y_FLAG_EVENT];
