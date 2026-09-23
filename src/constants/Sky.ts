// The prototype sky; `Sky.test.ts` re-derives each hex from its oklch.
// Positions and radii are fractions of the screen box; sizes are points.

import type { PaletteEntry } from "@/constants/Palette";

export type SkyStop = { readonly offset: number; readonly color: PaletteEntry };

/** An ellipse at (cx, cy) with radii (rx, ry), as fractions of the box. */
export type SkyEllipse = {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly stops: readonly SkyStop[];
};

/** A disc pinned past the top-right corner, partly off screen. */
export type SkyDisc = {
  readonly diameter: number;
  readonly top: number;
  readonly right: number;
};

const stop = (offset: number, oklch: string, hex: string): SkyStop => ({
  offset,
  color: { oklch, hex },
});

export const LIGHT_SKY = {
  /** Daylight, top to bottom: deep enough for a white sun to stand out. */
  base: [
    stop(0, "oklch(72% 0.12 250)", "#67AAED"),
    stop(0.42, "oklch(74.5% 0.115 246)", "#6BB3F1"),
    stop(0.74, "oklch(77.5% 0.105 240)", "#74BFF2"),
    stop(1, "oklch(80% 0.1 235)", "#7AC8F5"),
  ],
  /** Warm light spread under the sun. */
  glow: {
    cx: 0.72,
    cy: -0.1,
    rx: 1.2,
    ry: 0.72,
    stops: [
      stop(0, "oklch(97.5% 0.075 97 / .48)", "#FFF8D67A"),
      stop(0.44, "oklch(96.5% 0.045 90 / .2)", "#FFF3D233"),
      stop(0.7, "oklch(96.5% 0.04 90 / 0)", "#FEF3D600"),
    ],
  },
  /** Cool light rising from the bottom-left corner. */
  horizon: {
    cx: 0.06,
    cy: 1.06,
    rx: 0.95,
    ry: 0.62,
    stops: [
      stop(0, "oklch(93% 0.052 196 / .42)", "#C0F3F36B"),
      stop(0.58, "oklch(93% 0.04 200 / 0)", "#CAF1F200"),
    ],
  },
  /** Where the sun rests while the moon is up. */
  sun: { disc: { diameter: 224, top: -78, right: -34 } },

  /** What a translucent phase tint sits on: the design's near-black frame. */
  tintGround: { oklch: "oklch(13% 0.03 252 / .95)", hex: "#010813F2" },
  /** Tints both side edges, the first stop at the reading-start edge. */
  edgeWash: [
    stop(0, "oklch(60% 0.07 295 / .14)", "#8378A624"),
    stop(0.12, "oklch(75% 0.06 315 / .12)", "#BDA3C91F"),
    stop(0.34, "oklch(99% 0 0 / 0)", "#FCFCFC00"),
    stop(0.64, "oklch(99% 0 0 / 0)", "#FCFCFC00"),
    stop(0.8, "oklch(72% 0.09 355 / .14)", "#D28DA724"),
    stop(0.96, "oklch(42% 0.07 275 / .16)", "#424A7329"),
  ],
} as const;

export const DARK_SKY = {
  /** A soft-edged disc where the light sky has its sun. */
  moon: {
    disc: { diameter: 224, top: -78, right: -34 },
    color: { oklch: "oklch(33% 0.12 260 / .55)", hex: "#0831718C" },
  },
  /** A wider, fainter disc offset down and toward the start of the moon. */
  moonHalo: {
    dx: -52,
    dy: 80,
    spread: 26,
    color: { oklch: "oklch(28% 0.075 275 / .24)", hex: "#1F244D3D" },
  },
  /** How far each disc's edge fades, in points either side of it. */
  edgeFade: 28,
} as const;

export const CELESTIAL_BODY = { SUN: "sun", MOON: "moon" } as const;
export type CelestialBody = (typeof CELESTIAL_BODY)[keyof typeof CELESTIAL_BODY];

/** The path the sun and moon travel, as fractions of the box. */
export const SKY_ARC = {
  /** Just past the reading-start edge, so a body rises from off screen. */
  start: -0.06,
  /** Just past the reading-end edge. */
  end: 1.06,
  /** The height a body rises from and sets to. */
  horizon: 0.36,
} as const;

const colour = (oklch: string, hex: string): PaletteEntry => ({ oklch, hex });

const WHITE = colour("oklch(100% 0 0)", "#FFFFFF");

/** The sun: a white core in a wide bloom, with faint rays that turn slowly. */
export const SUN_GLYPH = {
  colour: WHITE,
  /** Radius of the blown-out core, in points. */
  core: 30,
  /** Radius of the bloom that lightens the sky around the sun. */
  bloom: 170,
  rays: {
    /** Each ray's length in turn, so they do not read as a regular star. */
    lengths: [135, 90, 115, 80, 105, 135, 90, 115, 80, 105],
    /** Half the angle a ray spans, in degrees. */
    halfAngle: 5,
    /** Offset of the first ray from straight right, in degrees. */
    offset: 9,
  },
  /** One full turn of the rays. */
  spinMs: 120_000,
} as const;

/** The moon: silver, with soft seas and a bright rim on its lit limb. */
export const MOON_GLYPH = {
  radius: 22,
  /** The face, brightest toward the lit limb. */
  face: {
    light: colour("oklch(98.5% 0.004 250)", "#F8FAFD"),
    edge: colour("oklch(85% 0.022 252)", "#C4CFDC"),
  },
  /** Seas as ellipses (dx, dy, rx, ry), in fractions of the radius. */
  seas: [
    [-0.27, -0.27, 0.32, 0.25],
    [0.23, 0.18, 0.27, 0.2],
    [-0.18, 0.41, 0.18, 0.15],
  ],
  sea: colour("oklch(68% 0.03 262)", "#8E99AB"),
  seaOpacity: 0.28,
  rim: { colour: WHITE, stroke: 0.9, opacity: 0.6 },
  /** The unlit part, so the whole body still reads behind a thin crescent. */
  earthshine: 0.1,
  /** A pale light around the moon, stronger the more of it is lit. */
  halo: { colour: colour("oklch(92.5% 0.018 250)", "#DEE7F2"), reach: 2.8, dim: 0.1, bright: 0.36 },
  /** How far a young moon tilts its lit limb toward the sun below the horizon. */
  tiltDegrees: 38,
} as const;
