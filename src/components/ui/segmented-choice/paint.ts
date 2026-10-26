import type { ColorToken } from "@/constants/Palette";

/** A segmented choice's paint, as palette keys. */
export const SEGMENTED_PAINT = {
  /** The framed track's fill. */
  TRACK: "quietTint",
  /** The ink of every label on the track and of the compact chosen pill. */
  LABEL: "fg",
} as const satisfies Record<string, ColorToken>;
