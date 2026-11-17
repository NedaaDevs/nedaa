/** Focus gesture thresholds, in points and points per second. */
export const FOCUS_GESTURE = {
  /** Movement under this is still a press. */
  SLOP: 10,
  TAP_MAX_MS: 250,
  /** A still touch starts the hold, which lands after the build. */
  HOLD_DELAY_MS: 200,
  HOLD_BUILD_MS: 500,
  HOLD_ADD: 10,
  UNDO_AT: 44,
  UNDO_FLICK_MIN: 20,
  /** Share of the width a side drag passes to move a dhikr. */
  SWIPE_COMMIT: 0.3,
  FLICK_MIN: 24,
  FLICK_VELOCITY: 500,
  /** Share of the drag the text follows toward a closed edge. */
  EDGE_RESISTANCE: 0.22,
} as const;

/** What a touch has become since it landed. */
export const FOCUS_MODE = {
  PENDING: "pending",
  SIDE: "side",
  DOWN: "down",
  DEAD: "dead",
  HELD: "held",
} as const;
export type FocusMode = (typeof FOCUS_MODE)[keyof typeof FOCUS_MODE];

/** What a lifted touch does. */
export const FOCUS_OUTCOME = {
  NONE: "none",
  TAP: "tap",
  NEXT: "next",
  PREVIOUS: "previous",
  UNDO: "undo",
  /** A step the session has no dhikr for. */
  EDGE_NEXT: "edgeNext",
  EDGE_PREVIOUS: "edgePrevious",
} as const;
export type FocusOutcome = (typeof FOCUS_OUTCOME)[keyof typeof FOCUS_OUTCOME];

/** One dhikr forward or back in the session. */
export const STEP = { NEXT: 1, PREVIOUS: -1 } as const;
export type StepDirection = (typeof STEP)[keyof typeof STEP];

export const FOCUS_TIMING = {
  /** How long the session position shows after the dhikr changes. */
  POSITION_MS: 1100,
  /** How long the first-or-last line replaces the hint. */
  EDGE_MESSAGE_MS: 1800,
} as const;

export const FOCUS_MOTION = {
  /** A dhikr gliding in after a committed drag. */
  GLIDE_MS: 280,
  /** A released drag going back, on a curve that overshoots once. */
  BACK_MS: 420,
  BACK_CURVE: [0.3, 1.3, 0.5, 1],
  /** A dhikr arriving with no slide, and the counter coming back. */
  FADE_MS: 200,
  /** The hold ring emptying after a hold lands or is let go. */
  DRAIN_MS: 160,
  /** The side drag over which the count fades out. */
  COUNT_FADE: 140,
  /** How far the count sinks under a drag down: a share, and a cap. */
  SINK: { SHARE: 0.5, MAX: 40 },
  /** The same with nothing to undo. */
  SINK_EMPTY: { SHARE: 0.15, MAX: 10 },
  /** Without motion a side drag dims the text: over this share, this much. */
  DIM: { SHARE: 0.5, MAX: 0.7 },
  /** The number while a release would undo. */
  ARMED_OPACITY: 0.45,
} as const;

/** What a screen reader can do on the Focus surface, beside activating it. */
export const FOCUS_ACTION = {
  ADD_MANY: "addMany",
  UNDO: "undo",
  NEXT: "next",
  PREVIOUS: "previous",
} as const;
