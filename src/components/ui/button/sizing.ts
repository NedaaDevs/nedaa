// Pure label sizing for Button, kept free of Tamagui imports for jest.

// Label font size per Button size variant; the app text-scale multiplies it.
export const BUTTON_FONT_SIZE: Record<string, number> = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
};

/**
 * Final label font size: an explicit numeric fontSize wins over the size
 * variant's base; either way the multiplier applies.
 */
export const buttonLabelFontSize = (
  size: string | undefined,
  explicit: unknown,
  m: number
): number => {
  const base =
    typeof explicit === "number"
      ? explicit
      : (BUTTON_FONT_SIZE[size ?? "md"] ?? BUTTON_FONT_SIZE.md);
  return base * m;
};
