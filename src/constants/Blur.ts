/** Blur radius in points, by the surface that carries it. */
export const BLUR = {
  /** A resting card or group. */
  REST: 24,
  /** Tab bar, toast, floating control. */
  FLOAT: 28,
  /** The header of a sheet; its body stays opaque. */
  SHEET: 40,
} as const;

export type BlurLevel = keyof typeof BLUR;
