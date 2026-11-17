import { BRIGHTNESS, type Brightness } from "@/constants/Palette";

/** The two arcs the Horizon look draws a session's position on. */
export const HORIZON_ARC_KIND = { READER: "reader", FOCUS: "focus" } as const;
export type HorizonArcKind = (typeof HORIZON_ARC_KIND)[keyof typeof HORIZON_ARC_KIND];

/** A glow round a disc: its blur and spread in points, and its strength. */
export type HorizonGlow = { blur: number; spread: number; alpha: number };
type ByBrightness<T> = Record<Brightness, T>;

type ArcDrawing = {
  WIDTH: number;
  HEIGHT: number;
  /** The sun's diameter, and the radius of a full and a fine point. */
  SUN: number;
  POINT: number;
  FINE: number;
  SUN_GLOW: ByBrightness<HorizonGlow>;
};

/** Each arc's box and marks, in points. */
export const HORIZON_ARC = {
  [HORIZON_ARC_KIND.READER]: {
    WIDTH: 284,
    HEIGHT: 100,
    SUN: 26,
    POINT: 3.5,
    FINE: 1.6,
    SUN_GLOW: {
      [BRIGHTNESS.LIGHT]: { blur: 22, spread: 8, alpha: 0.5 },
      [BRIGHTNESS.DARK]: { blur: 22, spread: 6, alpha: 0.3 },
    },
  },
  [HORIZON_ARC_KIND.FOCUS]: {
    WIDTH: 228,
    HEIGHT: 228,
    SUN: 16,
    POINT: 3,
    FINE: 1.4,
    SUN_GLOW: {
      [BRIGHTNESS.LIGHT]: { blur: 14, spread: 5, alpha: 0.5 },
      [BRIGHTNESS.DARK]: { blur: 14, spread: 5, alpha: 0.3 },
    },
  },
} as const satisfies Record<HorizonArcKind, ArcDrawing>;

/** The reader's arc: a low curve, drawn from the session's start. */
export const HORIZON_READER_PATH = {
  FROM: { x: 276, y: 90 },
  CONTROL: { x: 142, y: -36 },
  TO: { x: 8, y: 90 },
} as const;

/** Focus's arc: over the top of a circle round the sun disc. */
export const HORIZON_FOCUS_PATH = {
  CENTRE: { x: 114, y: 114 },
  RADIUS: 106,
  FROM: { x: 216.4, y: 86.6 },
  TO: { x: 11.6, y: 86.6 },
} as const;

/** The arc's lines: the whole track under the lit part. */
export const HORIZON_LINE = {
  TRACK: { WIDTH: 1.4, OPACITY: 0.28 },
  LIT: { WIDTH: 2.2 },
  POINT_STROKE: 1.2,
  FINE_OPACITY: 0.45,
} as const;

/** Focus's sun disc: it grows from MIN_SCALE to whole as the count fills. */
export const HORIZON_ORB = {
  SIZE: 180,
  /** How far the position arc stands off the disc. */
  ARC_GAP: 24,
  MIN_SCALE: 0.28,
  RING: { WIDTH: 1.5, ALPHA: { [BRIGHTNESS.LIGHT]: 0.6, [BRIGHTNESS.DARK]: 0.4 } },
  GLOW: {
    [BRIGHTNESS.LIGHT]: { blur: 40, spread: 10, alpha: 0.45 },
    [BRIGHTNESS.DARK]: { blur: 40, spread: 8, alpha: 0.22 },
  },
  /** The glow of a count that reached its target. */
  REST_GLOW: {
    [BRIGHTNESS.LIGHT]: { blur: 64, spread: 18, alpha: 0.5 },
    [BRIGHTNESS.DARK]: { blur: 64, spread: 16, alpha: 0.3 },
  },
  /** The halo a hold builds: a ring, then its glow. */
  HALO: {
    RING: 8,
    RING_ALPHA: { [BRIGHTNESS.LIGHT]: 0.3, [BRIGHTNESS.DARK]: 0.22 },
    GLOW: {
      [BRIGHTNESS.LIGHT]: { blur: 44, spread: 8, alpha: 0.4 },
      [BRIGHTNESS.DARK]: { blur: 44, spread: 8, alpha: 0.3 },
    },
    /** The share of a hold by which the halo is whole. */
    FULL_AT: 1 / 6,
  },
  /** The sliver an undo sheds: a ring that grows off the disc and fades. */
  SHED: {
    WIDTH: 2,
    GROW: 0.12,
    OPACITY: 0.9,
    ALPHA: { [BRIGHTNESS.LIGHT]: 0.8, [BRIGHTNESS.DARK]: 0.7 },
  },
} as const;

/** The light a tap leaves where it landed. */
export const HORIZON_BLOOM = {
  SIZE: 260,
  /** The share of the radius by which the light is gone. */
  CLEAR_AT: 0.68,
  FROM_SCALE: 0.2,
  OPACITY: 0.9,
  ALPHA: { [BRIGHTNESS.LIGHT]: 0.55, [BRIGHTNESS.DARK]: 0.3 },
} as const;

export const HORIZON_MOTION = {
  /** The sun and the lit line moving to a new place. */
  TRAVEL_MS: 600,
  /** The disc growing by one repeat. */
  FILL_MS: 500,
  BLOOM_MS: 640,
  SHED_MS: 460,
} as const;

/** The reader's dhikr under a finger. */
export const HORIZON_PRESS_SCALE = 0.985;
