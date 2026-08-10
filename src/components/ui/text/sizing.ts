// Pure sizing tables and math for the shared Text primitive. Kept free of
// Tamagui imports so jest can test the scaling without rendering.

// Font size + line height mapping (from tamagui.config.ts font definitions).
// We resolve sizes to numeric values directly because Android's Fabric renderer
// rejects string token values for fontSize on RCTText.
export const FONT_SIZES: Record<string, { fontSize: number; lineHeight: number }> = {
  $1: { fontSize: 10, lineHeight: 14 },
  $2: { fontSize: 12, lineHeight: 16 },
  $3: { fontSize: 14, lineHeight: 20 },
  $4: { fontSize: 16, lineHeight: 24 },
  $5: { fontSize: 18, lineHeight: 28 },
  $6: { fontSize: 20, lineHeight: 28 },
  $7: { fontSize: 24, lineHeight: 32 },
  $8: { fontSize: 30, lineHeight: 36 },
  $9: { fontSize: 36, lineHeight: 40 },
  $10: { fontSize: 48, lineHeight: 48 },
};

export const SIZE_MAP: Record<string, string> = {
  "2xs": "$1",
  xs: "$1",
  sm: "$2",
  md: "$3",
  lg: "$4",
  xl: "$5",
  "2xl": "$6",
  "3xl": "$7",
  "4xl": "$8",
  "5xl": "$9",
};

export const resolveFontSize = (value: unknown): number | undefined => {
  if (value == null) return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.startsWith("$")) {
    return FONT_SIZES[value]?.fontSize;
  }
  const num = Number(value);
  return isNaN(num) ? undefined : num;
};

/**
 * Final font geometry for a Text instance: the app text-scale multiplier `m`
 * applied to either the caller's explicit fontSize or the size-token table.
 * With an explicit fontSize the line box stays undefined so React Native
 * derives it from the scaled font.
 */
export const resolveTextSizing = (
  m: number,
  fontSize: unknown,
  sizeValues: { fontSize: number; lineHeight: number }
): { fontSize: number | undefined; lineHeight: number | undefined } => {
  const base = fontSize != null ? resolveFontSize(fontSize) : sizeValues.fontSize;
  return {
    fontSize: base == null ? undefined : base * m,
    lineHeight: fontSize != null ? undefined : sizeValues.lineHeight * m,
  };
};
