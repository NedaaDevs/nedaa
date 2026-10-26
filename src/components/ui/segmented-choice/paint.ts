import type { ColorToken } from "@/constants/Palette";

/** The framed track's fill and every label's ink on it, as palette keys. */
export const SEGMENTED_PAINT = {
  TRACK: "quietTint",
  LABEL: "fg",
} as const satisfies Record<string, ColorToken>;
