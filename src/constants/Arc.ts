/** Where a mark on a timeline stands against the current time. */
export const TICK_STATE = { PASSED: "passed", CURRENT: "current", FUTURE: "future" } as const;
export type TickState = (typeof TICK_STATE)[keyof typeof TICK_STATE];

/** How a stretch of the line shows: muted once passed, accent when selected. */
export const SEGMENT_TONE = { PASSED: "passed", SELECTED: "selected" } as const;
export type SegmentTone = (typeof SEGMENT_TONE)[keyof typeof SEGMENT_TONE];
