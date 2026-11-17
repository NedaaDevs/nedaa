import { BRIGHTNESS, type Brightness, type PaletteEntry } from "@/constants/Palette";

/** The two strings the Subha look counts repeats on. */
export const SUBHA_STRING_KIND = { READER: "reader", FOCUS: "focus" } as const;
export type SubhaStringKind = (typeof SUBHA_STRING_KIND)[keyof typeof SUBHA_STRING_KIND];

type StringDrawing = {
  WIDTH: number;
  /** A bead's diameter. */
  BEAD: number;
  /** How far the string's middle hangs below its ends. */
  SAG: number;
};

/** Each string's box and beads, in points. */
export const SUBHA_STRING = {
  [SUBHA_STRING_KIND.READER]: { WIDTH: 220, BEAD: 16, SAG: 0 },
  [SUBHA_STRING_KIND.FOCUS]: { WIDTH: 284, BEAD: 20, SAG: 16 },
} as const satisfies Record<SubhaStringKind, StringDrawing>;

/** The string's beads and lines. */
export const SUBHA_BEADS = {
  /** Beads on a string: a count past this goes round again. */
  ROUND: 10,
  /** Space between two beads that rest together. */
  GAP: 4,
  /** A bead not yet counted. */
  WAITING_OPACITY: 0.6,
  LINE: { WIDTH: 1.2, OPACITY: 0.35 },
  /** Where the light sits on a bead, as shares of its size. */
  LIGHT_AT: { X: 0.35, Y: 0.3 },
  /** The middle stop of a bead's three colours. */
  MID_STOP: 0.55,
} as const;

type BeadInk = {
  readonly light: PaletteEntry;
  readonly mid: PaletteEntry;
  readonly edge: PaletteEntry;
};

/** A bead's three colours: pale glass by day, gold by night. */
export const SUBHA_BEAD_INK = {
  [BRIGHTNESS.LIGHT]: {
    light: { oklch: "oklch(100% 0 0)", hex: "#FFFFFF" },
    mid: { oklch: "oklch(93% 0.03 225)", hex: "#D4EDF7" },
    edge: { oklch: "oklch(80% 0.06 238)", hex: "#9AC4E0" },
  },
  [BRIGHTNESS.DARK]: {
    light: { oklch: "oklch(93% 0.08 96)", hex: "#F7E8AB" },
    mid: { oklch: "oklch(80% 0.125 92)", hex: "#DBBB56" },
    edge: { oklch: "oklch(60% 0.11 80)", hex: "#A27825" },
  },
} as const satisfies Record<Brightness, BeadInk>;

/** A bead's shadow: offset and blur in points, the theme shadow's strength. */
export const SUBHA_BEAD_SHADOW = {
  [BRIGHTNESS.LIGHT]: { y: 2, blur: 4, alpha: 0.28 },
  [BRIGHTNESS.DARK]: { y: 2, blur: 5, alpha: 0.5 },
} as const satisfies Record<Brightness, { y: number; blur: number; alpha: number }>;

/** The dots under the string: one per round of a count longer than one. */
export const SUBHA_TENS = {
  SIZE: 6,
  /** How far the next dot's ring reaches under a hold. */
  HOLD_RING: 3,
} as const;

/** The session's knots on their thin string. */
export const SUBHA_KNOTS = {
  HEIGHT: 20,
  REMAINING: { SIZE: 5, ALPHA: 0.42 },
  DONE: 7,
  FINE: 3,
  /** The bead on the current knot. */
  CURRENT: 14,
  /** A fine knot's share of a full one's room. */
  FINE_SHARE: 0.26,
} as const;

/** The slab: a rim round a glass core, the dhikr behind it stacked above. */
export const SUBHA_SLAB = {
  RIM_ALPHA: 0.3,
  /** The text's least height, so a short dhikr keeps the slab's shape. */
  TEXT_MIN_HEIGHT: 132,
  /** The slabs behind: how far each rises, its scale, its tint's share. */
  BEHIND: [
    { RISE: 14, SCALE: 0.94, OPACITY: 0.7 },
    { RISE: 27, SCALE: 0.88, OPACITY: 0.4 },
  ],
  /** Room above the stack for the slabs behind. */
  STACK_TOP: 28,
  PRESS_SCALE: 0.985,
} as const;

export const SUBHA_MOTION = {
  /** A bead crossing, on a curve that overshoots once. */
  BEAD_MS: 420,
  CURVE: [0.3, 1.3, 0.5, 1],
  /** A bead lighting as it lands, or dimming as it returns. */
  OPACITY_MS: 280,
  /** The next dhikr's slab rising from its place behind. */
  RISE_MS: 420,
  /** The string dipping once as the count reaches its target. */
  SETTLE_MS: 560,
  SETTLE_DIP: 3,
  /** How far a hold pulls the string down. */
  HOLD_SAG: 5,
} as const;
