/** Ringing type at the Default text size; the app text scale multiplies it. */
export const RINGING_TYPE = {
  NAME: { fontSize: 44, lineHeight: 60 },
  TIME: { fontSize: 104, lineHeight: 120 },
  /** A snooze's minutes and seconds, narrower so five reels fit a phone. */
  COUNT: { fontSize: 72, lineHeight: 84 },
} as const;

/** The ring behind the time: its size, line and breath. */
export const RINGING_HALO = {
  SIZE: 316,
  RING: 1.5,
  BREATH_MS: 2400,
  SCALE: 1.06,
  REST_OPACITY: 0.3,
  LOW_OPACITY: 0.08,
} as const;

/** The ringing column's widest, so an expanded screen keeps it narrow. */
export const RINGING_MAX_WIDTH = 420;

/** Test ids of the ringing screen and the stopped panel. */
export const RINGING_PART = {
  HALO: "ringing-halo",
  SNOOZE_OFF: "ringing-snooze-off",
  SOLVED: "alarm-solved",
} as const;
