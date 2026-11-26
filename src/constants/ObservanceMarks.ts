import { ObservanceClass } from "@/enums/observances";

export const GLYPH_SHAPE = {
  RING: "ring",
  SQUARE: "square",
  CRESCENT: "crescent",
  STAR: "star",
} as const;
export type GlyphShape = (typeof GLYPH_SHAPE)[keyof typeof GLYPH_SHAPE];

type Mark = {
  shape: GlyphShape;
  color: "$accent" | "$warn" | "$fg";
  /** The class's name in the legend and the day detail. */
  labelKey: string;
};

/** Each class's shape, colour and name; shapes are unique. */
export const OBSERVANCE_MARK: Record<ObservanceClass, Mark> = {
  [ObservanceClass.RECOMMENDED_FAST]: {
    shape: GLYPH_SHAPE.RING,
    color: "$accent",
    labelKey: "hijriCalendar.legend.recommendedFast",
  },
  [ObservanceClass.FASTING_FORBIDDEN]: {
    shape: GLYPH_SHAPE.SQUARE,
    color: "$warn",
    labelKey: "hijriCalendar.legend.fastingForbidden",
  },
  [ObservanceClass.NIGHT_WORSHIP]: {
    shape: GLYPH_SHAPE.CRESCENT,
    color: "$fg",
    labelKey: "hijriCalendar.legend.nightWorship",
  },
  [ObservanceClass.BLESSED_DAY]: {
    shape: GLYPH_SHAPE.STAR,
    color: "$accent",
    labelKey: "hijriCalendar.legend.blessedDay",
  },
};

/** Every class, in legend order. */
export const MARK_ORDER = [
  ObservanceClass.RECOMMENDED_FAST,
  ObservanceClass.FASTING_FORBIDDEN,
  ObservanceClass.NIGHT_WORSHIP,
  ObservanceClass.BLESSED_DAY,
] as const satisfies readonly ObservanceClass[];
