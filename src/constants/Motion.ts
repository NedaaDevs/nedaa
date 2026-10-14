/** Timing steps in ms, for Tamagui timing tokens and React Native `Animated`. */
export const DURATION_MS = {
  QUICK: 160,
  SETTLE: 220,
  GENTLE: 280,
  /** A theme change: the old screen's snapshot fading off the new one. */
  DISSOLVE: 350,
  SKY: 720,
} as const;

/** iOS sheet curve, as cubic-bezier points: quick start, long settle. */
export const SHEET_CURVE = [0.32, 0.72, 0, 1] as const;

/** CSS ease-in-out: slow at both ends, so no frame jumps. */
export const EASE_IN_OUT_CURVE = [0.42, 0, 0.58, 1] as const;

/** The count that repeats until stopped: `Animated.loop`, `withRepeat`. */
export const LOOP_FOREVER = -1;
