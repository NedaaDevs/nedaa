/** Whose place a place hero names, which sets its tint. */
export const PLACE_HERO_TONE = {
  /** The device's own position. */
  DEVICE: "device",
  /** A city the user chose. */
  CITY: "city",
  /** No place yet, or no way to read one. */
  NONE: "none",
} as const;
export type PlaceHeroTone = (typeof PLACE_HERO_TONE)[keyof typeof PLACE_HERO_TONE];
