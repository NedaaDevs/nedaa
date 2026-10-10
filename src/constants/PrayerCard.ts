/** How a prayer card reads: passed, just come in, the one coming, or later. */
export const PRAYER_CARD_STATE = {
  PAST: "past",
  CURRENT: "current",
  NEXT: "next",
  FUTURE: "future",
} as const;

export type PrayerCardState = (typeof PRAYER_CARD_STATE)[keyof typeof PRAYER_CARD_STATE];
