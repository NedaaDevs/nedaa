// Pure sizing tables and math for the shared Text primitive. Kept free of
// Tamagui imports so jest can test the scaling without rendering.

// Font size + line height mapping (from tamagui.config.ts font definitions).
// We resolve sizes to numeric values directly because Android's Fabric renderer
// rejects string token values for fontSize on RCTText.
export const FONT_SIZES: Record<string, { fontSize: number; lineHeight: number }> = {
  $1: { fontSize: 10, lineHeight: 14 },
  $2: { fontSize: 12, lineHeight: 16 },
  "$2.75": { fontSize: 13, lineHeight: 20 },
  $3: { fontSize: 14, lineHeight: 20 },
  "$3.75": { fontSize: 15, lineHeight: 21 },
  $4: { fontSize: 16, lineHeight: 24 },
  $5: { fontSize: 18, lineHeight: 28 },
  $6: { fontSize: 20, lineHeight: 28 },
  "$6.5": { fontSize: 22, lineHeight: 30 },
  $7: { fontSize: 24, lineHeight: 32 },
  "$7.5": { fontSize: 26, lineHeight: 34 },
  $8: { fontSize: 30, lineHeight: 36 },
  "$8.5": { fontSize: 32, lineHeight: 40 },
  $9: { fontSize: 36, lineHeight: 40 },
  $10: { fontSize: 48, lineHeight: 48 },
  "$10.5": { fontSize: 40, lineHeight: 52 },
};

export const SIZE_MAP = {
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
  helper: "$2.75",
  label: "$3.75",
  heading: "$7.5",
  headline: "$6.5",
  figure: "$8.5",
  display: "$10.5",
} as const satisfies Record<string, keyof typeof FONT_SIZES>;

/**
 * Line box as a ratio of the font size. Arabic is cursive and carries diacritics,
 * so 1.3 is the floor for display text and body wants 1.5 or looser. The size
 * table runs as tight as 1.0 at $10, which clips those marks.
 */
export const ROLE_RATIO = {
  display: 1.3,
  /** Above `TITLE_COMPACT_MAX`; at or below it a title takes `titleLoose`. */
  title: 1.3,
  /** A title or subtitle at any size, with the looser line box. */
  titleLoose: 1.4,
  helper: 1.5,
  body: 1.6,
} as const;

export type TextRole = keyof typeof ROLE_RATIO;

/** The largest font size that still sets a title on the looser line box. */
const TITLE_COMPACT_MAX = 24;

/** Undefined when no role is set, so the size table keeps its own line box. */
export const roleLineHeight = (
  role: TextRole | undefined,
  fontSize: number
): number | undefined => {
  if (role == null) return undefined;
  const key = role === "title" && fontSize <= TITLE_COMPACT_MAX ? "titleLoose" : role;
  return Math.round(fontSize * ROLE_RATIO[key]);
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

/** A token reads the line-height column, where resolveFontSize reads the font one. */
export const resolveLineHeight = (value: unknown): number | undefined => {
  if (value == null) return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.startsWith("$")) {
    return FONT_SIZES[value]?.lineHeight;
  }
  const num = Number(value);
  return isNaN(num) ? undefined : num;
};

/**
 * Final font geometry for a Text instance: the app text-scale multiplier `m`
 * applied to the caller's explicit values or the size-token table. An explicit
 * line box wins and scales with the font. Without one, an explicit fontSize
 * leaves the box undefined so React Native derives it from the scaled font.
 */
export const resolveTextSizing = (
  m: number,
  fontSize: unknown,
  sizeValues: { fontSize: number; lineHeight: number },
  lineHeight?: unknown
): { fontSize: number | undefined; lineHeight: number | undefined } => {
  const base = fontSize != null ? resolveFontSize(fontSize) : sizeValues.fontSize;
  const explicitBox = lineHeight != null ? resolveLineHeight(lineHeight) : undefined;
  const box = explicitBox ?? (fontSize != null ? undefined : sizeValues.lineHeight);

  return {
    fontSize: base == null ? undefined : base * m,
    lineHeight: box == null ? undefined : box * m,
  };
};
