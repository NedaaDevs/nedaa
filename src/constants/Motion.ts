/** Timing steps in ms, for Tamagui timing tokens and React Native `Animated`. */
export const DURATION_MS = { QUICK: 160, SETTLE: 220, GENTLE: 280, SKY: 720 } as const;

/** iOS sheet curve, as cubic-bezier points: quick start, long settle. */
export const SHEET_CURVE = [0.32, 0.72, 0, 1] as const;

/** The `Animated.loop` iteration count that repeats until stopped. */
export const LOOP_FOREVER = -1;
