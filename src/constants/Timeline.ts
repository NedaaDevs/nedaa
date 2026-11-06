/** Where a mark on a timeline stands against the current time. */
export const TICK_STATE = { PASSED: "passed", CURRENT: "current", FUTURE: "future" } as const;
export type TickState = (typeof TICK_STATE)[keyof typeof TICK_STATE];

// Today's bowl in points: one arc whose feet stand on a horizon, the
// countdown inside it, the marks on its rim.
export const BOWL = {
  /** The least height; the bowl grows with the countdown inside it. */
  leastHeight: 160,
  /** How far each foot stands in from its edge. */
  inset: 22,
  /** The top of the arc, below the bowl's top. */
  crest: 22,
  /** Under the horizon, where the feet's names sit. */
  footRoom: 24,
  /** The countdown's top, clear of a body at the crest. */
  insideTop: 30,
  /** How far each foot's name sits inward of its foot. */
  footNudge: 6,
  /** The sun's core or the moon's radius on the rim. */
  body: 12,
  track: { stroke: 1.4, opacity: 0.38, dash: [2, 5] },
  lit: { stroke: 2.2 },
  tick: { length: 3.5, quietLength: 2.5, stroke: 1.6, opacity: 0.75, pastOpacity: 0.4 },
  foot: { radius: 2.4, opacity: 0.55 },
  focus: { radius: 3.2, glow: 9, glowOpacity: 0.22 },
  selected: { radius: 6.5, stroke: 1.4 },
} as const;
