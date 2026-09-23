/** Where a mark on a timeline stands against the current time. */
export const TICK_STATE = { PASSED: "passed", CURRENT: "current", FUTURE: "future" } as const;
export type TickState = (typeof TICK_STATE)[keyof typeof TICK_STATE];
