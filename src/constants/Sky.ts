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
  /** Daylight, top to bottom. */
  base: [
    stop(0, "oklch(88.5% 0.05 248)", "#C0DDF9"),
    stop(0.42, "oklch(87.5% 0.06 242)", "#B4DCFB"),
    stop(0.74, "oklch(86.5% 0.07 234)", "#A5DBFA"),
    stop(1, "oklch(86% 0.075 228)", "#9DDBF8"),
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
  sun: {
    disc: { diameter: 224, top: -78, right: -34 },
    opacity: 0.9,
    stops: [
      stop(0, "oklch(98.5% 0.1 98 / .95)", "#FFFBE5F2"),
      stop(0.45, "oklch(97% 0.065 92 / .55)", "#FFF5D68C"),
      stop(0.7, "oklch(97% 0.05 90 / 0)", "#FFF5D900"),
    ],
  },
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
