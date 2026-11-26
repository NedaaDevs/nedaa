/** Timing steps in ms, for Tamagui timing tokens and React Native `Animated`. */
export const DURATION_MS = {
  /** A finger landing on a row or card: the scale goes down this fast. */
  PRESS: 80,
  QUICK: 160,
  SETTLE: 220,
  GENTLE: 280,
  /** A theme change: the old screen's snapshot fading off the new one. */
  DISSOLVE: 350,
  SKY: 720,
} as const;

/**
 * Spring presets as Reanimated `withSpring` configs. The Tamagui config spreads
 * the same objects, so a spring is tuned in one place.
 */
export const SPRING = {
  /** A surface settling into place: sheets, indicators, switch thumbs. */
  SETTLE: { stiffness: 300, damping: 30, mass: 1 },
  /** A quick, firm response to a touch. */
  SNAP: { stiffness: 500, damping: 32, mass: 0.8 },
} as const;

/** iOS sheet curve, as cubic-bezier points: quick start, long settle. */
export const SHEET_CURVE = [0.32, 0.72, 0, 1] as const;

/** A bottom sheet's timings; it arrives on `SPRING.SETTLE`. */
export const SHEET_MOTION = {
  /** Leaving: a timing on `SHEET_CURVE`. */
  DISMISS_MS: DURATION_MS.SETTLE,
  /** Under Reduce Motion the sheet fades where it stands, both ways. */
  REDUCED_FADE_MS: 200,
  /** The scrim fades on its own timing, both ways, apart from the sheet. */
  SCRIM_MS: DURATION_MS.SETTLE,
  /** The hero's text fades in over this as the sheet starts to rise. */
  HERO_FADE_MS: 120,
} as const;

/** CSS ease-in-out: slow at both ends, so no frame jumps. */
export const EASE_IN_OUT_CURVE = [0.42, 0, 0.58, 1] as const;

/** The count that repeats until stopped: `Animated.loop`, `withRepeat`. */
export const LOOP_FOREVER = -1;
