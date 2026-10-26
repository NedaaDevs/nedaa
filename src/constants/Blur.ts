import type { BlurTint } from "expo-blur";

import { BRIGHTNESS, type Brightness } from "@/constants/Palette";

/** Blur radius in points, by the surface that carries it. */
export const BLUR = {
  /** Tab bar, toast, floating control. */
  FLOAT: 28,
  /** The header of a sheet; its body stays opaque. */
  SHEET: 40,
} as const;

export type BlurLevel = keyof typeof BLUR;

/** Android divides `intensity` by this to get a blur radius in points. */
export const BLUR_REDUCTION = 2.5;

/**
 * expo-blur `intensity` per level: the radius times `BLUR_REDUCTION`, so Android
 * draws the radius itself and iOS draws that fraction of its system blur.
 */
export const BLUR_INTENSITY = {
  FLOAT: BLUR.FLOAT * BLUR_REDUCTION,
  SHEET: BLUR.SHEET * BLUR_REDUCTION,
} as const satisfies Record<BlurLevel, number>;

/**
 * expo-blur `tint` per theme: the thinnest system material of that brightness,
 * since the material's own colour already tints it.
 */
export const BLUR_TINT = {
  [BRIGHTNESS.LIGHT]: "systemUltraThinMaterialLight",
  [BRIGHTNESS.DARK]: "systemUltraThinMaterialDark",
} as const satisfies Record<Brightness, BlurTint>;
