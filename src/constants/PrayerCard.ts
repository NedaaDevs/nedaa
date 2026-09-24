/** How a prayer card reads at a moment: passed, the one coming, or later. */
export const PRAYER_CARD_STATE = { PAST: "past", NEXT: "next", FUTURE: "future" } as const;

export type PrayerCardState = (typeof PRAYER_CARD_STATE)[keyof typeof PRAYER_CARD_STATE];
