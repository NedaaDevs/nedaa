/** Where a mark on a timeline stands against the current time. */
export const TICK_STATE = { PASSED: "passed", CURRENT: "current", FUTURE: "future" } as const;
export type TickState = (typeof TICK_STATE)[keyof typeof TICK_STATE];

/** The day's arc's height, which its loading placeholder holds too. */
// No size token sits at 60.
export const RHYTHM_ARC_HEIGHT = 60;

// The day's arc in points: feet inset and height, control points' height and
// share of the width, then the strokes and the marks.
export const RHYTHM_ARC = {
  inset: 6,
  base: 50,
  crest: -4,
  controls: [60 / 340, 280 / 340],
  track: { stroke: 1.4, opacity: 0.28 },
  done: { stroke: 2.2 },
  mark: { radius: 4, quietRadius: 3, stroke: 1.2, pastOpacity: 0.55 },
  focus: { radius: 5.5, stroke: 2.6, glow: 4 },
} as const;
