// Pure icon geometry. Free of lucide and Tamagui imports so jest can test it
// without rendering, matching text/sizing.ts.

export type IconSize = "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

/** The one icon ramp. Other primitives name a step here rather than repeat a number. */
export const ICON_SIZES: Record<IconSize, number> = {
  "2xs": 12,
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
  "2xl": 28,
  "3xl": 32,
};

/** A name resolves through the ramp; a number passes through. */
export const resolveIconSize = (size: IconSize | number): number =>
  typeof size === "number" ? size : (ICON_SIZES[size] ?? ICON_SIZES.md);
