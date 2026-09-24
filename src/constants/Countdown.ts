/** Which way the focus figure counts: to the next prayer, or from the last. */
export const COUNT_AXIS = { UNTIL: "until", SINCE: "since" } as const;

export type CountAxis = (typeof COUNT_AXIS)[keyof typeof COUNT_AXIS];

/** A figure's one-off whirl to its value on open or switch: quick, then landing. */
export const SPIN = { ms: 700 } as const;
